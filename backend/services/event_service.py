"""Event service — thin layer for business logic around events."""

import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from models.event import Event
from models.image import Image
from repositories import event_repo
from schemas.event import EventCreate, EventUpdate


async def create_event(db: AsyncSession, data: EventCreate) -> Event:
    if data.parent_id is not None:
        parent = await event_repo.get_by_id(db, data.parent_id)
        if parent is None:
            raise HTTPException(status_code=404, detail="Parent event not found")
    event = await event_repo.create(db, data)
    await db.commit()
    await db.refresh(event)
    return event


async def update_event(db: AsyncSession, event_id: uuid.UUID, data: EventUpdate) -> Event:
    event = await event_repo.get_by_id(db, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if data.parent_id is not None:
        parent = await event_repo.get_by_id(db, data.parent_id)
        if parent is None:
            raise HTTPException(status_code=404, detail="Parent event not found")
    updated = await event_repo.update_event(db, event_id, data)
    await db.commit()
    return updated  # type: ignore[return-value]


async def delete_event(db: AsyncSession, event_id: uuid.UUID) -> None:
    deleted = await event_repo.delete_event(db, event_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.commit()


async def get_event_with_images(
    db: AsyncSession, event_id: uuid.UUID
) -> tuple[Event, list[Image]]:
    event = await event_repo.get_by_id(db, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    images = await event_repo.get_images_for_event(db, event_id)
    return event, images
