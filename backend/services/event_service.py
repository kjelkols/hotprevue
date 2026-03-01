import uuid

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.event import Event
from models.photo import Photo
from schemas.event import EventCreate, EventOut, EventPatch


def create(db: Session, data: EventCreate) -> Event:
    event = Event(**data.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_events(db: Session) -> list[EventOut]:
    counts = _photo_counts(db)
    events = db.query(Event).order_by(Event.name).all()
    return [_to_event_out(e, counts) for e in events]


def get_or_404(db: Session, event_id: uuid.UUID) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def patch(db: Session, event_id: uuid.UUID, data: EventPatch) -> Event:
    event = get_or_404(db, event_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


def delete(db: Session, event_id: uuid.UUID) -> None:
    event = get_or_404(db, event_id)
    db.delete(event)
    db.commit()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _photo_counts(db: Session) -> dict[uuid.UUID, int]:
    rows = (
        db.query(Photo.event_id, func.count(Photo.id))
        .filter(Photo.event_id.isnot(None))
        .filter(Photo.deleted_at.is_(None))
        .group_by(Photo.event_id)
        .all()
    )
    return {event_id: count for event_id, count in rows}


def _to_event_out(event: Event, counts: dict) -> EventOut:
    out = EventOut.model_validate(event)
    out.photo_count = counts.get(event.id, 0)
    return out
