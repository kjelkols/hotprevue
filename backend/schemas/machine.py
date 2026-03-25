import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MachineCreate(BaseModel):
    machine_name: str
    photographer_id: uuid.UUID | None = None  # if None, auto-resolve in service


class MachineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    machine_id: uuid.UUID
    machine_name: str
    photographer_id: uuid.UUID | None
    last_seen_at: datetime | None
    created_at: datetime
