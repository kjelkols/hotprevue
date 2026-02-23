import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database.session import get_db
from repositories import event_repo
from schemas.event import EventCreate, EventRead, EventUpdate
from schemas.image import ImageRead
from services import event_service

router = APIRouter(prefix="/events", tags=["events"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


class EventReadWithImages(EventRead):
    images: list[ImageRead] = []


@router.post("", response_model=EventRead, status_code=201)
async def create_event(body: EventCreate, db: DbDep):
    return await event_service.create_event(db, body)


@router.get("", response_model=list[EventRead])
async def list_events(db: DbDep):
    rows = await event_repo.list_events(db)
    result = []
    for row in rows:
        event = row["event"]
        read = EventRead.model_validate(event)
        read.image_count = row["image_count"]
        result.append(read)
    return result


@router.get("/{event_id}", response_model=EventReadWithImages)
async def get_event(event_id: uuid.UUID, db: DbDep):
    event, images = await event_service.get_event_with_images(db, event_id)
    # Validate from the ORM event first (avoids touching the lazy images relationship),
    # then merge with the pre-fetched images list.
    event_read = EventRead.model_validate(event)
    return EventReadWithImages(
        **event_read.model_dump(),
        images=[ImageRead.model_validate(img) for img in images],
    )


@router.patch("/{event_id}", response_model=EventRead)
async def update_event(event_id: uuid.UUID, body: EventUpdate, db: DbDep):
    return await event_service.update_event(db, event_id, body)


@router.delete("/{event_id}", status_code=204)
async def delete_event(event_id: uuid.UUID, db: DbDep):
    await event_service.delete_event(db, event_id)
