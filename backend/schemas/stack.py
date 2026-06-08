import uuid
from datetime import datetime

from pydantic import BaseModel

from schemas.photo import PhotoListItem


class StackCreate(BaseModel):
    hothashes: list[str]
    kind: str = "selection"


class StackAddPhotos(BaseModel):
    hothashes: list[str]


class StackPatch(BaseModel):
    kind: str


class StackOut(BaseModel):
    id: uuid.UUID
    kind: str
    created_at: datetime
    photo_count: int
    cover_hothash: str | None
    cover_hotpreview_b64: str | None


class StackDetail(BaseModel):
    id: uuid.UUID
    kind: str
    created_at: datetime
    photos: list[PhotoListItem]
