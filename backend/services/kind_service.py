import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.kind import Kind
from schemas.kind import KindCreate, KindPatch


def get_default(db: Session) -> Kind:
    k = db.query(Kind).filter(Kind.is_default == True).first()
    if k is None:
        raise HTTPException(status_code=500, detail="Standard kind mangler i databasen")
    return k


def create(db: Session, data: KindCreate) -> Kind:
    kind = Kind(**data.model_dump())
    db.add(kind)
    db.commit()
    db.refresh(kind)
    return kind


def list_all(db: Session) -> list[Kind]:
    return db.query(Kind).order_by(Kind.sort_order, Kind.name).all()


def get_or_404(db: Session, kind_id: uuid.UUID) -> Kind:
    k = db.get(Kind, kind_id)
    if k is None:
        raise HTTPException(status_code=404, detail="Kind ikke funnet")
    return k


def patch(db: Session, kind_id: uuid.UUID, data: KindPatch) -> Kind:
    k = get_or_404(db, kind_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(k, field, value)
    db.commit()
    db.refresh(k)
    return k


def delete(db: Session, kind_id: uuid.UUID) -> None:
    from models.event import Event
    from models.photo import Photo

    k = get_or_404(db, kind_id)
    if k.is_default:
        raise HTTPException(status_code=409, detail="Standard kind kan ikke slettes")

    default = get_default(db)
    event_count = db.query(Event).filter(Event.kind_id == kind_id).count()
    photo_count = db.query(Photo).filter(Photo.kind_id == kind_id).count()

    db.query(Event).filter(Event.kind_id == kind_id).update({"kind_id": default.id})
    db.query(Photo).filter(Photo.kind_id == kind_id).update({"kind_id": default.id})

    db.delete(k)
    db.commit()

    return {"event_count": event_count, "photo_count": photo_count}
