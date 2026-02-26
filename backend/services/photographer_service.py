import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.photographer import Photographer
from schemas.photographer import PhotographerCreate, PhotographerPatch


def create(db: Session, data: PhotographerCreate) -> Photographer:
    photographer = Photographer(**data.model_dump())
    db.add(photographer)
    db.commit()
    db.refresh(photographer)
    return photographer


def list_all(db: Session) -> list[Photographer]:
    return db.query(Photographer).order_by(Photographer.name).all()


def get_or_404(db: Session, photographer_id: uuid.UUID) -> Photographer:
    p = db.get(Photographer, photographer_id)
    if p is None:
        raise HTTPException(status_code=404, detail="Photographer not found")
    return p


def patch(db: Session, photographer_id: uuid.UUID, data: PhotographerPatch) -> Photographer:
    p = get_or_404(db, photographer_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return p


def delete(db: Session, photographer_id: uuid.UUID) -> None:
    from models.photo import Photo
    p = get_or_404(db, photographer_id)
    if p.is_unknown:
        raise HTTPException(status_code=409, detail="Cannot delete the unknown photographer placeholder")
    photo_count = db.query(Photo).filter(Photo.photographer_id == photographer_id).count()
    if photo_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Photographer has {photo_count} photo(s) — reassign them first",
        )
    db.delete(p)
    db.commit()
