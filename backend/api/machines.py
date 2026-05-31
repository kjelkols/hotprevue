import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.machine import Machine
from models.photographer import Photographer
from schemas.machine import MachineCreate, MachineOut

router = APIRouter(prefix="/machines", tags=["machines"])


def _resolve_photographer(db: Session, photographer_id: uuid.UUID | None) -> uuid.UUID:
    if photographer_id is not None:
        if db.get(Photographer, photographer_id) is None:
            raise HTTPException(status_code=404, detail="Photographer not found")
        return photographer_id
    p = db.query(Photographer).filter(Photographer.is_default == True).first()  # noqa: E712
    if p is None:
        p = db.query(Photographer).order_by(Photographer.created_at).first()
    if p is None:
        p = Photographer(name="Ukjent", is_unknown=True)
        db.add(p)
        db.flush()
    return p.id


@router.post("", response_model=MachineOut, status_code=201)
def register_machine(
    data: MachineCreate,
    x_machine_id: uuid.UUID = Header(...),
    db: Session = Depends(get_db),
):
    """Registrerer klientmaskinen. Kalles automatisk av frontend ved første oppstart."""
    existing = db.get(Machine, x_machine_id)
    if existing:
        return existing
    photographer_id = _resolve_photographer(db, data.photographer_id)
    machine = Machine(
        machine_id=x_machine_id,
        machine_name=data.machine_name,
        photographer_id=photographer_id,
        settings={},
        last_seen_at=datetime.now(timezone.utc),
    )
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


@router.get("", response_model=list[MachineOut])
def list_machines(db: Session = Depends(get_db)):
    return db.query(Machine).order_by(Machine.created_at).all()


@router.get("/{machine_id}", response_model=MachineOut)
def get_machine(machine_id: uuid.UUID, db: Session = Depends(get_db)):
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status_code=404, detail="Machine not found")
    return machine
