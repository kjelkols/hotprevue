import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.event import EventCreate, EventOut, EventPatch
from services import event_service

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=EventOut, status_code=201)
def create_event(data: EventCreate, db: Session = Depends(get_db)):
    event = event_service.create(db, data)
    return event_service._to_event_out(event, event_service._photo_counts(db))


@router.get("", response_model=list[EventOut])
def list_events(db: Session = Depends(get_db)):
    return event_service.list_events(db)


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: uuid.UUID, db: Session = Depends(get_db)):
    event = event_service.get_or_404(db, event_id)
    return event_service._to_event_out(event, event_service._photo_counts(db))


@router.patch("/{event_id}", response_model=EventOut)
def patch_event(event_id: uuid.UUID, data: EventPatch, db: Session = Depends(get_db)):
    event = event_service.patch(db, event_id, data)
    return event_service._to_event_out(event, event_service._photo_counts(db))


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: uuid.UUID, db: Session = Depends(get_db)):
    event_service.delete(db, event_id)
