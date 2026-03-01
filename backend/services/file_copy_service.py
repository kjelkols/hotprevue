import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.file_copy import FileCopyOperation, FileCopySkip
from models.settings import SystemSettings
from schemas.file_copy import FileCopyOperationCreate


def suggest_name(source_path: str, include_videos: bool) -> dict:
    from utils.file_copy import suggest_name as _suggest
    return _suggest(source_path, include_videos)


def create(db: Session, data: FileCopyOperationCreate) -> FileCopyOperation:
    from utils.file_copy import start_copy

    sys = db.query(SystemSettings).first()
    verify = sys.copy_verify_after_copy if sys else True
    include_videos = sys.copy_include_videos if sys else False

    op = FileCopyOperation(
        source_path=data.source_path,
        destination_path=data.destination_path,
        device_label=data.device_label,
        notes=data.notes,
        verify_after_copy=verify,
        include_videos=include_videos,
        status="pending",
    )
    db.add(op)
    db.commit()
    db.refresh(op)

    start_copy(op.id)
    return op


def get_or_404(db: Session, operation_id: uuid.UUID) -> FileCopyOperation:
    op = db.get(FileCopyOperation, operation_id)
    if op is None:
        raise HTTPException(status_code=404, detail="Copy operation not found")
    return op


def list_all(db: Session) -> list[FileCopyOperation]:
    return (
        db.query(FileCopyOperation)
        .order_by(FileCopyOperation.started_at.desc())
        .all()
    )


def list_skips(db: Session, operation_id: uuid.UUID) -> list[FileCopySkip]:
    get_or_404(db, operation_id)
    return (
        db.query(FileCopySkip)
        .filter(FileCopySkip.operation_id == operation_id)
        .order_by(FileCopySkip.skipped_at)
        .all()
    )


def cancel(db: Session, operation_id: uuid.UUID) -> None:
    from utils.file_copy import cancel_copy
    op = get_or_404(db, operation_id)
    if op.status == "running":
        cancel_copy(operation_id)
    elif op.status not in ("pending",):
        raise HTTPException(status_code=409, detail=f"Cannot cancel operation with status '{op.status}'")


def link_session(db: Session, operation_id: uuid.UUID, session_id: uuid.UUID) -> FileCopyOperation:
    op = get_or_404(db, operation_id)
    op.input_session_id = session_id
    db.commit()
    db.refresh(op)
    return op
