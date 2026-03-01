import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ShortcutCreate(BaseModel):
    name: str
    path: str


class ShortcutPatch(BaseModel):
    name: str | None = None
    path: str | None = None


class ShortcutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    machine_id: uuid.UUID
    name: str
    path: str
    position: int
    created_at: datetime
