import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.collection import (
    CollectionCreate,
    CollectionItemBatch,
    CollectionItemBatchDelete,
    CollectionItemCreate,
    CollectionItemOut,
    CollectionItemPatch,
    CollectionItemReorder,
    CollectionOut,
    CollectionPatch,
)
from services import collection_service

router = APIRouter(prefix="/collections", tags=["collections"])


def _to_out(collection, item_count: int) -> CollectionOut:
    out = CollectionOut.model_validate(collection)
    out.item_count = item_count
    return out


@router.post("", response_model=CollectionOut, status_code=201)
def create_collection(data: CollectionCreate, db: Session = Depends(get_db)):
    collection, count = collection_service.create(db, data)
    return _to_out(collection, count)


@router.get("", response_model=list[CollectionOut])
def list_collections(db: Session = Depends(get_db)):
    return [_to_out(c, count) for c, count in collection_service.list_all(db)]


@router.get("/{collection_id}", response_model=CollectionOut)
def get_collection(collection_id: uuid.UUID, db: Session = Depends(get_db)):
    collection, count = collection_service.get(db, collection_id)
    return _to_out(collection, count)


@router.patch("/{collection_id}", response_model=CollectionOut)
def patch_collection(collection_id: uuid.UUID, data: CollectionPatch, db: Session = Depends(get_db)):
    collection, count = collection_service.patch(db, collection_id, data)
    return _to_out(collection, count)


@router.delete("/{collection_id}", status_code=204)
def delete_collection(collection_id: uuid.UUID, db: Session = Depends(get_db)):
    collection_service.delete(db, collection_id)


@router.get("/{collection_id}/items", response_model=list[CollectionItemOut])
def get_items(collection_id: uuid.UUID, db: Session = Depends(get_db)):
    items = collection_service.get_items(db, collection_id)
    return [CollectionItemOut.model_validate(item) for item in items]


@router.post("/{collection_id}/items", response_model=CollectionItemOut, status_code=201)
def add_item(collection_id: uuid.UUID, data: CollectionItemCreate, db: Session = Depends(get_db)):
    item = collection_service.add_item(db, collection_id, data)
    return CollectionItemOut.model_validate(item)


@router.post("/{collection_id}/items/batch", response_model=list[CollectionItemOut], status_code=201)
def add_items_batch(collection_id: uuid.UUID, data: CollectionItemBatch, db: Session = Depends(get_db)):
    items = collection_service.add_items_batch(db, collection_id, data.items)
    return [CollectionItemOut.model_validate(item) for item in items]


@router.put("/{collection_id}/items", response_model=list[CollectionItemOut])
def reorder_items(collection_id: uuid.UUID, data: CollectionItemReorder, db: Session = Depends(get_db)):
    items = collection_service.reorder_items(db, collection_id, data.item_ids)
    return [CollectionItemOut.model_validate(item) for item in items]


@router.patch("/{collection_id}/items/{item_id}", response_model=CollectionItemOut)
def patch_item(
    collection_id: uuid.UUID,
    item_id: uuid.UUID,
    data: CollectionItemPatch,
    db: Session = Depends(get_db),
):
    item = collection_service.patch_item(db, collection_id, item_id, data)
    return CollectionItemOut.model_validate(item)


@router.delete("/{collection_id}/items/batch", status_code=204)
def delete_items_batch(
    collection_id: uuid.UUID,
    data: CollectionItemBatchDelete,
    db: Session = Depends(get_db),
):
    collection_service.delete_items_batch(db, collection_id, data.item_ids)


@router.delete("/{collection_id}/items/{item_id}", status_code=204)
def delete_item(collection_id: uuid.UUID, item_id: uuid.UUID, db: Session = Depends(get_db)):
    collection_service.delete_item(db, collection_id, item_id)
