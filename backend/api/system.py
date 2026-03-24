from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.session import get_db
from models.machine_lock import MachineLock

router = APIRouter(prefix="/system", tags=["system"])

LOCK_TTL_MINUTES = 30


# ─── Advisory locks (multi-machine coordination) ──────────────────────────────

class LockRequest(BaseModel):
    lock_type: str   # e.g. 'registration'
    locked_by: str   # instance_name of the requesting machine


class LockStatus(BaseModel):
    locked: bool
    lock_type: str | None = None
    locked_by: str | None = None
    locked_at: datetime | None = None
    expires_at: datetime | None = None


def _clear_expired(db: Session) -> None:
    now = datetime.now(timezone.utc)
    db.query(MachineLock).filter(MachineLock.expires_at <= now).delete()
    db.commit()


@router.get("/lock", response_model=LockStatus)
def get_lock(db: Session = Depends(get_db)):
    """Return current lock status. Expired locks are cleared automatically."""
    _clear_expired(db)
    lock = db.query(MachineLock).first()
    if lock is None:
        return LockStatus(locked=False)
    return LockStatus(
        locked=True,
        lock_type=lock.lock_type,
        locked_by=lock.locked_by,
        locked_at=lock.locked_at,
        expires_at=lock.expires_at,
    )


@router.post("/lock", response_model=LockStatus, status_code=201)
def acquire_lock(req: LockRequest, db: Session = Depends(get_db)):
    """Acquire an advisory lock. Returns 409 if a lock is already held."""
    _clear_expired(db)
    existing = db.query(MachineLock).filter(MachineLock.lock_type == req.lock_type).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Lock '{req.lock_type}' is held by '{existing.locked_by}' until {existing.expires_at.isoformat()}",
        )
    now = datetime.now(timezone.utc)
    lock = MachineLock(
        lock_type=req.lock_type,
        locked_by=req.locked_by,
        locked_at=now,
        expires_at=now + timedelta(minutes=LOCK_TTL_MINUTES),
    )
    db.add(lock)
    db.commit()
    db.refresh(lock)
    return LockStatus(
        locked=True,
        lock_type=lock.lock_type,
        locked_by=lock.locked_by,
        locked_at=lock.locked_at,
        expires_at=lock.expires_at,
    )


@router.delete("/lock/{lock_type}", status_code=204)
def release_lock(lock_type: str, db: Session = Depends(get_db)):
    """Release a lock. Silent if the lock doesn't exist."""
    db.query(MachineLock).filter(MachineLock.lock_type == lock_type).delete()
    db.commit()
