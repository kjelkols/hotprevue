import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.shortcut import Shortcut
from schemas.shortcut import ShortcutCreate, ShortcutPatch


def list_for_machine(db: Session, machine_id: uuid.UUID) -> list[Shortcut]:
    return (
        db.query(Shortcut)
        .filter(Shortcut.machine_id == machine_id)
        .order_by(Shortcut.position)
        .all()
    )


def create(db: Session, machine_id: uuid.UUID, data: ShortcutCreate) -> Shortcut:
    max_pos = db.query(Shortcut).filter(Shortcut.machine_id == machine_id).count()
    shortcut = Shortcut(
        machine_id=machine_id,
        name=data.name,
        path=data.path,
        position=max_pos,
    )
    db.add(shortcut)
    db.commit()
    db.refresh(shortcut)
    return shortcut


def seed_default(db: Session, machine_id: uuid.UUID, home_path: str) -> None:
    """Create the default 'Hjemmeområde' shortcut if none exist for this machine."""
    existing = db.query(Shortcut).filter(Shortcut.machine_id == machine_id).first()
    if existing is None:
        db.add(Shortcut(machine_id=machine_id, name="Hjemmeområde", path=home_path, position=0))
        db.commit()


def patch(db: Session, shortcut_id: uuid.UUID, machine_id: uuid.UUID, data: ShortcutPatch) -> Shortcut:
    shortcut = _get_or_404(db, shortcut_id, machine_id)
    if data.name is not None:
        shortcut.name = data.name
    if data.path is not None:
        shortcut.path = data.path
    db.commit()
    db.refresh(shortcut)
    return shortcut


def delete(db: Session, shortcut_id: uuid.UUID, machine_id: uuid.UUID) -> None:
    shortcut = _get_or_404(db, shortcut_id, machine_id)
    pos = shortcut.position
    db.delete(shortcut)
    # Compact positions above the deleted item
    db.query(Shortcut).filter(
        Shortcut.machine_id == machine_id,
        Shortcut.position > pos,
    ).update({Shortcut.position: Shortcut.position - 1})
    db.commit()


def move_up(db: Session, shortcut_id: uuid.UUID, machine_id: uuid.UUID) -> list[Shortcut]:
    shortcut = _get_or_404(db, shortcut_id, machine_id)
    if shortcut.position == 0:
        return list_for_machine(db, machine_id)
    neighbour = (
        db.query(Shortcut)
        .filter(Shortcut.machine_id == machine_id, Shortcut.position == shortcut.position - 1)
        .first()
    )
    if neighbour:
        neighbour.position, shortcut.position = shortcut.position, neighbour.position
    db.commit()
    return list_for_machine(db, machine_id)


def move_down(db: Session, shortcut_id: uuid.UUID, machine_id: uuid.UUID) -> list[Shortcut]:
    shortcut = _get_or_404(db, shortcut_id, machine_id)
    neighbour = (
        db.query(Shortcut)
        .filter(Shortcut.machine_id == machine_id, Shortcut.position == shortcut.position + 1)
        .first()
    )
    if neighbour:
        neighbour.position, shortcut.position = shortcut.position, neighbour.position
    db.commit()
    return list_for_machine(db, machine_id)


def _get_or_404(db: Session, shortcut_id: uuid.UUID, machine_id: uuid.UUID) -> Shortcut:
    shortcut = (
        db.query(Shortcut)
        .filter(Shortcut.id == shortcut_id, Shortcut.machine_id == machine_id)
        .first()
    )
    if shortcut is None:
        raise HTTPException(status_code=404, detail="Shortcut not found")
    return shortcut
