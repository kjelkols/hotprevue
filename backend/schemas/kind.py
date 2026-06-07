import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class KindCreate(BaseModel):
    name: str
    description: str | None = None
    color: str | None = None
    hidden_by_default: bool = False
    sort_order: int = 0


class KindPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    hidden_by_default: bool | None = None
    sort_order: int | None = None


class KindOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    color: str | None
    hidden_by_default: bool
    sort_order: int
    is_default: bool
    created_at: datetime
