"""InputSession service — create, check, register groups, complete."""

import base64
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.config import settings as app_settings
from models.input_session import InputSession, SessionError
from models.photo import DuplicateFile, ImageFile, Photo
from schemas.input_session import (
    CheckHothashRequest,
    CheckHothashResponse,
    GroupPayload,
    GroupResult,
    InputSessionCreate,
    ProcessResult,
)


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


def check_hothashes(db: Session, data: CheckHothashRequest) -> CheckHothashResponse:
    """Return which hothashes are already registered and which are new.

    Call this after generating hotpreviews but before generating coldpreviews
    to skip expensive coldpreview generation for duplicates.
    """
    known_hashes = {
        r[0]
        for r in db.query(Photo.hothash)
        .filter(Photo.hothash.in_(data.hothashes))
        .all()
    }
    known = [h for h in data.hothashes if h in known_hashes]
    unknown = [h for h in data.hothashes if h not in known_hashes]
    return CheckHothashResponse(known=known, unknown=unknown)


def register_group(
    db: Session,
    session_id: uuid.UUID,
    payload: GroupPayload,
) -> GroupResult:
    """Register one image group from client-processed data.

    The client has already generated hotpreview, hothash, coldpreview, and
    extracted all EXIF. Backend stores the data and writes coldpreview to disk.
    """
    s = get_or_404(db, session_id)

    # Already registered by master path?
    existing_file = db.query(ImageFile).filter(ImageFile.file_path == payload.master_path).first()
    if existing_file:
        photo = db.get(Photo, existing_file.photo_id)
        return GroupResult(status="already_registered", hothash=photo.hothash, photo_id=photo.id)

    # Duplicate by content (hothash)?
    existing_photo = db.query(Photo).filter(Photo.hothash == payload.hothash).first()
    if existing_photo:
        db.add(DuplicateFile(
            photo_id=existing_photo.id,
            file_path=payload.master_path,
            session_id=session_id,
        ))
        db.commit()
        _increment(db, session_id, duplicate_count=1)
        return GroupResult(status="duplicate", hothash=payload.hothash, photo_id=existing_photo.id)

    try:
        _write_coldpreview(payload.hothash, payload.coldpreview_b64)

        photographer_id = payload.photographer_id or s.default_photographer_id
        event_id = payload.event_id if payload.event_id is not None else s.default_event_id

        photo = Photo(
            hothash=payload.hothash,
            hotpreview_b64=payload.hotpreview_b64,
            taken_at=payload.taken_at,
            taken_at_source=payload.taken_at_source,
            taken_at_accuracy=payload.taken_at_accuracy,
            location_lat=payload.location_lat,
            location_lng=payload.location_lng,
            location_source=payload.location_source,
            location_accuracy=payload.location_accuracy,
            camera_make=payload.camera_make,
            camera_model=payload.camera_model,
            lens_model=payload.lens_model,
            iso=payload.iso,
            shutter_speed=payload.shutter_speed,
            aperture=payload.aperture,
            focal_length=payload.focal_length,
            width=payload.width,
            height=payload.height,
            dct_perceptual_hash=payload.dct_perceptual_hash,
            difference_hash=payload.difference_hash,
            photographer_id=photographer_id,
            input_session_id=session_id,
            event_id=event_id,
        )
        db.add(photo)
        db.flush()

        db.add(ImageFile(
            photo_id=photo.id,
            file_path=payload.master_path,
            file_type=payload.master_type,
            is_master=True,
            file_size_bytes=payload.master_size_bytes,
            file_content_hash=payload.master_content_hash,
            exif_data=payload.master_exif,
            width=payload.width,
            height=payload.height,
        ))

        for comp in payload.companions:
            db.add(ImageFile(
                photo_id=photo.id,
                file_path=comp.path,
                file_type=comp.type,
                is_master=False,
                file_size_bytes=comp.file_size_bytes,
                file_content_hash=comp.file_content_hash,
                exif_data=comp.exif_data,
                width=comp.width,
                height=comp.height,
            ))

        db.commit()
        _increment(db, session_id, photo_count=1)

        s = get_or_404(db, session_id)
        if s.status == "pending":
            s.status = "uploading"
            db.commit()

        return GroupResult(status="registered", hothash=payload.hothash, photo_id=photo.id)

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        db.add(SessionError(
            session_id=session_id,
            file_path=payload.master_path,
            error=str(exc),
        ))
        db.commit()
        _increment(db, session_id, error_count=1)
        raise HTTPException(status_code=422, detail=str(exc))


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


def _write_coldpreview(hothash: str, coldpreview_b64: str) -> None:
    """Decode and write coldpreview JPEG to disk at the canonical path."""
    coldpreview_bytes = base64.b64decode(coldpreview_b64)
    coldpreview_path = Path(app_settings.coldpreview_dir) / hothash[:2] / hothash[2:4] / f"{hothash}.jpg"
    coldpreview_path.parent.mkdir(parents=True, exist_ok=True)
    coldpreview_path.write_bytes(coldpreview_bytes)


def _increment(db: Session, session_id: uuid.UUID, **fields: int) -> None:
    """Atomically increment counter fields on InputSession."""
    from sqlalchemy import update

    db.execute(
        update(InputSession)
        .where(InputSession.id == session_id)
        .values(**{k: getattr(InputSession, k) + v for k, v in fields.items()})
    )
    db.commit()
