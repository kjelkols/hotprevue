import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from middleware.machine_auth import get_machine_from_token
from models.machine import Machine, MachineInviteCode, MachineToken
from models.photographer import Photographer
from schemas.machine_auth import (
    AddMachineCodeResponse,
    EnrollRequest,
    EnrollResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_ADD_MACHINE_TTL_MINUTES = 15


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

    if invite.target_photographer_id:
        # Scenario B/C — link to existing photographer
        photographer = db.get(Photographer, invite.target_photographer_id)
        if photographer is None:
            raise HTTPException(status_code=404, detail="Fotograf ikke funnet")
    else:
        # Scenario A — create new photographer
        photographer = Photographer(
            name=invite.photographer_name or "Gjest",
            access_level=invite.access_level or "guest",
        )
        db.add(photographer)
        db.flush()

    machine = Machine(
        machine_id=uuid.uuid4(),
        machine_name=data.device_name or photographer.name,
        photographer_id=photographer.id,
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


@router.post("/add-machine-code", response_model=AddMachineCodeResponse, status_code=201)
def add_machine_code(
    machine: Machine = Depends(get_machine_from_token),
    db: Session = Depends(get_db),
):
    """Generate a short-lived code to enroll an additional machine for the same photographer.

    Any authenticated machine can call this — no owner approval required.
    The new machine inherits the photographer's existing access_level.
    """
    if machine is None:
        raise HTTPException(status_code=401, detail="Krever autentisering")
    if machine.photographer_id is None:
        raise HTTPException(status_code=400, detail="Maskinen har ingen tilknyttet fotograf")

    import secrets

    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    code_str = "".join(secrets.choice(alphabet) for _ in range(8)).upper()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=_ADD_MACHINE_TTL_MINUTES)

    invite = MachineInviteCode(
        id=uuid.uuid4(),
        code=code_str,
        target_photographer_id=machine.photographer_id,
        expires_at=expires_at,
    )
    db.add(invite)
    db.commit()

    return AddMachineCodeResponse(code=code_str, expires_at=expires_at)
