import hashlib
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from database.session import get_db
from models.machine import Machine, MachineToken
from models.photographer import Photographer


def get_machine_from_token(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Machine | None:
    if not authorization or not authorization.startswith("Bearer hp_"):
        return None
    raw_token = authorization.removeprefix("Bearer ")
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    record = (
        db.query(MachineToken)
        .filter(MachineToken.token_hash == token_hash, MachineToken.is_active.is_(True))
        .first()
    )
    if record is None:
        raise HTTPException(status_code=401, detail="Ugyldig token")
    record.last_used_at = datetime.now(timezone.utc)
    db.flush()
    return record.machine


def get_requesting_photographer(
    machine: Machine | None = Depends(get_machine_from_token),
    db: Session = Depends(get_db),
) -> Photographer | None:
    if machine is None or machine.photographer_id is None:
        return None
    return db.get(Photographer, machine.photographer_id)


def require_owner(
    photographer: Photographer | None = Depends(get_requesting_photographer),
) -> None:
    """Block guests; allow owners and unauthenticated requests (legacy owner machines)."""
    if photographer is not None and photographer.access_level != "owner":
        raise HTTPException(status_code=403, detail="Krever owner-tilgang")
