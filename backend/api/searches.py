import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.photo import PhotoListItem
from schemas.saved_search import (
    ExecuteSearchRequest, SavedSearchCreate, SavedSearchOut, SavedSearchPatch,
    TimelineRequest, TimelineYear,
)
from services import search_service

router = APIRouter(prefix="/searches", tags=["searches"])


@router.get("", response_model=list[SavedSearchOut])
def list_searches(db: Session = Depends(get_db)):
    return search_service.list_searches(db)


@router.post("", response_model=SavedSearchOut, status_code=201)
def create_search(data: SavedSearchCreate, db: Session = Depends(get_db)):
    return search_service.create(db, data)


# POST routes must be declared before GET /{search_id} to avoid route conflicts
@router.post("/execute", response_model=list[PhotoListItem])
def execute_search(req: ExecuteSearchRequest, db: Session = Depends(get_db)):
    photos = search_service.execute(
        db, req.logic, req.criteria, req.sort, req.limit, req.offset, req.date_filter
    )
    return photos


@router.post("/timeline", response_model=list[TimelineYear])
def search_timeline(req: TimelineRequest, db: Session = Depends(get_db)):
    return search_service.timeline(db, req.logic, req.criteria)


@router.get("/{search_id}", response_model=SavedSearchOut)
def get_search(search_id: uuid.UUID, db: Session = Depends(get_db)):
    return search_service.get_or_404(db, search_id)


@router.patch("/{search_id}", response_model=SavedSearchOut)
def patch_search(search_id: uuid.UUID, data: SavedSearchPatch, db: Session = Depends(get_db)):
    return search_service.patch(db, search_id, data)


@router.delete("/{search_id}", status_code=204)
def delete_search(search_id: uuid.UUID, db: Session = Depends(get_db)):
    search_service.delete(db, search_id)
