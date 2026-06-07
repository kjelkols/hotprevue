import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TagCreate(BaseModel):
    name: str


class TagRename(BaseModel):
    name: str


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    created_at: datetime
    photo_count: int


class TagSimilar(BaseModel):
    id: uuid.UUID
    name: str
    photo_count: int
    similarity: float


class TagMergeResult(BaseModel):
    target: TagOut
    merged_photo_count: int
