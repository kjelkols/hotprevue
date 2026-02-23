from __future__ import annotations

import datetime
import uuid

from pydantic import BaseModel


class EventCreate(BaseModel):
    name: str
    description: str | None = None
    date: datetime.date | None = None
    location: str | None = None
    parent_id: uuid.UUID | None = None


class EventUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    date: datetime.date | None = None
    location: str | None = None
    parent_id: uuid.UUID | None = None


class EventRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    description: str | None
    date: datetime.date | None
    location: str | None
    parent_id: uuid.UUID | None
    created_at: datetime.datetime
    image_count: int = 0
