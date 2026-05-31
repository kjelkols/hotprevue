"""Filkopiering fra minnekort til permanent lagring på klientmaskinen.

Operasjoner kjøres i en bakgrunnstråd og kan polles via GET /copy/{id}.
Tilstanden holdes i minnet — restartes agenten forsvinner pågående operasjoner.
"""

import hashlib
import shutil
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from utils.registration import KNOWN_EXTENSIONS

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mxf", ".avi", ".mkv", ".m4v", ".mpg", ".mpeg", ".3gp", ".wmv"}

router = APIRouter(prefix="/copy", tags=["copy"])

_executor = ThreadPoolExecutor(max_workers=1)
_ops: dict[str, dict] = {}
_cancel_events: dict[str, threading.Event] = {}


# ─── Skjemaer ─────────────────────────────────────────────────────────────────

class SuggestResult(BaseModel):
    suggested_name: str | None
    files_found: int
    bytes_total: int


class CopyRequest(BaseModel):
    source_path: str
    destination_path: str
    device_label: str | None = None
    verify: bool = True
    include_videos: bool = False


class SkipEntry(BaseModel):
    source_path: str
    reason: str


class CopyStatus(BaseModel):
    id: str
    source_path: str
    destination_path: str
    device_label: str | None
    status: str
    files_total: int
    files_copied: int
    files_skipped: int
    bytes_total: int
    bytes_copied: int
    verify: bool
    started_at: str
    completed_at: str | None
    error: str | None
    skips: list[SkipEntry]


class EraseResult(BaseModel):
    deleted: int
    errors: int


# ─── Endepunkter ──────────────────────────────────────────────────────────────

@router.get("/suggest-name", response_model=SuggestResult)
def suggest_name(source: str = Query(...)):
    p = Path(source)
    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=404, detail=f"Kilde finnes ikke: {source}")
    files = _collect_files(p, include_videos=False)
    bytes_total = sum(f.stat().st_size for f in files)
    earliest = _earliest_date(files)
    suggested = earliest.strftime("%Y-%m-%d") if earliest else None
    return SuggestResult(suggested_name=suggested, files_found=len(files), bytes_total=bytes_total)


@router.post("", response_model=CopyStatus, status_code=201)
def start_copy(req: CopyRequest):
    op_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    op: dict = {
        "id": op_id,
        "source_path": req.source_path,
        "destination_path": req.destination_path,
        "device_label": req.device_label,
        "status": "pending",
        "files_total": 0,
        "files_copied": 0,
        "files_skipped": 0,
        "bytes_total": 0,
        "bytes_copied": 0,
        "verify": req.verify,
        "include_videos": req.include_videos,
        "started_at": now,
        "completed_at": None,
        "error": None,
        "skips": [],
        "_copied_sources": [],  # brukes av erase-source
    }
    _ops[op_id] = op
    cancel_event = threading.Event()
    _cancel_events[op_id] = cancel_event
    _executor.submit(_run_copy, op_id, cancel_event)
    return _to_status(op)


@router.get("/{op_id}", response_model=CopyStatus)
def get_copy(op_id: str):
    op = _get_or_404(op_id)
    return _to_status(op)


@router.delete("/{op_id}", status_code=204)
def cancel_copy(op_id: str):
    op = _get_or_404(op_id)
    if op["status"] not in ("pending", "running"):
        raise HTTPException(status_code=409, detail=f"Kan ikke kansellere operasjon med status '{op['status']}'")
    _cancel_events[op_id].set()


@router.post("/{op_id}/erase-source", response_model=EraseResult)
def erase_source(op_id: str):
    op = _get_or_404(op_id)
    if op["status"] != "completed":
        raise HTTPException(status_code=409, detail="Kan bare slette kilde etter vellykket kopiering")

    deleted = 0
    errors = 0
    for src_path in op["_copied_sources"]:
        try:
            Path(src_path).unlink(missing_ok=True)
            deleted += 1
        except OSError:
            errors += 1

    return EraseResult(deleted=deleted, errors=errors)


# ─── Bakgrunnsjobb ────────────────────────────────────────────────────────────

def _run_copy(op_id: str, cancel_event: threading.Event) -> None:
    op = _ops[op_id]
    op["status"] = "running"

    try:
        source = Path(op["source_path"])
        dest_dir = Path(op["destination_path"])
        dest_dir.mkdir(parents=True, exist_ok=True)

        files = _collect_files(source, op["include_videos"])
        op["files_total"] = len(files)
        op["bytes_total"] = sum(f.stat().st_size for f in files)

        for src in files:
            if cancel_event.is_set():
                op["status"] = "cancelled"
                op["completed_at"] = datetime.now(timezone.utc).isoformat()
                return

            dest = dest_dir / src.name

            if dest.exists():
                op["skips"].append({"source_path": str(src), "reason": "already_exists"})
                op["files_skipped"] += 1
                continue

            try:
                shutil.copy2(str(src), str(dest))
            except OSError as e:
                op["skips"].append({"source_path": str(src), "reason": "write_error"})
                op["files_skipped"] += 1
                continue

            if op["verify"]:
                try:
                    ok = _sha256(src) == _sha256(dest)
                except OSError:
                    ok = False
                if not ok:
                    dest.unlink(missing_ok=True)
                    op["skips"].append({"source_path": str(src), "reason": "hash_mismatch"})
                    op["files_skipped"] += 1
                    continue

            op["files_copied"] += 1
            op["bytes_copied"] += src.stat().st_size
            op["_copied_sources"].append(str(src))

        op["status"] = "completed"
        op["completed_at"] = datetime.now(timezone.utc).isoformat()

    except Exception as e:
        op["status"] = "failed"
        op["error"] = str(e)
        op["completed_at"] = datetime.now(timezone.utc).isoformat()
    finally:
        _cancel_events.pop(op_id, None)


# ─── Hjelpere ─────────────────────────────────────────────────────────────────

def _get_or_404(op_id: str) -> dict:
    op = _ops.get(op_id)
    if op is None:
        raise HTTPException(status_code=404, detail="Kopioperasjon ikke funnet")
    return op


def _to_status(op: dict) -> CopyStatus:
    return CopyStatus(
        id=op["id"],
        source_path=op["source_path"],
        destination_path=op["destination_path"],
        device_label=op["device_label"],
        status=op["status"],
        files_total=op["files_total"],
        files_copied=op["files_copied"],
        files_skipped=op["files_skipped"],
        bytes_total=op["bytes_total"],
        bytes_copied=op["bytes_copied"],
        verify=op["verify"],
        started_at=op["started_at"],
        completed_at=op["completed_at"],
        error=op["error"],
        skips=[SkipEntry(**s) for s in op["skips"]],
    )


def _collect_files(source: Path, include_videos: bool) -> list[Path]:
    exts = KNOWN_EXTENSIONS | (VIDEO_EXTENSIONS if include_videos else set())
    return sorted(f for f in source.rglob("*") if f.is_file() and f.suffix.lower() in exts)


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _earliest_date(files: list[Path]) -> datetime | None:
    import exifread
    earliest: datetime | None = None
    for f in files:
        if f.suffix.lower() not in KNOWN_EXTENSIONS:
            continue
        try:
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
