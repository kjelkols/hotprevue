"""Preorganisering — prescan-cache for lokal katalogvisning.

Scanner en katalog i bakgrunnen, genererer hotpreview og henter EXIF-data,
og lagrer resultatet i en SQLite-cache på disk. Cachen overlever agent-restart.

Endepunkter:
  POST /prescan/start          — start bakgrunnsjobb for én katalog
  GET  /prescan/status/{id}    — poll fremdrift
  GET  /prescan/files?dir=...  — hent cached metadata for filer i en katalog
"""

import json
import os
import sqlite3
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from utils.exif import extract_camera_fields, extract_gps, extract_taken_at, extract_exif
from utils.previews import generate_hotpreview, hotpreview_b64
from utils.registration import scan_directory

router = APIRouter(prefix="/prescan", tags=["prescan"])

_executor = ThreadPoolExecutor(max_workers=2)
_jobs: dict[str, dict] = {}
_cancel_events: dict[str, threading.Event] = {}
_db_lock = threading.Lock()


# ─── Cache-oppsett ────────────────────────────────────────────────────────────

def _db_path() -> Path:
    data_dir = os.environ.get("DATA_DIR")
    if data_dir:
        base = Path(data_dir)
    else:
        base = Path.home() / ".local" / "share" / "Hotprevue"
    base.mkdir(parents=True, exist_ok=True)
    return base / "prescan.db"


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_db_path()), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS prescan_cache (
            file_path      TEXT PRIMARY KEY,
            file_mtime     REAL NOT NULL,
            file_size      INTEGER NOT NULL,
            hothash        TEXT,
            hotpreview_b64 TEXT,
            taken_at       TEXT,
            camera_make    TEXT,
            camera_model   TEXT,
            gps_lat        REAL,
            gps_lng        REAL,
            width          INTEGER,
            height         INTEGER,
            companions_json TEXT,
            scanned_at     TEXT NOT NULL
        )
    """)
    try:
        conn.execute("ALTER TABLE prescan_cache ADD COLUMN orientation INTEGER")
    except sqlite3.OperationalError:
        pass  # Kolonnen finnes allerede
    conn.commit()
    return conn


# ─── Skjemaer ─────────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    dir: str


class JobStatus(BaseModel):
    id: str
    dir: str
    status: str
    done: int
    total: int
    error: str | None = None


class PrescanFileEntry(BaseModel):
    file_path: str
    master_type: str
    hothash: str | None
    hotpreview_b64: str | None
    taken_at: str | None
    camera_make: str | None
    camera_model: str | None
    gps_lat: float | None
    gps_lng: float | None
    width: int | None
    height: int | None
    companions: list[str]
    orientation: int | None = None


# ─── Endepunkter ──────────────────────────────────────────────────────────────

@router.post("/start", response_model=JobStatus, status_code=201)
def start_prescan(req: StartRequest) -> JobStatus:
    p = Path(req.dir)
    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=404, detail=f"Katalog finnes ikke: {req.dir}")

    job_id = str(uuid.uuid4())
    job: dict = {
        "id": job_id,
        "dir": req.dir,
        "status": "pending",
        "done": 0,
        "total": 0,
        "error": None,
    }
    _jobs[job_id] = job
    cancel_event = threading.Event()
    _cancel_events[job_id] = cancel_event
    _executor.submit(_run_prescan, job_id, cancel_event)
    return _to_status(job)


@router.get("/status/{job_id}", response_model=JobStatus)
def get_status(job_id: str) -> JobStatus:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Jobb ikke funnet")
    return _to_status(job)


@router.get("/files", response_model=list[PrescanFileEntry])
def get_files(dir: str = Query(...)) -> list[PrescanFileEntry]:
    """Returner cached metadata for alle bildegrupper i én katalog (ikke rekursivt)."""
    p = Path(dir)
    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=404, detail=f"Katalog finnes ikke: {dir}")

    groups, _ = scan_directory(str(p), recursive=False)

    result: list[PrescanFileEntry] = []
    # Bruk egen leseforbindelse — SQLite tillater samtidige lesere uten Python-lås
    conn = _get_conn()
    try:
        for group in groups:
            master_path = str(group.master)
            row = conn.execute(
                "SELECT * FROM prescan_cache WHERE file_path = ?", (master_path,)
            ).fetchone()

            stat = group.master.stat() if group.master.exists() else None
            cached = _row_valid(row, stat) and row is not None and row["hothash"] is not None
            companions = [str(c) for c in group.companions]

            if cached:
                result.append(PrescanFileEntry(
                    file_path=master_path,
                    master_type=_type_from_path(master_path),
                    hothash=row["hothash"],
                    hotpreview_b64=row["hotpreview_b64"],
                    taken_at=row["taken_at"],
                    camera_make=row["camera_make"],
                    camera_model=row["camera_model"],
                    gps_lat=row["gps_lat"],
                    gps_lng=row["gps_lng"],
                    width=row["width"],
                    height=row["height"],
                    companions=companions,
                    orientation=row["orientation"],
                ))
            else:
                result.append(PrescanFileEntry(
                    file_path=master_path,
                    master_type=_type_from_path(master_path),
                    hothash=None,
                    hotpreview_b64=None,
                    taken_at=None,
                    camera_make=None,
                    camera_model=None,
                    gps_lat=None,
                    gps_lng=None,
                    width=None,
                    height=None,
                    companions=companions,
                    orientation=None,
                ))
    finally:
        conn.close()

    return result


# ─── Bakgrunnsjobb ────────────────────────────────────────────────────────────

def _run_prescan(job_id: str, cancel_event: threading.Event) -> None:
    job = _jobs[job_id]
    job["status"] = "running"

    try:
        groups, _ = scan_directory(job["dir"], recursive=False)
        job["total"] = len(groups)

        conn = _get_conn()
        try:
            for group in groups:
                if cancel_event.is_set():
                    job["status"] = "cancelled"
                    return

                master_path = str(group.master)
                stat = group.master.stat() if group.master.exists() else None
                if stat is None:
                    job["done"] += 1
                    continue

                with _db_lock:
                    row = conn.execute(
                        "SELECT file_mtime, file_size, hothash FROM prescan_cache WHERE file_path = ?",
                        (master_path,),
                    ).fetchone()

                # Hopp over filen kun hvis cache-oppføringen er gyldig OG har preview
                if _row_valid(row, stat) and row["hothash"] is not None:
                    job["done"] += 1
                    continue

                # Prosesser filen
                try:
                    jpeg_bytes, hothash, width, height = generate_hotpreview(master_path)
                    preview_b64 = hotpreview_b64(jpeg_bytes)
                except Exception as e:
                    job["done"] += 1
                    continue  # Ikke cache feilede previews — prøv igjen ved neste prescan

                taken_at_str = None
                camera_make = None
                camera_model = None
                gps_lat = None
                gps_lng = None
                orientation = None
                try:
                    exif = extract_exif(master_path)
                    cam = extract_camera_fields(master_path)
                    dt = extract_taken_at(exif)
                    taken_at_str = dt.isoformat() if dt else None
                    lat, lng = extract_gps(exif)
                    gps_lat = lat
                    gps_lng = lng
                    camera_make = cam.get("camera_make")
                    camera_model = cam.get("camera_model")
                    orientation = exif.get("orientation")
                except Exception:
                    pass

                companions_json = json.dumps([str(c) for c in group.companions])
                now = datetime.now(timezone.utc).isoformat()

                with _db_lock:
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO prescan_cache
                            (file_path, file_mtime, file_size, hothash, hotpreview_b64,
                             taken_at, camera_make, camera_model, gps_lat, gps_lng,
                             width, height, companions_json, scanned_at, orientation)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        """,
                        (
                            master_path,
                            stat.st_mtime,
                            stat.st_size,
                            hothash,
                            preview_b64,
                            taken_at_str,
                            camera_make,
                            camera_model,
                            gps_lat,
                            gps_lng,
                            width,
                            height,
                            companions_json,
                            now,
                            orientation,
                        ),
                    )
                    conn.commit()

                job["done"] += 1

        finally:
            conn.close()

        job["status"] = "completed"

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
    finally:
        _cancel_events.pop(job_id, None)


# ─── Hjelpere ─────────────────────────────────────────────────────────────────

def _to_status(job: dict) -> JobStatus:
    return JobStatus(
        id=job["id"],
        dir=job["dir"],
        status=job["status"],
        done=job["done"],
        total=job["total"],
        error=job.get("error"),
    )


def _row_valid(row: sqlite3.Row | None, stat: os.stat_result | None) -> bool:
    if row is None or stat is None:
        return False
    return abs(row["file_mtime"] - stat.st_mtime) < 0.01 and row["file_size"] == stat.st_size


def _type_from_path(path: str) -> str:
    from utils.registration import file_type_from_suffix
    return file_type_from_suffix(Path(path).suffix.lower())


def remove_from_cache(path: str) -> None:
    """Fjern en fil fra prescan-cachen."""
    with _db_lock:
        conn = _get_conn()
        try:
            conn.execute("DELETE FROM prescan_cache WHERE file_path = ?", (path,))
            conn.commit()
        finally:
            conn.close()


def update_cache_path(old_path: str, new_path: str) -> None:
    """Oppdater fil-sti i cachen etter en flytt-operasjon."""
    with _db_lock:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT * FROM prescan_cache WHERE file_path = ?", (old_path,)
            ).fetchone()
            if row is None:
                return
            new_stat = Path(new_path).stat() if Path(new_path).exists() else None
            conn.execute("DELETE FROM prescan_cache WHERE file_path = ?", (old_path,))
            if new_stat:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO prescan_cache
                        (file_path, file_mtime, file_size, hothash, hotpreview_b64,
                         taken_at, camera_make, camera_model, gps_lat, gps_lng,
                         width, height, companions_json, scanned_at, orientation)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        new_path,
                        new_stat.st_mtime,
                        new_stat.st_size,
                        row["hothash"],
                        row["hotpreview_b64"],
                        row["taken_at"],
                        row["camera_make"],
                        row["camera_model"],
                        row["gps_lat"],
                        row["gps_lng"],
                        row["width"],
                        row["height"],
                        row["companions_json"],
                        row["scanned_at"],
                        row["orientation"],
                    ),
                )
            conn.commit()
        finally:
            conn.close()


def update_cache_after_rotate(path: str, hothash: str, hotpreview_b64_val: str, orientation: int) -> None:
    """Oppdater prescan-cache etter rotasjon — ny preview, hothash og orientering."""
    p = Path(path)
    stat = p.stat() if p.exists() else None
    with _db_lock:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT * FROM prescan_cache WHERE file_path = ?", (path,)
            ).fetchone()
            if row is None or stat is None:
                return
            conn.execute(
                """
                UPDATE prescan_cache
                SET hothash = ?, hotpreview_b64 = ?, orientation = ?,
                    file_mtime = ?, file_size = ?
                WHERE file_path = ?
                """,
                (hothash, hotpreview_b64_val, orientation, stat.st_mtime, stat.st_size, path),
            )
            conn.commit()
        finally:
            conn.close()
