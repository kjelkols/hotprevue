"""InputSession service — create, scan, process."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.config import settings as app_settings
from models.input_session import InputSession, SessionError
from models.photo import DuplicateFile, ImageFile, Photo
from models.settings import SystemSettings
from schemas.input_session import InputSessionCreate, ProcessResult, ScanSummary
from utils.exif import extract_camera_fields, extract_exif, extract_gps, extract_taken_at
from utils.previews import generate_coldpreview, generate_hotpreview, hotpreview_b64
from utils.registration import KNOWN_EXTENSIONS, SIDECAR_EXTENSIONS, file_type_from_suffix, scan_directory


def create(db: Session, data: InputSessionCreate) -> InputSession:
    from models.event import Event
    from models.photographer import Photographer

    if db.get(Photographer, data.default_photographer_id) is None:
        raise HTTPException(status_code=404, detail="Photographer not found")
    if data.default_event_id and db.get(Event, data.default_event_id) is None:
        raise HTTPException(status_code=404, detail="Event not found")

    session = InputSession(**data.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_or_404(db: Session, session_id: uuid.UUID) -> InputSession:
    s = db.get(InputSession, session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Input session not found")
    return s


def list_all(db: Session) -> list[InputSession]:
    return db.query(InputSession).order_by(InputSession.started_at.desc()).all()


def list_photos(db: Session, session_id: uuid.UUID) -> list[Photo]:
    get_or_404(db, session_id)
    return (
        db.query(Photo)
        .filter(Photo.input_session_id == session_id)
        .order_by(Photo.registered_at)
        .all()
    )


def list_errors(db: Session, session_id: uuid.UUID) -> list[SessionError]:
    get_or_404(db, session_id)
    return db.query(SessionError).filter(SessionError.session_id == session_id).all()


def delete(db: Session, session_id: uuid.UUID) -> None:
    s = get_or_404(db, session_id)
    db.delete(s)
    db.commit()


def scan(db: Session, session_id: uuid.UUID) -> ScanSummary:
    """Scan source directory and return a summary without registering anything."""
    s = get_or_404(db, session_id)
    s.status = "scanning"
    db.commit()

    try:
        groups, unknown_count = scan_directory(s.source_path, s.recursive)
    except Exception as exc:
        s.status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc))

    known_paths = {r[0] for r in db.query(ImageFile.file_path).all()}

    raw_jpeg = sum(1 for g in groups if g.has_raw and g.has_jpeg)
    raw_only = sum(1 for g in groups if g.has_raw and not g.has_jpeg)
    jpeg_only = sum(1 for g in groups if not g.has_raw)
    already = sum(1 for g in groups if str(g.master) in known_paths)

    s.status = "awaiting_confirmation"
    db.commit()

    return ScanSummary(
        total_groups=len(groups),
        raw_jpeg_pairs=raw_jpeg,
        raw_only=raw_only,
        jpeg_only=jpeg_only,
        already_registered=already,
        unknown_files=unknown_count,
    )


def process(db: Session, session_id: uuid.UUID) -> ProcessResult:
    """Register all files in the source directory."""
    s = get_or_404(db, session_id)
    s.status = "processing"
    db.commit()

    sys = db.query(SystemSettings).first()
    max_px = sys.coldpreview_max_px if sys else 1200
    quality = sys.coldpreview_quality if sys else 85
    coldpreview_dir = app_settings.coldpreview_dir

    try:
        groups, _ = scan_directory(s.source_path, s.recursive)
    except Exception as exc:
        s.status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail=str(exc))

    known_paths = {r[0] for r in db.query(ImageFile.file_path).all()}

    photo_count = 0
    duplicate_count = 0
    error_count = 0

    for group in groups:
        master_path = str(group.master)

        if master_path in known_paths:
            continue  # Already registered — skip silently

        try:
            jpeg_bytes, hothash = generate_hotpreview(master_path)

            # Duplicate check by hothash
            existing = db.query(Photo).filter(Photo.hothash == hothash).first()
            if existing:
                db.add(DuplicateFile(
                    photo_id=existing.id,
                    file_path=master_path,
                    session_id=session_id,
                ))
                db.commit()
                duplicate_count += 1
                continue

            exif_data = extract_exif(master_path)
            camera_fields = extract_camera_fields(master_path)
            taken_at = extract_taken_at(exif_data)
            lat, lng = extract_gps(exif_data)

            coldpreview_path = generate_coldpreview(
                master_path, hothash, coldpreview_dir,
                max_px=max_px, quality=quality,
            )

            photo = Photo(
                hothash=hothash,
                hotpreview_b64=hotpreview_b64(jpeg_bytes),
                coldpreview_path=coldpreview_path,
                exif_data=exif_data,
                taken_at=taken_at,
                taken_at_source=0,
                taken_at_accuracy="second",
                location_lat=lat,
                location_lng=lng,
                location_source=0 if lat is not None else None,
                location_accuracy="exact" if lat is not None else None,
                photographer_id=s.default_photographer_id,
                input_session_id=session_id,
                event_id=s.default_event_id,
                **camera_fields,
            )
            db.add(photo)
            db.flush()

            # Master ImageFile
            db.add(ImageFile(
                photo_id=photo.id,
                file_path=master_path,
                file_type=file_type_from_suffix(group.master.suffix.lower()),
                is_master=True,
            ))

            # Companion ImageFiles (skip unknown extensions)
            for companion in group.companions:
                c_suffix = companion.suffix.lower()
                if c_suffix in KNOWN_EXTENSIONS:
                    db.add(ImageFile(
                        photo_id=photo.id,
                        file_path=str(companion),
                        file_type=file_type_from_suffix(c_suffix),
                        is_master=False,
                    ))

            db.commit()
            photo_count += 1

        except Exception as exc:
            db.rollback()
            s = db.get(InputSession, session_id)  # re-fetch after rollback
            db.add(SessionError(
                session_id=session_id,
                file_path=master_path,
                error=str(exc),
            ))
            db.commit()
            error_count += 1

    s.photo_count = photo_count
    s.duplicate_count = duplicate_count
    s.error_count = error_count
    s.status = "completed"
    s.completed_at = datetime.now(timezone.utc)
    db.commit()

    return ProcessResult(registered=photo_count, duplicates=duplicate_count, errors=error_count)
