import uuid

from pydantic import BaseModel, ConfigDict


class GlobalSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    installation_id: uuid.UUID
    instance_name: str
    owner_name: str
    owner_website: str | None
    owner_bio: str | None
    default_sort: str
    show_deleted_in_gallery: bool
    browse_buffer_size: int
    coldpreview_max_px: int
    coldpreview_quality: int


class GlobalSettingsPatch(BaseModel):
    instance_name: str | None = None
    owner_name: str | None = None
    owner_website: str | None = None
    owner_bio: str | None = None
    default_sort: str | None = None
    show_deleted_in_gallery: bool | None = None
    browse_buffer_size: int | None = None
    coldpreview_max_px: int | None = None
    coldpreview_quality: int | None = None


class MachineSettingsOut(BaseModel):
    machine_id: uuid.UUID
    machine_name: str
    default_photographer_id: uuid.UUID | None


class MachineSettingsPatch(BaseModel):
    machine_name: str | None = None
    default_photographer_id: uuid.UUID | None = None


class SettingsOut(BaseModel):
    global_: GlobalSettingsOut
    machine: MachineSettingsOut
