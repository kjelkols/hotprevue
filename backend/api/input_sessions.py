import json
import uuid

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.input_session import (
    CheckRequest,
    CheckResponse,
    GroupMetadata,
    GroupResult,
    InputSessionCreate,
    InputSessionOut,
    ProcessResult,
    SessionErrorOut,
)
from schemas.photo import PhotoListItem
from services import input_session_service
from services.input_session_service import register_group_by_path

router = APIRouter(prefix="/input-sessions", tags=["input-sessions"])


@router.post("", response_model=InputSessionOut, status_code=201)
def create_session(data: InputSessionCreate, db: Session = Depends(get_db)):
    return input_session_service.create(db, data)


@router.get("", response_model=list[InputSessionOut])
def list_sessions(db: Session = Depends(get_db)):
    return input_session_service.list_all(db)


@router.get("/{session_id}", response_model=InputSessionOut)
def get_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    return input_session_service.get_or_404(db, session_id)


@router.get("/{session_id}/photos", response_model=list[PhotoListItem])
def get_session_photos(session_id: uuid.UUID, db: Session = Depends(get_db)):
    photos = input_session_service.list_photos(db, session_id)
    return [PhotoListItem.model_validate(p) for p in photos]


@router.get("/{session_id}/errors", response_model=list[SessionErrorOut])
def get_session_errors(session_id: uuid.UUID, db: Session = Depends(get_db)):
    return input_session_service.list_errors(db, session_id)


@router.post("/{session_id}/check", response_model=CheckResponse)
def check_paths(session_id: uuid.UUID, data: CheckRequest, db: Session = Depends(get_db)):
    return input_session_service.check(db, session_id, data)


@router.post("/{session_id}/groups", response_model=GroupResult, status_code=201)
def register_group(
    session_id: uuid.UUID,
    response: Response,
    master_file: UploadFile = File(...),
    metadata: str = Form(...),
    db: Session = Depends(get_db),
):
    meta = GroupMetadata.model_validate_json(metadata)
    file_bytes = master_file.file.read()
    result = input_session_service.register_group(db, session_id, file_bytes, meta)
    if result.status != "registered":
        response.status_code = 200
    return result


@router.post("/{session_id}/complete", response_model=ProcessResult)
def complete_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    return input_session_service.complete(db, session_id)


@router.post("/{session_id}/groups-by-path", response_model=GroupResult, status_code=201)
def register_group_by_path_endpoint(
    session_id: uuid.UUID,
    response: Response,
    meta: GroupMetadata,
    db: Session = Depends(get_db),
):
    result = register_group_by_path(db, session_id, meta)
    if result.status != "registered":
        response.status_code = 200
    return result


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    input_session_service.delete(db, session_id)
