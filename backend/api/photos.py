import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from fastapi import File, Form, UploadFile

from schemas.photo import (
    CompanionCreate,
    ImageFileSchema,
    PhotoDetail,
    PhotoListItem,
    ReprocessResult,
)
from services import photo_service

router = APIRouter(prefix="/photos", tags=["photos"])


@router.get("", response_model=list[PhotoListItem])
def list_photos(
    db: Session = Depends(get_db),
    photographer_id: uuid.UUID | None = None,
    event_id: uuid.UUID | None = None,
    session_id: uuid.UUID | None = None,
    tags: list[str] = Query(default=[]),
    category_id: uuid.UUID | None = None,
    in_stream: bool | None = None,
    rating_min: int | None = None,
    rating_max: int | None = None,
    taken_after: datetime | None = None,
    taken_before: datetime | None = None,
    deleted: bool = False,
    sort: str = "taken_at_desc",
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
):
    photos = photo_service.list_photos(
        db,
        photographer_id=photographer_id,
        event_id=event_id,
        session_id=session_id,
        tags=tags or None,
        category_id=category_id,
        in_stream=in_stream,
        rating_min=rating_min,
        rating_max=rating_max,
        taken_after=taken_after,
        taken_before=taken_before,
        deleted=deleted,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return [PhotoListItem.model_validate(p) for p in photos]


@router.get("/{hothash}", response_model=PhotoDetail)
def get_photo(hothash: str, db: Session = Depends(get_db)):
    photo = photo_service.get_by_hothash(db, hothash)
    return PhotoDetail.model_validate(photo)


@router.get("/{hothash}/files", response_model=list[ImageFileSchema])
def get_photo_files(hothash: str, db: Session = Depends(get_db)):
    files = photo_service.get_image_files(db, hothash)
    return [ImageFileSchema.model_validate(f) for f in files]


@router.post("/{hothash}/companions", response_model=ImageFileSchema, status_code=201)
def add_companion(hothash: str, data: CompanionCreate, db: Session = Depends(get_db)):
    companion = photo_service.add_companion(db, hothash, data)
    return ImageFileSchema.model_validate(companion)


@router.post("/{hothash}/reprocess", response_model=ReprocessResult)
def reprocess_photo(
    hothash: str,
    master_file: UploadFile = File(...),
    master_path: str = Form(None),
    db: Session = Depends(get_db),
):
    file_bytes = master_file.file.read()
    coldpreview_path = photo_service.reprocess(db, hothash, file_bytes, master_path)
    return ReprocessResult(coldpreview_path=coldpreview_path)
