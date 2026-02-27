import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.collection import Collection, CollectionItem
from models.photo import Photo
from models.text_item import TextItem


def _get_or_404(db: Session, collection_id: uuid.UUID) -> Collection:
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if collection is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection


def _item_count(db: Session, collection_id: uuid.UUID) -> int:
    return db.query(CollectionItem).filter(CollectionItem.collection_id == collection_id).count()


def _enrich_items(db: Session, items: list[CollectionItem]) -> list[CollectionItem]:
    """Attach hotpreview_b64 from Photo and markup from TextItem for all items."""
    hothashes = [item.hothash for item in items if item.hothash]
    preview_map: dict[str, str] = {}
    if hothashes:
        photos = db.query(Photo).filter(Photo.hothash.in_(hothashes)).all()
        preview_map = {p.hothash: p.hotpreview_b64 for p in photos}

    ti_ids = [item.text_item_id for item in items if item.text_item_id]
    markup_map: dict[uuid.UUID, str] = {}
    if ti_ids:
        text_items = db.query(TextItem).filter(TextItem.id.in_(ti_ids)).all()
        markup_map = {ti.id: ti.markup for ti in text_items}

    for item in items:
        item.hotpreview_b64 = preview_map.get(item.hothash) if item.hothash else None
        item.markup = markup_map.get(item.text_item_id) if item.text_item_id else None
    return items


def _enrich_one(db: Session, item: CollectionItem) -> CollectionItem:
    return _enrich_items(db, [item])[0]


def create(db: Session, data) -> tuple[Collection, int]:
    collection = Collection(
        name=data.name,
        description=data.description,
        cover_hothash=data.cover_hothash,
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection, 0


def list_all(db: Session) -> list[tuple[Collection, int]]:
    collections = db.query(Collection).order_by(Collection.created_at.desc()).all()
    return [(c, _item_count(db, c.id)) for c in collections]


def get(db: Session, collection_id: uuid.UUID) -> tuple[Collection, int]:
    collection = _get_or_404(db, collection_id)
    return collection, _item_count(db, collection_id)


def patch(db: Session, collection_id: uuid.UUID, data) -> tuple[Collection, int]:
    collection = _get_or_404(db, collection_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(collection, field, value)
    db.commit()
    db.refresh(collection)
    return collection, _item_count(db, collection_id)


def delete(db: Session, collection_id: uuid.UUID) -> None:
    collection = _get_or_404(db, collection_id)
    db.delete(collection)
    db.commit()


# ---------------------------------------------------------------------------
# Item management
# ---------------------------------------------------------------------------

def _max_position(db: Session, collection_id: uuid.UUID) -> int:
    from sqlalchemy import func
    result = db.query(func.max(CollectionItem.position)).filter(
        CollectionItem.collection_id == collection_id
    ).scalar()
    return result if result is not None else -1


def add_item(db: Session, collection_id: uuid.UUID, data) -> CollectionItem:
    _get_or_404(db, collection_id)

    if data.position is not None:
        items_to_shift = (
            db.query(CollectionItem)
            .filter(CollectionItem.collection_id == collection_id)
            .filter(CollectionItem.position >= data.position)
            .all()
        )
        for item in items_to_shift:
            item.position += 1
        position = data.position
    else:
        position = _max_position(db, collection_id) + 1

    item = CollectionItem(
        collection_id=collection_id,
        hothash=data.hothash,
        text_item_id=data.text_item_id,
        position=position,
        caption=data.caption,
        notes=data.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _enrich_one(db, item)


def add_items_batch(db: Session, collection_id: uuid.UUID, items_data: list) -> list[CollectionItem]:
    _get_or_404(db, collection_id)
    base_position = _max_position(db, collection_id) + 1
    created = []
    for i, data in enumerate(items_data):
        item = CollectionItem(
            collection_id=collection_id,
            hothash=data.hothash,
            text_item_id=data.text_item_id,
            position=base_position + i,
            caption=data.caption,
            notes=data.notes,
        )
        db.add(item)
        created.append(item)
    db.commit()
    for item in created:
        db.refresh(item)
    return _enrich_items(db, created)


def get_items(db: Session, collection_id: uuid.UUID) -> list[CollectionItem]:
    _get_or_404(db, collection_id)
    items = (
        db.query(CollectionItem)
        .filter(CollectionItem.collection_id == collection_id)
        .order_by(CollectionItem.position)
        .all()
    )
    return _enrich_items(db, items)


def reorder_items(db: Session, collection_id: uuid.UUID, item_ids: list[str]) -> list[CollectionItem]:
    _get_or_404(db, collection_id)
    id_to_item = {
        str(item.id): item
        for item in db.query(CollectionItem).filter(
            CollectionItem.collection_id == collection_id
        ).all()
    }
    for item_id in item_ids:
        if item_id not in id_to_item:
            raise HTTPException(status_code=400, detail=f"Item {item_id} not in collection")
    for pos, item_id in enumerate(item_ids):
        id_to_item[item_id].position = pos
    db.commit()
    return get_items(db, collection_id)


def patch_item(db: Session, collection_id: uuid.UUID, item_id: uuid.UUID, data) -> CollectionItem:
    _get_or_404(db, collection_id)
    item = db.query(CollectionItem).filter(
        CollectionItem.id == item_id,
        CollectionItem.collection_id == collection_id,
    ).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    update = data.model_dump(exclude_unset=True)
    markup = update.pop("markup", None)

    for field, value in update.items():
        setattr(item, field, value)

    if markup is not None and item.text_item_id is not None:
        text_item = db.query(TextItem).filter(TextItem.id == item.text_item_id).first()
        if text_item is not None:
            text_item.markup = markup

    db.commit()
    db.refresh(item)
    return _enrich_one(db, item)


def delete_items_batch(db: Session, collection_id: uuid.UUID, item_ids: list[uuid.UUID]) -> None:
    _get_or_404(db, collection_id)
    items = db.query(CollectionItem).filter(
        CollectionItem.id.in_(item_ids),
        CollectionItem.collection_id == collection_id,
    ).all()

    text_item_ids = [item.text_item_id for item in items if item.text_item_id]

    for item in items:
        db.delete(item)
    db.flush()

    for ti_id in text_item_ids:
        remaining = db.query(CollectionItem).filter(
            CollectionItem.text_item_id == ti_id
        ).count()
        if remaining == 0:
            ti = db.query(TextItem).filter(TextItem.id == ti_id).first()
            if ti:
                db.delete(ti)

    db.commit()


def delete_item(db: Session, collection_id: uuid.UUID, item_id: uuid.UUID) -> None:
    _get_or_404(db, collection_id)
    item = db.query(CollectionItem).filter(
        CollectionItem.id == item_id,
        CollectionItem.collection_id == collection_id,
    ).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")

    text_item_id = item.text_item_id
    db.delete(item)
    db.flush()

    if text_item_id is not None:
        remaining = (
            db.query(CollectionItem)
            .filter(CollectionItem.text_item_id == text_item_id)
            .count()
        )
        if remaining == 0:
            text_item = db.query(TextItem).filter(TextItem.id == text_item_id).first()
            if text_item is not None:
                db.delete(text_item)

    db.commit()
