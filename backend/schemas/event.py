import uuid
from datetime import date as dt_date
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EventCreate(BaseModel):
    name: str
    description: str | None = None
    date: dt_date | None = None
    location: str | None = None


class EventPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    date: dt_date | None = None
    location: str | None = None
    cover_hothash: str | None = None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    date: dt_date | None
    location: str | None
    cover_hothash: str | None
    created_at: datetime
    photo_count: int = 0
