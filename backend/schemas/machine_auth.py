import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class InviteCodeCreate(BaseModel):
    photographer_name: str | None = None
    ttl_minutes: int = 60
    role: str = "guest"


class InviteCodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    role: str
    photographer_name: str | None
    expires_at: datetime
    used_at: datetime | None
    created_at: datetime


class EnrollRequest(BaseModel):
    code: str
    device_name: str = ""


class EnrollResponse(BaseModel):
    machine_id: uuid.UUID
    api_token: str
    photographer_id: uuid.UUID
    photographer_name: str


class MachineWithRoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    machine_id: uuid.UUID
    machine_name: str
    role: str
    photographer_id: uuid.UUID | None
    last_seen_at: datetime | None
    created_at: datetime
