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


class ScanSummary(BaseModel):
    total_groups: int
    raw_jpeg_pairs: int
    raw_only: int
    jpeg_only: int
    already_registered: int
    unknown_files: int


class ProcessResult(BaseModel):
    registered: int
    duplicates: int
    errors: int
