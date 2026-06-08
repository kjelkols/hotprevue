import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.machine import Machine, MachineInviteCode, MachineToken
from models.photographer import Photographer
from schemas.machine_auth import EnrollRequest, EnrollResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/enroll", response_model=EnrollResponse, status_code=201)
def enroll(data: EnrollRequest, db: Session = Depends(get_db)):
    invite = (
        db.query(MachineInviteCode)
        .filter(MachineInviteCode.code == data.code.upper())
        .first()
    )
    if invite is None:
        raise HTTPException(status_code=404, detail="Ukjent invitasjonskode")
    if invite.used_at is not None:
        raise HTTPException(status_code=410, detail="Invitasjonskoden er allerede brukt")
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Invitasjonskoden er utløpt")

    photographer_name = invite.photographer_name or "Gjest"
    photographer = Photographer(name=photographer_name)
    db.add(photographer)
    db.flush()

    machine = Machine(
        machine_id=uuid.uuid4(),
        machine_name=data.device_name or photographer_name,
        photographer_id=photographer.id,
        role=invite.role,
        enrolled_via_invite=invite.id,
        settings={},
        last_seen_at=datetime.now(timezone.utc),
    )
    db.add(machine)
    db.flush()

    raw_token, token_hash = MachineToken.generate()
    token = MachineToken(
        machine_id=machine.machine_id,
        token_hash=token_hash,
        label=data.device_name or None,
    )
    db.add(token)

    invite.used_at = datetime.now(timezone.utc)
    invite.used_by_machine = machine.machine_id
    db.commit()

    return EnrollResponse(
        machine_id=machine.machine_id,
        api_token=raw_token,
        photographer_id=photographer.id,
        photographer_name=photographer.name,
    )
