import uuid
from datetime import datetime

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
