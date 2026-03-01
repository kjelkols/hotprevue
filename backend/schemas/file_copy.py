import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FileCopyOperationCreate(BaseModel):
    source_path: str
    destination_path: str
    device_label: str | None = None
    notes: str | None = None


class FileCopyOperationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_path: str
    destination_path: str
    device_label: str | None
    notes: str | None
    status: str
    files_total: int
    files_copied: int
    files_skipped: int
    bytes_total: int
    bytes_copied: int
    verify_after_copy: bool
    include_videos: bool
    started_at: datetime
    completed_at: datetime | None
    error: str | None
    input_session_id: uuid.UUID | None


class FileCopySkipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    operation_id: uuid.UUID
    source_path: str
    reason: str
    skipped_at: datetime


class SuggestNameResult(BaseModel):
    suggested_name: str | None
    files_found: int
    bytes_total: int
