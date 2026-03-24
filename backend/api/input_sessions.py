import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.input_session import (
    CheckHothashRequest,
    CheckHothashResponse,
    GroupPayload,
    GroupResult,
    InputSessionCreate,
    InputSessionOut,
    ProcessResult,
    SessionErrorOut,
)
from schemas.photo import PhotoListItem
from services import input_session_service

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


@router.post("/{session_id}/check-hothashes", response_model=CheckHothashResponse)
def check_hothashes(session_id: uuid.UUID, data: CheckHothashRequest, db: Session = Depends(get_db)):
    input_session_service.get_or_404(db, session_id)
    return input_session_service.check_hothashes(db, data)


@router.post("/{session_id}/groups", response_model=GroupResult, status_code=201)
def register_group(
    session_id: uuid.UUID,
    payload: GroupPayload,
    response: Response,
    db: Session = Depends(get_db),
):
    result = input_session_service.register_group(db, session_id, payload)
    if result.status != "registered":
        response.status_code = 200
    return result


@router.post("/{session_id}/complete", response_model=ProcessResult)
def complete_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    return input_session_service.complete(db, session_id)


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: uuid.UUID, db: Session = Depends(get_db)):
    input_session_service.delete(db, session_id)
