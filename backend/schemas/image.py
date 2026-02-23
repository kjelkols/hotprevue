import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ImageRegister(BaseModel):
    file_path: str
    event_id: uuid.UUID | None = None
    tags: list[str] = Field(default_factory=list)
    rating: int | None = Field(default=None, ge=1, le=5)


class ImageUpdate(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    tags: list[str] | None = None
    event_id: uuid.UUID | None = None


class ImageRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    hothash: str
    file_path: str
    hotpreview_b64: str
    coldpreview_path: str | None
    exif_data: dict | None
    rating: int | None
    tags: list[str]
    event_id: uuid.UUID | None
    registered_at: datetime
    taken_at: datetime | None
