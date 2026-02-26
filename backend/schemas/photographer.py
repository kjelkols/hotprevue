import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PhotographerCreate(BaseModel):
    name: str
    website: str | None = None
    bio: str | None = None
    notes: str | None = None
    is_default: bool = False
    is_unknown: bool = False


class PhotographerPatch(BaseModel):
    name: str | None = None
    website: str | None = None
    bio: str | None = None
    notes: str | None = None
    is_default: bool | None = None


class PhotographerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    website: str | None
    bio: str | None
    notes: str | None
    is_default: bool
    is_unknown: bool
    created_at: datetime
