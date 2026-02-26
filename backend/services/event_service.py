import uuid

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.event import Event
from models.photo import Photo
from schemas.event import EventCreate, EventOut, EventPatch, EventTree


def create(db: Session, data: EventCreate) -> Event:
    if data.parent_id:
        parent = db.get(Event, data.parent_id)
        if parent is None:
            raise HTTPException(status_code=404, detail="Parent event not found")
        if parent.parent_id is not None:
            raise HTTPException(
                status_code=409,
                detail="Cannot nest more than one level deep",
            )
    event = Event(**data.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def list_as_tree(db: Session) -> list[EventTree]:
    """Return root events with children nested. Each event includes photo_count."""
    counts = _photo_counts(db)

    root_events = (
        db.query(Event)
        .filter(Event.parent_id.is_(None))
        .order_by(Event.name)
        .all()
    )

    result = []
    for event in root_events:
        tree = EventTree.model_validate(event)
        tree.photo_count = counts.get(event.id, 0)
        tree.children = [_to_event_out(child, counts) for child in
                         sorted(event.children, key=lambda e: e.name)]
        result.append(tree)
    return result


def get_or_404(db: Session, event_id: uuid.UUID) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def patch(db: Session, event_id: uuid.UUID, data: EventPatch) -> Event:
    event = get_or_404(db, event_id)
    updates = data.model_dump(exclude_unset=True)

    if "parent_id" in updates:
        _validate_parent_change(db, event, updates["parent_id"])

    for field, value in updates.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return event


def delete(db: Session, event_id: uuid.UUID) -> None:
    event = get_or_404(db, event_id)
    if event.children:
        raise HTTPException(
            status_code=409,
            detail="Event has child events — delete children first",
        )
    # Photos keep their event_id set to NULL via ON DELETE SET NULL
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


def _validate_parent_change(db: Session, event: Event, new_parent_id: uuid.UUID | None) -> None:
    if new_parent_id is None:
        return  # Lifting to root is always OK

    new_parent = db.get(Event, new_parent_id)
    if new_parent is None:
        raise HTTPException(status_code=404, detail="Parent event not found")

    if new_parent.parent_id is not None:
        raise HTTPException(
            status_code=409,
            detail="Target parent is already a child event — max one level of nesting",
        )

    if event.children:
        raise HTTPException(
            status_code=409,
            detail="Cannot make an event with children into a child event",
        )
