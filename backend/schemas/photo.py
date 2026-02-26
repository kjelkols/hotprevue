import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ImageFileSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    photo_id: uuid.UUID
    file_path: str
    file_type: str
    is_master: bool


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
    corrected_coldpreview_path: str | None
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
    camera_make: str | None
    camera_model: str | None
    iso: int | None
    shutter_speed: str | None
    aperture: float | None
    focal_length: float | None


class PhotoDetail(PhotoListItem):
    coldpreview_path: str | None
    exif_data: dict
    taken_at_source: int
    location_source: int | None
    input_session_id: uuid.UUID | None
    registered_at: datetime
    image_files: list[ImageFileSchema]
    correction: PhotoCorrectionSchema | None
