import os
import secrets
import shutil
import subprocess
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import exists, func
from sqlalchemy.orm import Session

from database.session import get_db
from middleware.machine_auth import require_owner
from models.machine import Machine, MachineInviteCode, MachineToken
from models.photographer import Photographer
from schemas.machine_auth import (
    InviteCodeCreate,
    InviteCodeOut,
    MachineOut,
    PhotographerWithMachinesOut,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/backup")
def create_backup(_: None = Depends(require_owner)):
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
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8)).upper()


@router.post("/invite-codes", response_model=InviteCodeOut, status_code=201)
def create_invite_code(
    data: InviteCodeCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_owner),
):
    if data.target_photographer_id and not db.get(Photographer, data.target_photographer_id):
        raise HTTPException(status_code=404, detail="Fotograf ikke funnet")

    code = MachineInviteCode(
        id=uuid.uuid4(),
        code=_random_code(),
        access_level=None if data.target_photographer_id else data.access_level,
        target_photographer_id=data.target_photographer_id,
        photographer_name=data.photographer_name,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=data.ttl_minutes),
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    return code


@router.get("/invite-codes", response_model=list[InviteCodeOut])
def list_invite_codes(
    db: Session = Depends(get_db),
    _: None = Depends(require_owner),
):
    return (
        db.query(MachineInviteCode)
        .order_by(MachineInviteCode.created_at.desc())
        .all()
    )


@router.delete("/invite-codes/{code_id}", status_code=204)
def delete_invite_code(
    code_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: None = Depends(require_owner),
):
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

@router.get("/machines", response_model=list[MachineOut])
def list_machines_admin(
    db: Session = Depends(get_db),
    _: None = Depends(require_owner),
):
    machines = db.query(Machine).order_by(Machine.created_at).all()
    result = []
    for m in machines:
        photographer_name = None
        if m.photographer_id:
            p = db.get(Photographer, m.photographer_id)
            if p:
                photographer_name = p.name
        has_active_token = db.query(
            exists().where(
                MachineToken.machine_id == m.machine_id,
                MachineToken.is_active.is_(True),
            )
        ).scalar()
        out = MachineOut.model_validate(m)
        out.photographer_name = photographer_name
        out.has_active_token = bool(has_active_token)
        result.append(out)
    return result


@router.patch("/machines/{machine_id}", status_code=204)
def rename_machine(
    machine_id: uuid.UUID,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    _: None = Depends(require_owner),
):
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status_code=404, detail="Maskin ikke funnet")
    name = body.get("machine_name", "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="machine_name kan ikke være tom")
    machine.machine_name = name
    db.commit()


@router.delete("/machines/{machine_id}/token", status_code=204)
def revoke_machine_token(
    machine_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: None = Depends(require_owner),
):
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status_code=404, detail="Maskin ikke funnet")
    db.query(MachineToken).filter(
        MachineToken.machine_id == machine_id,
        MachineToken.is_active.is_(True),
    ).update({"is_active": False})
    db.commit()


# ---------------------------------------------------------------------------
# Photographer / user management
# ---------------------------------------------------------------------------

@router.get("/photographers", response_model=list[PhotographerWithMachinesOut])
def list_photographers_with_machines(
    db: Session = Depends(get_db),
    _: None = Depends(require_owner),
):
    """Return photographers that have at least one machine (active users)."""
    photographers = (
        db.query(Photographer)
        .join(Machine, Machine.photographer_id == Photographer.id)
        .distinct()
        .order_by(Photographer.name)
        .all()
    )
    result = []
    for p in photographers:
        machines = db.query(Machine).filter(Machine.photographer_id == p.id).all()
        out = PhotographerWithMachinesOut.model_validate(p)
        out.machines = [MachineOut.model_validate(m) for m in machines]
        result.append(out)
    return result


@router.patch("/photographers/{photographer_id}/access-level", status_code=204)
def set_photographer_access_level(
    photographer_id: uuid.UUID,
    body: dict,
    db: Session = Depends(get_db),
    _: None = Depends(require_owner),
):
    photographer = db.get(Photographer, photographer_id)
    if photographer is None:
        raise HTTPException(status_code=404, detail="Fotograf ikke funnet")
    level = body.get("access_level")
    if level not in ("owner", "guest"):
        raise HTTPException(status_code=422, detail="access_level må være 'owner' eller 'guest'")
    photographer.access_level = level
    db.commit()
