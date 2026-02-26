import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class InputSessionCreate(BaseModel):
    name: str
    source_path: str
    default_photographer_id: uuid.UUID
    default_event_id: uuid.UUID | None = None
    recursive: bool = True


class InputSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    source_path: str
    recursive: bool
    default_photographer_id: uuid.UUID
    default_event_id: uuid.UUID | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    photo_count: int
    duplicate_count: int
    error_count: int


class SessionErrorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    file_path: str
    error: str
    occurred_at: datetime


class CheckRequest(BaseModel):
    master_paths: list[str]


class CheckResponse(BaseModel):
    known: list[str]
    unknown: list[str]


class CompanionMeta(BaseModel):
    path: str
    type: str


class GroupMetadata(BaseModel):
    master_path: str
    master_type: str
    companions: list[CompanionMeta] = []
    photographer_id: uuid.UUID | None = None
    event_id: uuid.UUID | None = None


class GroupResult(BaseModel):
    status: str  # "registered" | "duplicate" | "already_registered"
    hothash: str
    photo_id: uuid.UUID


class ProcessResult(BaseModel):
    registered: int
    duplicates: int
    errors: int
