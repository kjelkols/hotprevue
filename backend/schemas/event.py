import uuid
from datetime import date as dt_date
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EventCreate(BaseModel):
    name: str
    description: str | None = None
    date: dt_date | None = None
    location: str | None = None
    parent_id: uuid.UUID | None = None


class EventPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    date: dt_date | None = None
    location: str | None = None
    parent_id: uuid.UUID | None = None
    cover_hothash: str | None = None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    date: dt_date | None
    location: str | None
    parent_id: uuid.UUID | None
    cover_hothash: str | None
    created_at: datetime
    photo_count: int = 0


class EventTree(EventOut):
    children: list[EventOut] = []
