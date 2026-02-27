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
    text_item_id: uuid.UUID | None = None
    caption: str | None = None
    notes: str | None = None
    # Insert before this position (None = append)
    position: int | None = None


class CollectionItemBatch(BaseModel):
    items: list[CollectionItemCreate]


class CollectionItemPatch(BaseModel):
    caption: str | None = None
    notes: str | None = None
    markup: str | None = None  # updates the linked text_item's markup


class CollectionItemReorder(BaseModel):
    item_ids: list[str]  # ordered list of CollectionItem UUIDs


class CollectionItemBatchDelete(BaseModel):
    item_ids: list[uuid.UUID]


class CollectionItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    collection_id: uuid.UUID
    hothash: str | None
    text_item_id: uuid.UUID | None
    position: int
    caption: str | None
    notes: str | None
    hotpreview_b64: str | None = None
    markup: str | None = None  # inlined from text_item by service layer
