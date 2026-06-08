import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.stack import StackAddPhotos, StackCreate, StackDetail, StackOut, StackPatch
from services import stack_service

router = APIRouter(prefix="/stacks", tags=["stacks"])


@router.post("", response_model=StackOut, status_code=201)
def create_stack(data: StackCreate, db: Session = Depends(get_db)):
    return stack_service.create(db, data)


@router.post("/remove-photos", status_code=204)
def remove_photos_from_stacks(data: StackAddPhotos, db: Session = Depends(get_db)):
    stack_service.remove_photos_batch(db, data.hothashes)


@router.post("/dissolve", status_code=204)
def dissolve_stack(data: StackAddPhotos, db: Session = Depends(get_db)):
    stack_service.dissolve_by_photos(db, data.hothashes)


@router.get("", response_model=list[StackOut])
def list_stacks(db: Session = Depends(get_db)):
    return stack_service.list_all(db)


@router.get("/{stack_id}", response_model=StackDetail)
def get_stack(stack_id: uuid.UUID, db: Session = Depends(get_db)):
    return stack_service.get_one(db, stack_id)


@router.patch("/{stack_id}", response_model=StackOut)
def patch_stack(stack_id: uuid.UUID, data: StackPatch, db: Session = Depends(get_db)):
    return stack_service.patch(db, stack_id, data)


@router.post("/{stack_id}/photos/{hothash}", response_model=StackOut)
def add_photo(stack_id: uuid.UUID, hothash: str, db: Session = Depends(get_db)):
    return stack_service.add_photo(db, stack_id, hothash)


@router.post("/{stack_id}/photos/batch", response_model=StackOut)
def add_photos_batch(stack_id: uuid.UUID, data: StackAddPhotos, db: Session = Depends(get_db)):
    return stack_service.add_photos_batch(db, stack_id, data.hothashes)


@router.delete("/{stack_id}/photos/{hothash}", status_code=204)
def remove_photo(stack_id: uuid.UUID, hothash: str, db: Session = Depends(get_db)):
    stack_service.remove_photo(db, stack_id, hothash)


@router.put("/{stack_id}/cover/{hothash}", response_model=StackOut)
def set_cover(stack_id: uuid.UUID, hothash: str, db: Session = Depends(get_db)):
    return stack_service.set_cover(db, stack_id, hothash)


@router.delete("/{stack_id}", status_code=204)
def delete_stack(stack_id: uuid.UUID, db: Session = Depends(get_db)):
    stack_service.delete(db, stack_id)
