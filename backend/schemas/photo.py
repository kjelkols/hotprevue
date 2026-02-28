import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ImageFileSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    photo_id: uuid.UUID
    file_path: str
    file_type: str
    is_master: bool
    file_size_bytes: int | None
    exif_data: dict
    width: int | None
    height: int | None


class PhotoCorrectionSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    photo_id: uuid.UUID
    rotation: int | None
    horizon_angle: float | None
    exposure_ev: float | None
    crop_left: float | None
    crop_top: float | None
    crop_right: float | None
    crop_bottom: float | None
    updated_at: datetime


class PhotoListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hothash: str
    hotpreview_b64: str
    taken_at: datetime | None
    taken_at_accuracy: str
    rating: int | None
    tags: list[str]
    category_id: uuid.UUID | None
    event_id: uuid.UUID | None
    photographer_id: uuid.UUID
    location_lat: float | None
    location_lng: float | None
    location_accuracy: str | None
    stack_id: uuid.UUID | None
    is_stack_cover: bool
    deleted_at: datetime | None
    has_correction: bool
    width: int | None
    height: int | None
    dct_perceptual_hash: int | None
    difference_hash: int | None
    camera_make: str | None
    camera_model: str | None
    iso: int | None
    shutter_speed: str | None
    aperture: float | None
    focal_length: float | None


class CompanionCreate(BaseModel):
    path: str
    type: str


class PhotoDetail(PhotoListItem):
    taken_at_source: int
    location_source: int | None
    input_session_id: uuid.UUID | None
    registered_at: datetime
    image_files: list[ImageFileSchema]
    correction: PhotoCorrectionSchema | None


# ---------------------------------------------------------------------------
# PATCH /photos/{hothash}
# ---------------------------------------------------------------------------

class PhotoPatch(BaseModel):
    taken_at: datetime | None = None
    taken_at_source: int | None = None
    taken_at_accuracy: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    location_source: int | None = None
    location_accuracy: str | None = None
    rating: int | None = None
    tags: list[str] | None = None
    category_id: uuid.UUID | None = None
    event_id: uuid.UUID | None = None
    photographer_id: uuid.UUID | None = None


# ---------------------------------------------------------------------------
# Batch endpoints
# ---------------------------------------------------------------------------

class BatchBase(BaseModel):
    hothashes: list[str]


class BatchTags(BatchBase):
    tags: list[str]


class BatchRating(BatchBase):
    rating: int | None


class BatchEvent(BatchBase):
    event_id: uuid.UUID | None


class BatchCategory(BatchBase):
    category_id: uuid.UUID | None


class BatchPhotographer(BatchBase):
    photographer_id: uuid.UUID


class BatchTakenAt(BatchBase):
    taken_at: datetime
    taken_at_source: Literal[1, 2] = 2


class BatchTakenAtOffset(BatchBase):
    offset_seconds: int


class BatchLocation(BatchBase):
    location_lat: float
    location_lng: float
    location_source: int = 1
    location_accuracy: str | None = None


class BatchResult(BaseModel):
    updated: int


class PerceptualHashComputeResult(BaseModel):
    updated: int
    already_computed: int
