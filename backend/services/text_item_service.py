import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.collection import CollectionItem
from models.text_item import TextItem
from schemas.text_item import TextItemCreate, TextItemPatch


def create(db: Session, data: TextItemCreate) -> TextItem:
    item = TextItem(markup=data.markup)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_or_404(db: Session, text_item_id: uuid.UUID) -> TextItem:
    item = db.query(TextItem).filter(TextItem.id == text_item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="TextItem not found")
    return item


def patch(db: Session, text_item_id: uuid.UUID, data: TextItemPatch) -> TextItem:
    item = get_or_404(db, text_item_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


def delete(db: Session, text_item_id: uuid.UUID) -> None:
    item = get_or_404(db, text_item_id)
    refs = (
        db.query(CollectionItem)
        .filter(CollectionItem.text_item_id == text_item_id)
        .count()
    )
    if refs > 0:
        raise HTTPException(
            status_code=409,
            detail=f"TextItem is referenced by {refs} collection item(s)",
        )
    db.delete(item)
    db.commit()
