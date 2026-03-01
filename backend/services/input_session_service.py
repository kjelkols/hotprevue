"""InputSession service — create, check, register groups, complete."""

import hashlib
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.config import settings as app_settings
from models.input_session import InputSession, SessionError
from models.photo import DuplicateFile, ImageFile, Photo
from models.settings import SystemSettings
from schemas.input_session import (
    CheckRequest,
    CheckResponse,
    GroupMetadata,
    GroupResult,
    InputSessionCreate,
    ProcessResult,
)
from utils.exif import extract_camera_fields, extract_exif, extract_gps, extract_taken_at
from utils.previews import compute_perceptual_hashes, generate_coldpreview, generate_hotpreview, hotpreview_b64
from utils.registration import RAW_EXTENSIONS


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


def check(db: Session, session_id: uuid.UUID, data: CheckRequest) -> CheckResponse:
    """Return which master paths are already registered and which are new."""
    get_or_404(db, session_id)
    known_paths = {
        r[0]
        for r in db.query(ImageFile.file_path)
        .filter(ImageFile.file_path.in_(data.master_paths))
        .all()
    }
    known = [p for p in data.master_paths if p in known_paths]
    unknown = [p for p in data.master_paths if p not in known_paths]
    return CheckResponse(known=known, unknown=unknown)


def register_group_by_path(
    db: Session,
    session_id: uuid.UUID,
    meta: GroupMetadata,
) -> GroupResult:
    """Register directly from a local file path (no bytes transfer needed)."""
    file_bytes = Path(meta.master_path).read_bytes()
    return register_group(db, session_id, file_bytes, meta)


def register_group(
    db: Session,
    session_id: uuid.UUID,
    file_bytes: bytes,
    meta: GroupMetadata,
) -> GroupResult:
    """Register one file group. Returns GroupResult with status registered|duplicate|already_registered."""
    s = get_or_404(db, session_id)

    # Already registered by path?
    existing_file = (
        db.query(ImageFile).filter(ImageFile.file_path == meta.master_path).first()
    )
    if existing_file:
        photo = db.get(Photo, existing_file.photo_id)
        return GroupResult(
            status="already_registered",
            hothash=photo.hothash,
            photo_id=photo.id,
        )

    suffix = Path(meta.master_path).suffix or ".jpg"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        jpeg_bytes, hothash, orig_w, orig_h = generate_hotpreview(tmp_path)
        dct_hash, diff_hash = compute_perceptual_hashes(jpeg_bytes)

        # Duplicate by content?
        existing_photo = db.query(Photo).filter(Photo.hothash == hothash).first()
        if existing_photo:
            db.add(DuplicateFile(
                photo_id=existing_photo.id,
                file_path=meta.master_path,
                session_id=session_id,
            ))
            db.commit()
            _increment(db, session_id, duplicate_count=1)
            return GroupResult(
                status="duplicate",
                hothash=hothash,
                photo_id=existing_photo.id,
            )

        sys_settings = db.query(SystemSettings).first()
        max_px = sys_settings.coldpreview_max_px if sys_settings else 1200
        quality = sys_settings.coldpreview_quality if sys_settings else 85

        # --- EXIF extraction ---
        # Master EXIF is the primary source for Photo canonical fields.
        # With RAW-first master selection, this is already the richest source.
        master_exif = extract_exif(tmp_path)
        camera_fields = extract_camera_fields(tmp_path)
        taken_at = extract_taken_at(master_exif)
        lat, lng = extract_gps(master_exif)

        coldpreview_path = generate_coldpreview(
            tmp_path, hothash, app_settings.coldpreview_dir,
            max_px=max_px, quality=quality,
        )

        photographer_id = meta.photographer_id or s.default_photographer_id
        event_id = meta.event_id if meta.event_id is not None else s.default_event_id

        photo = Photo(
            hothash=hothash,
            hotpreview_b64=hotpreview_b64(jpeg_bytes),
            taken_at=taken_at,
            taken_at_source=0,
            taken_at_accuracy="second",
            location_lat=lat,
            location_lng=lng,
            location_source=0 if lat is not None else None,
            location_accuracy="exact" if lat is not None else None,
            photographer_id=photographer_id,
            input_session_id=session_id,
            event_id=event_id,
            width=orig_w,
            height=orig_h,
            dct_perceptual_hash=dct_hash,
            difference_hash=diff_hash,
            **camera_fields,
        )
        db.add(photo)
        db.flush()

        # Master ImageFile — dimensions from generate_hotpreview (actual pixel size)
        db.add(ImageFile(
            photo_id=photo.id,
            file_path=meta.master_path,
            file_type=meta.master_type,
            is_master=True,
            file_size_bytes=len(file_bytes),
            file_content_hash=hashlib.sha256(file_bytes).hexdigest(),
            exif_data=master_exif,
            width=orig_w,
            height=orig_h,
        ))

        # Companion ImageFiles — extract EXIF from each image file
        for comp in meta.companions:
            comp_exif: dict = {}
            comp_w: int | None = None
            comp_h: int | None = None

            if comp.type != "XMP":
                # Read EXIF from the actual companion file on disk
                try:
                    comp_exif = extract_exif(comp.path)
                    comp_w = comp_exif.get("width")
                    comp_h = comp_exif.get("height")
                except Exception:
                    pass

            comp_size: int | None = None
            comp_content_hash: str | None = None
            try:
                comp_bytes = Path(comp.path).read_bytes()
                comp_size = len(comp_bytes)
                comp_content_hash = hashlib.sha256(comp_bytes).hexdigest()
            except OSError:
                pass

            db.add(ImageFile(
                photo_id=photo.id,
                file_path=comp.path,
                file_type=comp.type,
                is_master=False,
                file_size_bytes=comp_size,
                file_content_hash=comp_content_hash,
                exif_data=comp_exif,
                width=comp_w,
                height=comp_h,
            ))

        db.commit()
        _increment(db, session_id, photo_count=1)

        # Mark session as uploading on first registration
        s = get_or_404(db, session_id)
        if s.status == "pending":
            s.status = "uploading"
            db.commit()

        return GroupResult(status="registered", hothash=hothash, photo_id=photo.id)

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        db.add(SessionError(
            session_id=session_id,
            file_path=meta.master_path,
            error=str(exc),
        ))
        db.commit()
        _increment(db, session_id, error_count=1)
        raise HTTPException(status_code=422, detail=str(exc))
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)


def complete(db: Session, session_id: uuid.UUID) -> ProcessResult:
    """Mark session as completed and return final counts."""
    s = get_or_404(db, session_id)
    if s.status != "completed":
        s.status = "completed"
        s.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(s)
    return ProcessResult(
        registered=s.photo_count,
        duplicates=s.duplicate_count,
        errors=s.error_count,
    )


def _increment(db: Session, session_id: uuid.UUID, **fields: int) -> None:
    """Atomically increment counter fields on InputSession."""
    from sqlalchemy import update

    db.execute(
        update(InputSession)
        .where(InputSession.id == session_id)
        .values(**{k: getattr(InputSession, k) + v for k, v in fields.items()})
    )
    db.commit()
