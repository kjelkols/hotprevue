import uuid

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.machine import Machine
from models.photographer import Photographer
from schemas.photographer import PhotographerCreate, PhotographerOut, PhotographerPatch


def create(db: Session, data: PhotographerCreate) -> Photographer:
    photographer = Photographer(**data.model_dump())
    db.add(photographer)
    db.commit()
    db.refresh(photographer)
    return photographer


def list_all(db: Session) -> list[PhotographerOut]:
    machine_stats = (
        db.query(
            Machine.photographer_id,
            func.count(Machine.machine_id).label("machine_count"),
            func.max(Machine.last_seen_at).label("last_seen_at"),
        )
        .group_by(Machine.photographer_id)
        .subquery()
    )

    rows = (
        db.query(
            Photographer,
            func.coalesce(machine_stats.c.machine_count, 0).label("machine_count"),
            machine_stats.c.last_seen_at,
        )
        .outerjoin(machine_stats, machine_stats.c.photographer_id == Photographer.id)
        .order_by(Photographer.name)
        .all()
    )

    result = []
    for p, machine_count, last_seen_at in rows:
        out = PhotographerOut.model_validate(p)
        out.machine_count = machine_count
        out.last_seen_at = last_seen_at
        result.append(out)
    return result


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
