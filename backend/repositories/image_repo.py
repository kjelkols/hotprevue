import uuid
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.image import Image
from schemas.image import ImageUpdate


async def get_by_hothash(db: AsyncSession, hothash: str) -> Image | None:
    result = await db.execute(select(Image).where(Image.hothash == hothash))
    return result.scalar_one_or_none()


async def create(db: AsyncSession, data: dict[str, Any]) -> Image:
    image = Image(**data)
    db.add(image)
    await db.flush()
    await db.refresh(image)
    return image


async def list_images(
    db: AsyncSession,
    *,
    event_id: uuid.UUID | None = None,
    tags: list[str] | None = None,
    rating: int | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Image]:
    stmt = select(Image)

    if event_id is not None:
        stmt = stmt.where(Image.event_id == event_id)
    if rating is not None:
        stmt = stmt.where(Image.rating == rating)
    if tags:
        # All provided tags must be present in the image's tags array
        from sqlalchemy.dialects.postgresql import array as pg_array
        stmt = stmt.where(Image.tags.contains(pg_array(tags)))
    if search:
        stmt = stmt.where(Image.file_path.ilike(f"%{search}%"))

    stmt = stmt.order_by(Image.taken_at.desc().nullslast(), Image.registered_at.desc())
    stmt = stmt.offset(skip).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_image(
    db: AsyncSession, hothash: str, data: ImageUpdate
) -> Image | None:
    values = {k: v for k, v in data.model_dump().items() if v is not None}
    # Allow explicit None for event_id (unassign from event)
    if "event_id" in data.model_fields_set:
        values["event_id"] = data.event_id
    if not values:
        return await get_by_hothash(db, hothash)
    await db.execute(
        update(Image).where(Image.hothash == hothash).values(**values)
    )
    return await get_by_hothash(db, hothash)


async def delete_image(db: AsyncSession, hothash: str) -> Image | None:
    """Return the image record before deleting (so caller can clean up coldpreview)."""
    image = await get_by_hothash(db, hothash)
    if image is None:
        return None
    await db.execute(delete(Image).where(Image.hothash == hothash))
    return image
