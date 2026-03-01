import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from schemas.shortcut import ShortcutCreate, ShortcutOut, ShortcutPatch
from services import shortcut_service

router = APIRouter(prefix="/shortcuts", tags=["shortcuts"])


def _machine_id() -> uuid.UUID:
    mid = os.environ.get("HOTPREVUE_MACHINE_ID")
    if not mid:
        raise HTTPException(status_code=500, detail="HOTPREVUE_MACHINE_ID not set")
    return uuid.UUID(mid)


@router.get("", response_model=list[ShortcutOut])
def list_shortcuts(db: Session = Depends(get_db)):
    return shortcut_service.list_for_machine(db, _machine_id())


@router.post("", response_model=ShortcutOut, status_code=201)
def create_shortcut(data: ShortcutCreate, db: Session = Depends(get_db)):
    return shortcut_service.create(db, _machine_id(), data)


@router.patch("/{shortcut_id}", response_model=ShortcutOut)
def patch_shortcut(shortcut_id: uuid.UUID, data: ShortcutPatch, db: Session = Depends(get_db)):
    return shortcut_service.patch(db, shortcut_id, _machine_id(), data)


@router.delete("/{shortcut_id}", status_code=204)
def delete_shortcut(shortcut_id: uuid.UUID, db: Session = Depends(get_db)):
    shortcut_service.delete(db, shortcut_id, _machine_id())


@router.post("/{shortcut_id}/move-up", response_model=list[ShortcutOut])
def move_up(shortcut_id: uuid.UUID, db: Session = Depends(get_db)):
    return shortcut_service.move_up(db, shortcut_id, _machine_id())


@router.post("/{shortcut_id}/move-down", response_model=list[ShortcutOut])
def move_down(shortcut_id: uuid.UUID, db: Session = Depends(get_db)):
    return shortcut_service.move_down(db, shortcut_id, _machine_id())
