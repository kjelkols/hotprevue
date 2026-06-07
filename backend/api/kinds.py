import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.kind import KindCreate, KindOut, KindPatch
from services import kind_service

router = APIRouter(prefix="/kinds", tags=["kinds"])


@router.post("", response_model=KindOut, status_code=201)
def create_kind(data: KindCreate, db: Session = Depends(get_db)):
    return kind_service.create(db, data)


@router.get("", response_model=list[KindOut])
def list_kinds(db: Session = Depends(get_db)):
    return kind_service.list_all(db)


@router.get("/{kind_id}", response_model=KindOut)
def get_kind(kind_id: uuid.UUID, db: Session = Depends(get_db)):
    return kind_service.get_or_404(db, kind_id)


@router.patch("/{kind_id}", response_model=KindOut)
def patch_kind(kind_id: uuid.UUID, data: KindPatch, db: Session = Depends(get_db)):
    return kind_service.patch(db, kind_id, data)


@router.delete("/{kind_id}", status_code=204)
def delete_kind(kind_id: uuid.UUID, db: Session = Depends(get_db)):
    kind_service.delete(db, kind_id)
