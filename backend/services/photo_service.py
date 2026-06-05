import base64
import io
import math
import uuid
from datetime import datetime, timezone
from pathlib import Path

import piexif

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from models.photo import ImageFile, Photo, PhotoCorrection
from schemas.input_session import CheckHothashRequest, CheckHothashResponse
from schemas.photo import PerceptualHashComputeResult


def check_hothashes(db: Session, data: CheckHothashRequest) -> CheckHothashResponse:
    known_hashes = {
        r[0]
        for r in db.query(Photo.hothash)
        .filter(Photo.hothash.in_(data.hothashes))
        .all()
    }
    known = [h for h in data.hothashes if h in known_hashes]
    unknown = [h for h in data.hothashes if h not in known_hashes]
    return CheckHothashResponse(known=known, unknown=unknown)


def list_photos(
    db: Session,
    *,
    hothashes: list[str] | None = None,
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

    if hothashes:
        q = q.filter(Photo.hothash.in_(hothashes))
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
    """Return (image_bytes, etag) for the coldpreview with embedded EXIF.

    Corrections are applied in order: rotation → horizon → crop → exposure.
    The original coldpreview on disk is never modified.
    """
    from core.config import settings as app_settings
    from models.photographer import Photographer

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

    photographer_name = ""
    if photo.photographer_id:
        p = db.query(Photographer).filter(Photographer.id == photo.photographer_id).first()
        if p and not p.is_unknown:
            photographer_name = p.name

    c = photo.correction
    img = _open_and_correct(coldpreview_file, c)
    exif_bytes = _build_exif_bytes(photo, photographer_name, c)
    image_bytes = _encode_jpeg(img, exif_bytes)

    etag = hothash if c is None else f"{hothash}-{c.updated_at.timestamp()}"
    return image_bytes, etag


def _crop_horizon(img, orig_w: int, orig_h: int, angle_deg: float):
    """Crop to remove black corners after horizon rotation."""
    a = math.radians(abs(angle_deg))
    tan_a = math.tan(a)
    new_w = max(1, int(orig_w - orig_h * tan_a))
    new_h = max(1, int(orig_h - orig_w * tan_a))
    ew, eh = img.size
    left = (ew - new_w) // 2
    top = (eh - new_h) // 2
    return img.crop((left, top, left + new_w, top + new_h))


def _open_and_correct(coldpreview_file, c):
    """Open coldpreview and apply PhotoCorrection pipeline (if any)."""
    from PIL import Image, ImageEnhance

    img = Image.open(coldpreview_file)
    if c is None:
        return img

    if c.rotation:
        img = img.rotate(-c.rotation, expand=True)
    if c.flip_horizontal:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if c.horizon_angle:
        orig_w, orig_h = img.size
        img = img.rotate(-c.horizon_angle, expand=True, resample=Image.BICUBIC)
        img = _crop_horizon(img, orig_w, orig_h, c.horizon_angle)
    if any(v is not None for v in [c.crop_left, c.crop_top, c.crop_right, c.crop_bottom]):
        w, h = img.size
        left = int((c.crop_left or 0.0) * w)
        top = int((c.crop_top or 0.0) * h)
        right = int(w - (c.crop_right or 0.0) * w)
        bottom = int(h - (c.crop_bottom or 0.0) * h)
        img = img.crop((left, top, right, bottom))
    if c.exposure_ev:
        img = ImageEnhance.Brightness(img).enhance(2.0 ** c.exposure_ev)
    return img


def _build_exif_bytes(photo, photographer_name: str, c) -> bytes:
    exif_0th: dict = {
        piexif.ImageIFD.Software: b"Hotprevue",
        piexif.ImageIFD.ImageDescription: f"hothash:{photo.hothash}".encode(),
    }
    if photo.camera_make:
        exif_0th[piexif.ImageIFD.Make] = photo.camera_make.encode()
    if photo.camera_model:
        exif_0th[piexif.ImageIFD.Model] = photo.camera_model.encode()
    if photographer_name:
        exif_0th[piexif.ImageIFD.Artist] = photographer_name.encode()
        exif_0th[piexif.ImageIFD.Copyright] = photographer_name.encode()

    exif_exif: dict = {}
    if photo.taken_at:
        dt_str = photo.taken_at.strftime("%Y:%m:%d %H:%M:%S").encode()
        exif_exif[piexif.ExifIFD.DateTimeOriginal] = dt_str
        exif_exif[piexif.ExifIFD.DateTimeDigitized] = dt_str
    if photo.lens_model:
        exif_exif[piexif.ExifIFD.LensModel] = photo.lens_model.encode()
    if photo.iso:
        exif_exif[piexif.ExifIFD.ISOSpeedRatings] = photo.iso
    if photo.aperture:
        exif_exif[piexif.ExifIFD.FNumber] = (int(photo.aperture * 100), 100)
    if photo.focal_length:
        exif_exif[piexif.ExifIFD.FocalLength] = (int(photo.focal_length * 10), 10)
    if photo.shutter_speed:
        rational = _shutter_to_rational(photo.shutter_speed)
        if rational:
            exif_exif[piexif.ExifIFD.ExposureTime] = rational

    user_comment = _build_user_comment(c)
    exif_exif[piexif.ExifIFD.UserComment] = (
        b"ASCII\x00\x00\x00" + user_comment.encode("ascii", errors="replace")
    )

    exif_gps: dict = {}
    if photo.location_lat is not None and photo.location_lng is not None:
        exif_gps = _build_gps_ifd(photo.location_lat, photo.location_lng)

    return piexif.dump({"0th": exif_0th, "Exif": exif_exif, "GPS": exif_gps})


def _encode_jpeg(img, exif_bytes: bytes, quality: int = 85) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, exif=exif_bytes)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Download (JPEG with optional downscale, Content-Disposition attachment)
# ---------------------------------------------------------------------------

_SIZE_LIMITS = {"full": None, "medium": 1200, "small": 600}


def build_download(db: Session, hothash: str, size: str) -> tuple[bytes, str]:
    """Return (jpeg_bytes, suggested_filename) for a downloadable image."""
    from PIL import Image
    from core.config import settings as app_settings
    from models.photographer import Photographer

    max_px = _SIZE_LIMITS.get(size)

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

    photographer_name = ""
    if photo.photographer_id:
        p = db.query(Photographer).filter(Photographer.id == photo.photographer_id).first()
        if p and not p.is_unknown:
            photographer_name = p.name

    c = photo.correction
    img = _open_and_correct(coldpreview_file, c)

    if max_px is not None:
        w, h = img.size
        if max(w, h) > max_px:
            scale = max_px / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    exif_bytes = _build_exif_bytes(photo, photographer_name, c)
    return _encode_jpeg(img, exif_bytes), f"{hothash}.jpg"


def _build_user_comment(c) -> str:
    parts = ["Hotprevue"]
    if c is not None:
        corrections = []
        if c.rotation:
            corrections.append(f"rotation={c.rotation}")
        if c.flip_horizontal:
            corrections.append("flip_horizontal")
        if c.horizon_angle:
            corrections.append(f"horizon_angle={c.horizon_angle:.2f}")
        if c.exposure_ev:
            sign = "+" if c.exposure_ev > 0 else ""
            corrections.append(f"exposure_ev={sign}{c.exposure_ev:.2f}")
        if any(v is not None for v in [c.crop_left, c.crop_top, c.crop_right, c.crop_bottom]):
            corrections.append("cropped")
        if corrections:
            parts.append("corrections:" + ",".join(corrections))
    return "|".join(parts)


def _shutter_to_rational(shutter_speed: str) -> tuple[int, int] | None:
    """Convert shutter speed string (e.g. '1/250', '2') to piexif rational tuple."""
    try:
        if "/" in shutter_speed:
            num, den = shutter_speed.split("/")
            return int(num), int(den)
        val = float(shutter_speed)
        return int(val * 1000), 1000
    except (ValueError, AttributeError):
        return None


def _build_gps_ifd(lat: float, lng: float) -> dict:
    def to_dms(deg: float) -> tuple[tuple, tuple, tuple]:
        d = int(abs(deg))
        m = int((abs(deg) - d) * 60)
        s = round(((abs(deg) - d) * 60 - m) * 60 * 100)
        return (d, 1), (m, 1), (s, 100)

    return {
        piexif.GPSIFD.GPSLatitudeRef: b"N" if lat >= 0 else b"S",
        piexif.GPSIFD.GPSLatitude: to_dms(lat),
        piexif.GPSIFD.GPSLongitudeRef: b"E" if lng >= 0 else b"W",
        piexif.GPSIFD.GPSLongitude: to_dms(lng),
    }


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


def update_correction(db: Session, hothash: str, data) -> Photo:
    photo = (
        db.query(Photo)
        .options(selectinload(Photo.correction), selectinload(Photo.image_files))
        .filter(Photo.hothash == hothash)
        .first()
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        return photo

    if photo.correction is None:
        photo.correction = PhotoCorrection(photo_id=photo.id)
        db.add(photo.correction)

    for field, value in updates.items():
        setattr(photo.correction, field, value)

    photo.correction.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(photo)
    return photo


def delete_correction(db: Session, hothash: str) -> None:
    photo = (
        db.query(Photo)
        .options(selectinload(Photo.correction))
        .filter(Photo.hothash == hothash)
        .first()
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.correction is not None:
        db.delete(photo.correction)
        db.commit()


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
# Perceptual hashes
# ---------------------------------------------------------------------------

def compute_perceptual_hashes_for_all(db: Session) -> PerceptualHashComputeResult:
    """Compute dct_perceptual_hash and difference_hash for photos that lack them.

    Reads hotpreview_b64 from the database — no original files needed.
    """
    from utils.previews import compute_perceptual_hashes

    photos = (
        db.query(Photo)
        .filter(
            (Photo.dct_perceptual_hash.is_(None)) | (Photo.difference_hash.is_(None))
        )
        .all()
    )

    updated = 0
    for photo in photos:
        try:
            jpeg_bytes = base64.b64decode(photo.hotpreview_b64)
            dct_hash, diff_hash = compute_perceptual_hashes(jpeg_bytes)
            photo.dct_perceptual_hash = dct_hash
            photo.difference_hash = diff_hash
            updated += 1
        except Exception:
            pass

    if updated:
        db.commit()

    total = db.query(Photo).count()
    return PerceptualHashComputeResult(updated=updated, already_computed=total - updated)


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
    from sqlalchemy import asc, desc, func, nulls_last

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
        case "random":
            return q.order_by(func.random())
        case _:  # taken_at_desc (default)
            return q.order_by(nulls_last(desc(Photo.taken_at)), secondary)
