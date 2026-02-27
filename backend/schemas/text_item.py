import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TextItemCreate(BaseModel):
    markup: str


class TextItemPatch(BaseModel):
    markup: str | None = None


class TextItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    markup: str
    created_at: datetime
