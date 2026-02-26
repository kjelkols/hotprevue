import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.photographer import PhotographerCreate, PhotographerOut, PhotographerPatch
from services import photographer_service

router = APIRouter(prefix="/photographers", tags=["photographers"])


@router.post("", response_model=PhotographerOut, status_code=201)
def create_photographer(data: PhotographerCreate, db: Session = Depends(get_db)):
    return photographer_service.create(db, data)


@router.get("", response_model=list[PhotographerOut])
def list_photographers(db: Session = Depends(get_db)):
    return photographer_service.list_all(db)


@router.get("/{photographer_id}", response_model=PhotographerOut)
def get_photographer(photographer_id: uuid.UUID, db: Session = Depends(get_db)):
    return photographer_service.get_or_404(db, photographer_id)


@router.patch("/{photographer_id}", response_model=PhotographerOut)
def patch_photographer(
    photographer_id: uuid.UUID,
    data: PhotographerPatch,
    db: Session = Depends(get_db),
):
    return photographer_service.patch(db, photographer_id, data)


@router.delete("/{photographer_id}", status_code=204)
def delete_photographer(photographer_id: uuid.UUID, db: Session = Depends(get_db)):
    photographer_service.delete(db, photographer_id)
