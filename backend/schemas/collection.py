import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CollectionCreate(BaseModel):
    name: str
    description: str | None = None
    cover_hothash: str | None = None


class CollectionPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    cover_hothash: str | None = None


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    cover_hothash: str | None
    created_at: datetime
    item_count: int = 0


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

class CollectionItemCreate(BaseModel):
    hothash: str | None = None
    caption: str | None = None
    card_type: str | None = None  # None = photo, 'text' = text card
    title: str | None = None
    text_content: str | None = None
    notes: str | None = None
    # Insert before this position (None = append)
    position: int | None = None


class CollectionItemBatch(BaseModel):
    items: list[CollectionItemCreate]


class CollectionItemPatch(BaseModel):
    caption: str | None = None
    card_type: str | None = None
    title: str | None = None
    text_content: str | None = None
    notes: str | None = None


class CollectionItemReorder(BaseModel):
    item_ids: list[str]  # ordered list of CollectionItem UUIDs


class CollectionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    collection_id: uuid.UUID
    hothash: str | None
    position: int
    caption: str | None
    card_type: str | None
    title: str | None
    text_content: str | None
    notes: str | None
    hotpreview_b64: str | None = None
