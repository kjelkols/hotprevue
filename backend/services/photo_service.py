import io
import math
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from models.photo import ImageFile, Photo


def list_photos(
    db: Session,
    *,
    photographer_id: uuid.UUID | None = None,
    event_id: uuid.UUID | None = None,
    session_id: uuid.UUID | None = None,
    tags: list[str] | None = None,
    category_id: uuid.UUID | None = None,
    in_stream: bool | None = None,
    rating_min: int | None = None,
    rating_max: int | None = None,
    taken_after: datetime | None = None,
    taken_before: datetime | None = None,
    deleted: bool = False,
    sort: str = "taken_at_desc",
    limit: int = 100,
    offset: int = 0,
) -> list[Photo]:
    q = db.query(Photo).options(selectinload(Photo.correction))

    if deleted:
        q = q.filter(Photo.deleted_at.isnot(None))
    else:
        q = q.filter(Photo.deleted_at.is_(None))

    if photographer_id:
        q = q.filter(Photo.photographer_id == photographer_id)
    if event_id:
        q = q.filter(Photo.event_id == event_id)
    if session_id:
        q = q.filter(Photo.input_session_id == session_id)
    if tags:
        for tag in tags:
            q = q.filter(Photo.tags.contains([tag]))
    if category_id:
        q = q.filter(Photo.category_id == category_id)
    if in_stream is True:
        from models.category import Category
        excluded = (
            db.query(Category.id)
            .filter(Category.excluded_from_stream.is_(True))
            .subquery()
        )
        q = q.filter(
            (Photo.category_id.is_(None)) | (Photo.category_id.notin_(excluded))
        )
    if rating_min is not None:
        q = q.filter(Photo.rating >= rating_min)
    if rating_max is not None:
        q = q.filter(Photo.rating <= rating_max)
    if taken_after:
        q = q.filter(Photo.taken_at >= taken_after)
    if taken_before:
        q = q.filter(Photo.taken_at <= taken_before)

    q = _apply_sort(q, sort)
    return q.offset(offset).limit(limit).all()


def get_by_hothash(db: Session, hothash: str) -> Photo:
    photo = (
        db.query(Photo)
        .options(selectinload(Photo.correction), selectinload(Photo.image_files))
        .filter(Photo.hothash == hothash)
        .first()
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo


def get_image_files(db: Session, hothash: str) -> list[ImageFile]:
    photo = db.query(Photo).filter(Photo.hothash == hothash).first()
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return db.query(ImageFile).filter(ImageFile.photo_id == photo.id).all()


# ---------------------------------------------------------------------------
# Coldpreview serving
# ---------------------------------------------------------------------------

def serve_coldpreview(db: Session, hothash: str) -> tuple[bytes, str]:
    """Return (image_bytes, etag) for the coldpreview, applying any correction on-the-fly.

    Corrections are applied in order: rotation → horizon → crop → exposure.
    The original coldpreview on disk is never modified.
    """
    from core.config import settings as app_settings
    from PIL import Image, ImageEnhance

    photo = (
        db.query(Photo)
        .options(selectinload(Photo.correction))
        .filter(Photo.hothash == hothash)
        .first()
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")

    coldpreview_file = (
        Path(app_settings.coldpreview_dir) / hothash[:2] / hothash[2:4] / f"{hothash}.jpg"
    )
    if not coldpreview_file.exists():
        raise HTTPException(status_code=404, detail="Coldpreview not found")

    if photo.correction is None:
        return coldpreview_file.read_bytes(), hothash

    c = photo.correction
    img = Image.open(coldpreview_file)

    # 1. 90 / 180 / 270 degree rotation
    if c.rotation:
        img = img.rotate(-c.rotation, expand=True)

    # 2. Horizon correction (fine rotation to level the horizon)
    if c.horizon_angle:
        orig_w, orig_h = img.size
        img = img.rotate(-c.horizon_angle, expand=True, resample=Image.BICUBIC)
        img = _crop_horizon(img, orig_w, orig_h, c.horizon_angle)

    # 3. User crop (proportional 0.0–1.0 coordinates)
    if any(v is not None for v in [c.crop_left, c.crop_top, c.crop_right, c.crop_bottom]):
        w, h = img.size
        left = int((c.crop_left or 0.0) * w)
        top = int((c.crop_top or 0.0) * h)
        right = int(w - (c.crop_right or 0.0) * w)
        bottom = int(h - (c.crop_bottom or 0.0) * h)
        img = img.crop((left, top, right, bottom))

    # 4. Exposure EV (log2 scale brightness)
    if c.exposure_ev:
        img = ImageEnhance.Brightness(img).enhance(2.0 ** c.exposure_ev)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    etag = f"{hothash}-{c.updated_at.timestamp()}"
    return buf.getvalue(), etag


def _crop_horizon(img, orig_w: int, orig_h: int, angle_deg: float):
    """Crop to remove black corners after horizon rotation.

    Computes the largest centered rectangle (using original dimensions)
    that fits inside the expanded rotated image without black pixels.
    """
    a = math.radians(abs(angle_deg))
    tan_a = math.tan(a)
    new_w = max(1, int(orig_w - orig_h * tan_a))
    new_h = max(1, int(orig_h - orig_w * tan_a))
    ew, eh = img.size
    left = (ew - new_w) // 2
    top = (eh - new_h) // 2
    return img.crop((left, top, left + new_w, top + new_h))


# ---------------------------------------------------------------------------
# PATCH single photo
# ---------------------------------------------------------------------------

def patch_photo(db: Session, hothash: str, data) -> Photo:
    photo = get_by_hothash(db, hothash)
    updates = data.model_dump(exclude_unset=True)
    if "tags" in updates and updates["tags"] is not None:
        updates["tags"] = [t.lower() for t in updates["tags"]]
    for field, value in updates.items():
        setattr(photo, field, value)
    db.commit()
    db.refresh(photo)
    return photo


# ---------------------------------------------------------------------------
# Soft delete / restore / empty-trash
# ---------------------------------------------------------------------------

def soft_delete(db: Session, hothash: str) -> None:
    photo = db.query(Photo).filter(Photo.hothash == hothash).first()
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    photo.deleted_at = datetime.now(timezone.utc)
    db.commit()


def restore(db: Session, hothash: str) -> None:
    photo = db.query(Photo).filter(Photo.hothash == hothash).first()
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    photo.deleted_at = None
    db.commit()


def empty_trash(db: Session) -> int:
    photos = db.query(Photo).filter(Photo.deleted_at.isnot(None)).all()
    count = len(photos)
    for photo in photos:
        db.delete(photo)
    db.commit()
    return count


# ---------------------------------------------------------------------------
# Batch helpers
# ---------------------------------------------------------------------------

def _get_batch(db: Session, hothashes: list[str]) -> list[Photo]:
    return db.query(Photo).filter(Photo.hothash.in_(hothashes)).all()


def batch_tags_add(db: Session, hothashes: list[str], tags: list[str]) -> int:
    from sqlalchemy import func as sa_func
    normalized = [t.lower() for t in tags]
    photos = _get_batch(db, hothashes)
    for photo in photos:
        existing = set(photo.tags or [])
        photo.tags = list(existing | set(normalized))
    db.commit()
    return len(photos)


def batch_tags_remove(db: Session, hothashes: list[str], tags: list[str]) -> int:
    normalized = set(t.lower() for t in tags)
    photos = _get_batch(db, hothashes)
    for photo in photos:
        photo.tags = [t for t in (photo.tags or []) if t not in normalized]
    db.commit()
    return len(photos)


def batch_tags_set(db: Session, hothashes: list[str], tags: list[str]) -> int:
    normalized = [t.lower() for t in tags]
    photos = _get_batch(db, hothashes)
    for photo in photos:
        photo.tags = normalized
    db.commit()
    return len(photos)


def batch_rating(db: Session, hothashes: list[str], rating: int | None) -> int:
    photos = _get_batch(db, hothashes)
    for photo in photos:
        photo.rating = rating
    db.commit()
    return len(photos)


def batch_event(db: Session, hothashes: list[str], event_id: uuid.UUID | None) -> int:
    photos = _get_batch(db, hothashes)
    for photo in photos:
        photo.event_id = event_id
    db.commit()
    return len(photos)


def batch_category(db: Session, hothashes: list[str], category_id: uuid.UUID | None) -> int:
    photos = _get_batch(db, hothashes)
    for photo in photos:
        photo.category_id = category_id
    db.commit()
    return len(photos)


def batch_photographer(db: Session, hothashes: list[str], photographer_id: uuid.UUID) -> int:
    photos = _get_batch(db, hothashes)
    for photo in photos:
        photo.photographer_id = photographer_id
    db.commit()
    return len(photos)


def batch_taken_at(db: Session, hothashes: list[str], taken_at: datetime, taken_at_source: int) -> int:
    photos = _get_batch(db, hothashes)
    for photo in photos:
        photo.taken_at = taken_at
        photo.taken_at_source = taken_at_source
    db.commit()
    return len(photos)


def batch_taken_at_offset(db: Session, hothashes: list[str], offset_seconds: int) -> int:
    from datetime import timedelta
    photos = _get_batch(db, hothashes)
    updated = 0
    for photo in photos:
        if photo.taken_at is not None:
            photo.taken_at = photo.taken_at + timedelta(seconds=offset_seconds)
            photo.taken_at_source = 1  # adjusted
            updated += 1
    db.commit()
    return updated


def batch_location(
    db: Session,
    hothashes: list[str],
    location_lat: float,
    location_lng: float,
    location_source: int,
    location_accuracy: str | None,
) -> int:
    photos = _get_batch(db, hothashes)
    for photo in photos:
        photo.location_lat = location_lat
        photo.location_lng = location_lng
        photo.location_source = location_source
        photo.location_accuracy = location_accuracy
    db.commit()
    return len(photos)


def batch_delete(db: Session, hothashes: list[str]) -> int:
    photos = _get_batch(db, hothashes)
    now = datetime.now(timezone.utc)
    for photo in photos:
        photo.deleted_at = now
    db.commit()
    return len(photos)


def batch_restore(db: Session, hothashes: list[str]) -> int:
    photos = _get_batch(db, hothashes)
    for photo in photos:
        photo.deleted_at = None
    db.commit()
    return len(photos)


# ---------------------------------------------------------------------------
# Companions
# ---------------------------------------------------------------------------

def add_companion(db: Session, hothash: str, data) -> ImageFile:
    photo = db.query(Photo).filter(Photo.hothash == hothash).first()
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    existing = db.query(ImageFile).filter(ImageFile.file_path == data.path).first()
    if existing:
        raise HTTPException(status_code=409, detail="File path already registered")
    companion = ImageFile(
        photo_id=photo.id,
        file_path=data.path,
        file_type=data.type,
        is_master=False,
    )
    db.add(companion)
    db.commit()
    db.refresh(companion)
    return companion


# ---------------------------------------------------------------------------
# Sorting
# ---------------------------------------------------------------------------

def _apply_sort(q, sort: str):
    from sqlalchemy import asc, desc, nulls_last

    secondary = asc(Photo.registered_at)

    match sort:
        case "taken_at_asc":
            return q.order_by(nulls_last(asc(Photo.taken_at)), secondary)
        case "registered_at_desc":
            return q.order_by(desc(Photo.registered_at))
        case "registered_at_asc":
            return q.order_by(asc(Photo.registered_at))
        case "rating_desc":
            return q.order_by(nulls_last(desc(Photo.rating)), secondary)
        case "rating_asc":
            return q.order_by(nulls_last(asc(Photo.rating)), secondary)
        case _:  # taken_at_desc (default)
            return q.order_by(nulls_last(desc(Photo.taken_at)), secondary)
