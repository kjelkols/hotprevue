import os
import secrets
import shutil
import subprocess
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database.session import get_db
from models.machine import Machine, MachineInviteCode, MachineToken
from schemas.machine_auth import InviteCodeCreate, InviteCodeOut, MachineWithRoleOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/backup")
def create_backup():
    """Returnerer en pg_dump SQL-dump av hotprevue-databasen."""
    pg_dump = shutil.which("pg_dump")
    if not pg_dump:
        raise HTTPException(status_code=501, detail="pg_dump ikke funnet i PATH")

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL ikke satt")

    plain_url = db_url.replace("postgresql+psycopg2://", "postgresql://")

    result = subprocess.run(
        [pg_dump, "--dbname", plain_url, "--no-password"],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr)

    return Response(
        content=result.stdout.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="hotprevue-backup.sql"'},
    )


# ---------------------------------------------------------------------------
# Invite codes
# ---------------------------------------------------------------------------

def _random_code() -> str:
    """8-tegns alfanumerisk kode (a-z0-9), uppercase for visning."""
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"  # utelukker 0/o, 1/l/i for lesbarhet
    return "".join(secrets.choice(alphabet) for _ in range(8)).upper()


@router.post("/invite-codes", response_model=InviteCodeOut, status_code=201)
def create_invite_code(data: InviteCodeCreate, db: Session = Depends(get_db)):
    code = MachineInviteCode(
        id=uuid.uuid4(),
        code=_random_code(),
        role=data.role,
        photographer_name=data.photographer_name,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=data.ttl_minutes),
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    return code


@router.get("/invite-codes", response_model=list[InviteCodeOut])
def list_invite_codes(db: Session = Depends(get_db)):
    return (
        db.query(MachineInviteCode)
        .order_by(MachineInviteCode.created_at.desc())
        .all()
    )


@router.delete("/invite-codes/{code_id}", status_code=204)
def delete_invite_code(code_id: uuid.UUID, db: Session = Depends(get_db)):
    code = db.get(MachineInviteCode, code_id)
    if code is None:
        raise HTTPException(status_code=404, detail="Invitasjonskode ikke funnet")
    if code.used_at is not None:
        raise HTTPException(status_code=409, detail="Kan ikke slette en brukt kode")
    db.delete(code)
    db.commit()


# ---------------------------------------------------------------------------
# Machine management
# ---------------------------------------------------------------------------

@router.get("/machines", response_model=list[MachineWithRoleOut])
def list_machines_admin(db: Session = Depends(get_db)):
    return db.query(Machine).order_by(Machine.created_at).all()


@router.delete("/machines/{machine_id}/token", status_code=204)
def revoke_machine_token(machine_id: uuid.UUID, db: Session = Depends(get_db)):
    """Trekker tilbake alle aktive tokens for en maskin."""
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status_code=404, detail="Maskin ikke funnet")
    db.query(MachineToken).filter(
        MachineToken.machine_id == machine_id,
        MachineToken.is_active.is_(True),
    ).update({"is_active": False})
    db.commit()
