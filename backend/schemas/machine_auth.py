import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class InviteCodeCreate(BaseModel):
    # Scenario A (new photographer): set photographer_name + access_level
    photographer_name: str | None = None
    access_level: str = "guest"
    ttl_minutes: int = 60
    # Scenario B (existing photographer): set target_photographer_id
    target_photographer_id: uuid.UUID | None = None


class InviteCodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    access_level: str | None
    target_photographer_id: uuid.UUID | None
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


class AddMachineCodeResponse(BaseModel):
    code: str
    expires_at: datetime


class MachineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    machine_id: uuid.UUID
    machine_name: str
    photographer_id: uuid.UUID | None
    last_seen_at: datetime | None
    created_at: datetime


class PhotographerWithMachinesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    access_level: str
    machines: list[MachineOut] = []
