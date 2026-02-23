import uuid
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.event import Event
from models.image import Image
from schemas.event import EventCreate, EventUpdate


async def create(db: AsyncSession, data: EventCreate) -> Event:
    event = Event(**data.model_dump())
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


async def get_by_id(db: AsyncSession, event_id: uuid.UUID) -> Event | None:
    result = await db.execute(select(Event).where(Event.id == event_id))
    return result.scalar_one_or_none()


async def list_events(db: AsyncSession) -> list[dict[str, Any]]:
    """Return all events with their image counts."""
    count_sq = (
        select(Image.event_id, func.count(Image.id).label("image_count"))
        .group_by(Image.event_id)
        .subquery()
    )
    stmt = (
        select(Event, func.coalesce(count_sq.c.image_count, 0).label("image_count"))
        .outerjoin(count_sq, Event.id == count_sq.c.event_id)
        .order_by(Event.created_at.desc())
    )
    rows = await db.execute(stmt)
    result = []
    for event, image_count in rows:
        result.append({"event": event, "image_count": image_count})
    return result


async def update_event(
    db: AsyncSession, event_id: uuid.UUID, data: EventUpdate
) -> Event | None:
    values = {k: v for k, v in data.model_dump().items() if v is not None}
    if not values:
        return await get_by_id(db, event_id)
    await db.execute(
        update(Event).where(Event.id == event_id).values(**values)
    )
    return await get_by_id(db, event_id)


async def delete_event(db: AsyncSession, event_id: uuid.UUID) -> bool:
    """Delete event; images keep their data but event_id is nulled by FK cascade."""
    event = await get_by_id(db, event_id)
    if event is None:
        return False
    await db.delete(event)
    return True


async def get_images_for_event(db: AsyncSession, event_id: uuid.UUID) -> list[Image]:
    result = await db.execute(
        select(Image).where(Image.event_id == event_id).order_by(Image.taken_at, Image.registered_at)
    )
    return list(result.scalars().all())
