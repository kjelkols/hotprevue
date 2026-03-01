import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.file_copy import (
    FileCopyOperationCreate,
    FileCopyOperationOut,
    FileCopySkipOut,
    SuggestNameResult,
)
from services import file_copy_service

router = APIRouter(prefix="/file-copy-operations", tags=["file-copy"])


@router.post("/suggest-name", response_model=SuggestNameResult)
def suggest_name(source_path: str = Query(...), db: Session = Depends(get_db)):
    """Quick scan of source directory: returns name suggestion + file count + total bytes."""
    from models.settings import SystemSettings
    sys = db.query(SystemSettings).first()
    include_videos = sys.copy_include_videos if sys else False
    result = file_copy_service.suggest_name(source_path, include_videos)
    return SuggestNameResult(**result)


@router.post("", response_model=FileCopyOperationOut, status_code=201)
def start_copy(data: FileCopyOperationCreate, db: Session = Depends(get_db)):
    """Create and immediately start a file copy operation."""
    op = file_copy_service.create(db, data)
    return FileCopyOperationOut.model_validate(op)


@router.get("", response_model=list[FileCopyOperationOut])
def list_operations(db: Session = Depends(get_db)):
    ops = file_copy_service.list_all(db)
    return [FileCopyOperationOut.model_validate(op) for op in ops]


@router.get("/{operation_id}", response_model=FileCopyOperationOut)
def get_operation(operation_id: uuid.UUID, db: Session = Depends(get_db)):
    op = file_copy_service.get_or_404(db, operation_id)
    return FileCopyOperationOut.model_validate(op)


@router.get("/{operation_id}/skips", response_model=list[FileCopySkipOut])
def get_skips(operation_id: uuid.UUID, db: Session = Depends(get_db)):
    skips = file_copy_service.list_skips(db, operation_id)
    return [FileCopySkipOut.model_validate(s) for s in skips]


@router.delete("/{operation_id}", status_code=204)
def cancel_operation(operation_id: uuid.UUID, db: Session = Depends(get_db)):
    file_copy_service.cancel(db, operation_id)


@router.patch("/{operation_id}/link-session", response_model=FileCopyOperationOut)
def link_session(operation_id: uuid.UUID, session_id: uuid.UUID = Query(...), db: Session = Depends(get_db)):
    """Link a completed copy operation to an input session."""
    op = file_copy_service.link_session(db, operation_id, session_id)
    return FileCopyOperationOut.model_validate(op)
