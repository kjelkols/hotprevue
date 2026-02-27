import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.text_item import TextItemCreate, TextItemOut, TextItemPatch
from services import text_item_service

router = APIRouter(prefix="/text-items", tags=["text-items"])


@router.post("", response_model=TextItemOut, status_code=201)
def create_text_item(data: TextItemCreate, db: Session = Depends(get_db)):
    return text_item_service.create(db, data)


@router.get("/{text_item_id}", response_model=TextItemOut)
def get_text_item(text_item_id: uuid.UUID, db: Session = Depends(get_db)):
    return text_item_service.get_or_404(db, text_item_id)


@router.patch("/{text_item_id}", response_model=TextItemOut)
def patch_text_item(text_item_id: uuid.UUID, data: TextItemPatch, db: Session = Depends(get_db)):
    return text_item_service.patch(db, text_item_id, data)


@router.delete("/{text_item_id}", status_code=204)
def delete_text_item(text_item_id: uuid.UUID, db: Session = Depends(get_db)):
    text_item_service.delete(db, text_item_id)
