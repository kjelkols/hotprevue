import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class InputSessionCreate(BaseModel):
    name: str
    source_path: str
    default_photographer_id: uuid.UUID
    default_event_id: uuid.UUID | None = None
    recursive: bool = True
    notes: str | None = None


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
    notes: str | None


class SessionErrorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    file_path: str
    error: str
    occurred_at: datetime


# ─── Check hothashes ──────────────────────────────────────────────────────────

class CheckHothashRequest(BaseModel):
    hothashes: list[str]


class CheckHothashResponse(BaseModel):
    known: list[str]
    unknown: list[str]


# ─── Group registration (client-side processing) ──────────────────────────────

class CompanionFilePayload(BaseModel):
    path: str
    type: str  # RAW, JPEG, TIFF, PNG, HEIC, XMP
    file_size_bytes: int | None = None
    file_content_hash: str | None = None
    exif_data: dict = {}
    width: int | None = None
    height: int | None = None


class GroupPayload(BaseModel):
    """One image group, fully processed by the client before sending.

    The client has already:
    - Generated hotpreview (150x150 JPEG) and computed hothash (SHA256)
    - Generated coldpreview (max 1200px JPEG)
    - Extracted EXIF and computed perceptual hashes
    - Measured file sizes and computed content hashes

    Backend stores the data — no file reading or image processing server-side.
    """
    # Previews
    hothash: str
    hotpreview_b64: str
    coldpreview_b64: str

    # Master file
    master_path: str
    master_type: str
    master_size_bytes: int | None = None
    master_content_hash: str | None = None
    master_exif: dict = {}
    width: int | None = None
    height: int | None = None

    # Photo metadata (extracted by client)
    taken_at: datetime | None = None
    taken_at_source: int = 0
    taken_at_accuracy: str = "second"
    location_lat: float | None = None
    location_lng: float | None = None
    location_source: int | None = None
    location_accuracy: str | None = None
    camera_make: str | None = None
    camera_model: str | None = None
    lens_model: str | None = None
    iso: int | None = None
    shutter_speed: str | None = None
    aperture: float | None = None
    focal_length: float | None = None

    # Perceptual hashes (computed by client from hotpreview bytes)
    dct_perceptual_hash: int | None = None
    difference_hash: int | None = None

    # Optional assignment overrides (falls back to session defaults)
    photographer_id: uuid.UUID | None = None
    event_id: uuid.UUID | None = None

    # Companion files
    companions: list[CompanionFilePayload] = []


class GroupResult(BaseModel):
    status: str  # "registered" | "duplicate" | "already_registered"
    hothash: str
    photo_id: uuid.UUID


class ProcessResult(BaseModel):
    registered: int
    duplicates: int
    errors: int
