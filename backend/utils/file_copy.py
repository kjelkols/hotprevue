"""File copy engine — runs in a ThreadPoolExecutor.

Each copy operation is tracked in the database. Progress is updated after
every file. Callers poll GET /file-copy-operations/{id} for status.
"""

import hashlib
import shutil
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from utils.registration import KNOWN_EXTENSIONS

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mxf", ".avi", ".mkv", ".m4v", ".mpg", ".mpeg", ".3gp", ".wmv"}

# One worker — copy operations run sequentially
_executor = ThreadPoolExecutor(max_workers=1)

# cancel_event per operation_id — set by cancel_copy()
_cancel_events: dict[uuid.UUID, threading.Event] = {}


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def suggest_name(source_path: str, include_videos: bool) -> dict:
    """Scan source quickly and return suggested directory name + file stats."""
    files = _collect_files(Path(source_path), include_videos)
    bytes_total = sum(f.stat().st_size for f in files)
    earliest = _earliest_date(files)
    suggested = earliest.strftime("%Y-%m-%d") if earliest else None
    return {"suggested_name": suggested, "files_found": len(files), "bytes_total": bytes_total}


def start_copy(operation_id: uuid.UUID) -> None:
    """Submit a copy operation to the thread pool."""
    event = threading.Event()
    _cancel_events[operation_id] = event
    _executor.submit(_run_copy, operation_id, event)


def cancel_copy(operation_id: uuid.UUID) -> None:
    """Signal a running copy to stop."""
    if operation_id in _cancel_events:
        _cancel_events[operation_id].set()


# ---------------------------------------------------------------------------
# Thread worker
# ---------------------------------------------------------------------------

def _run_copy(operation_id: uuid.UUID, cancel_event: threading.Event) -> None:
    from database.session import SessionLocal
    from models.file_copy import FileCopyOperation, FileCopySkip

    with SessionLocal() as db:
        op = db.get(FileCopyOperation, operation_id)
        if op is None:
            return

        op.status = "running"
        db.commit()

        try:
            source = Path(op.source_path)
            dest_dir = Path(op.destination_path)
            dest_dir.mkdir(parents=True, exist_ok=True)

            files = _collect_files(source, op.include_videos)
            op.files_total = len(files)
            op.bytes_total = sum(f.stat().st_size for f in files)
            db.commit()

            for src_file in files:
                if cancel_event.is_set():
                    op.status = "cancelled"
                    op.completed_at = datetime.now(timezone.utc)
                    db.commit()
                    return

                dest_file = dest_dir / src_file.name

                # Skip: file already exists
                if dest_file.exists():
                    db.add(FileCopySkip(
                        operation_id=operation_id,
                        source_path=str(src_file),
                        reason="already_exists",
                    ))
                    op.files_skipped += 1
                    db.commit()
                    continue

                # Copy
                try:
                    shutil.copy2(str(src_file), str(dest_file))
                except OSError as e:
                    db.add(FileCopySkip(
                        operation_id=operation_id,
                        source_path=str(src_file),
                        reason="write_error",
                    ))
                    op.files_skipped += 1
                    db.commit()
                    continue

                # Verify
                if op.verify_after_copy:
                    try:
                        src_hash = _sha256(src_file)
                        dst_hash = _sha256(dest_file)
                    except OSError:
                        src_hash, dst_hash = None, None

                    if src_hash is None or src_hash != dst_hash:
                        dest_file.unlink(missing_ok=True)
                        db.add(FileCopySkip(
                            operation_id=operation_id,
                            source_path=str(src_file),
                            reason="hash_mismatch",
                        ))
                        op.files_skipped += 1
                        db.commit()
                        continue

                op.files_copied += 1
                op.bytes_copied += src_file.stat().st_size
                db.commit()

            op.status = "completed"
            op.completed_at = datetime.now(timezone.utc)
            db.commit()

        except Exception as exc:
            op.status = "failed"
            op.error = str(exc)
            op.completed_at = datetime.now(timezone.utc)
            db.commit()
        finally:
            _cancel_events.pop(operation_id, None)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _collect_files(source: Path, include_videos: bool) -> list[Path]:
    extensions = KNOWN_EXTENSIONS | (VIDEO_EXTENSIONS if include_videos else set())
    return sorted(
        f for f in source.rglob("*")
        if f.is_file() and f.suffix.lower() in extensions
    )


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _earliest_date(files: list[Path]) -> datetime | None:
    """Return the earliest EXIF DateTimeOriginal across files, or None."""
    earliest: datetime | None = None
    for f in files:
        if f.suffix.lower() not in KNOWN_EXTENSIONS:
            continue
        try:
            import exifread
            with f.open("rb") as fh:
                tags = exifread.process_file(fh, stop_tag="EXIF DateTimeOriginal", details=False)
            raw = tags.get("EXIF DateTimeOriginal") or tags.get("Image DateTime")
            if raw is None:
                continue
            dt = datetime.strptime(str(raw), "%Y:%m:%d %H:%M:%S")
            if earliest is None or dt < earliest:
                earliest = dt
        except Exception:
            continue
    return earliest
