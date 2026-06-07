import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.tag import TagCreate, TagMergeResult, TagOut, TagRename, TagSimilar
from services import tag_service

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)):
    return tag_service.list_all(db)


@router.get("/similar", response_model=list[TagSimilar])
def similar_tags(name: str, db: Session = Depends(get_db)):
    return tag_service.similar(db, name)


@router.post("", response_model=TagOut, status_code=201)
def create_tag(data: TagCreate, db: Session = Depends(get_db)):
    return tag_service.create(db, data)


@router.patch("/{tag_id}", response_model=TagOut)
def rename_tag(tag_id: uuid.UUID, data: TagRename, db: Session = Depends(get_db)):
    return tag_service.rename(db, tag_id, data)


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: uuid.UUID, db: Session = Depends(get_db)):
    tag_service.delete_tag(db, tag_id)


@router.post("/{source_id}/merge-into/{target_id}", response_model=TagMergeResult)
def merge_tags(source_id: uuid.UUID, target_id: uuid.UUID, db: Session = Depends(get_db)):
    return tag_service.merge(db, source_id, target_id)


from pydantic import BaseModel


class HothashList(BaseModel):
    hothashes: list[str]


@router.post("/for-photos", response_model=dict[str, list[str]])
def tags_for_photos(body: HothashList, db: Session = Depends(get_db)):
    return tag_service.tags_for_photos(db, body.hothashes)


@router.post("/{tag_id}/add-to-photos", response_model=dict)
def add_tag_to_photos(tag_id: uuid.UUID, body: HothashList, db: Session = Depends(get_db)):
    added = tag_service.add_tag_to_photos(db, tag_id, body.hothashes)
    return {"added": added}


@router.post("/{tag_id}/remove-from-photos", response_model=dict)
def remove_tag_from_photos(tag_id: uuid.UUID, body: HothashList, db: Session = Depends(get_db)):
    removed = tag_service.remove_tag_from_photos(db, tag_id, body.hothashes)
    return {"removed": removed}
