"""Push coldpreviews to a public relay server and manage token lifecycle."""
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from sqlalchemy.orm import Session

from core.config import settings as app_settings
from models.photo import Photo
from models.settings import SystemSettings


def _get_relay_settings(db: Session) -> SystemSettings:
    s = db.query(SystemSettings).first()
    if s is None or not s.public_share_relay_url:
        raise ValueError("Relay-server ikke konfigurert (mangler public_share_relay_url i innstillinger)")
    return s


def publish(db: Session, hothash: str) -> tuple[str, datetime | None]:
    """Push coldpreview to relay. Returns (public_url, expires_at)."""
    photo = db.query(Photo).filter(Photo.hothash == hothash).first()
    if photo is None:
        raise ValueError(f"Bildet {hothash} finnes ikke")

    s = _get_relay_settings(db)

    if photo.public_share_token:
        public_url = _make_public_url(s.public_share_base_url, photo.public_share_token)
        return public_url, photo.public_share_expires_at

    token = secrets.token_hex(16)
    ttl_days = s.public_share_default_ttl_days or 30
    ttl_seconds = ttl_days * 86400

    coldpreview_path = (
        Path(app_settings.coldpreview_dir) / hothash[:2] / hothash[2:4] / f"{hothash}.jpg"
    )
    if not coldpreview_path.exists():
        raise ValueError(f"Coldpreview mangler for {hothash}")

    relay_url = f"{s.public_share_relay_url.rstrip('/')}/push/{token}"
    headers = {"X-API-Key": s.public_share_api_key or ""}

    with open(coldpreview_path, "rb") as f:
        file_bytes = f.read()

    with httpx.Client(timeout=30) as client:
        resp = client.post(
            relay_url,
            params={"ttl_seconds": ttl_seconds},
            headers=headers,
            files={"file": (f"{hothash}.jpg", file_bytes, "image/jpeg")},
        )
        resp.raise_for_status()

    expires_at = datetime.now(timezone.utc) + timedelta(days=ttl_days)
    photo.public_share_token = token
    photo.public_share_expires_at = expires_at
    db.commit()
    db.refresh(photo)

    return _make_public_url(s.public_share_base_url, token), expires_at


def revoke(db: Session, hothash: str) -> None:
    """Remove from relay and clear token. Best-effort — clears local state regardless."""
    photo = db.query(Photo).filter(Photo.hothash == hothash).first()
    if photo is None or not photo.public_share_token:
        return

    s = db.query(SystemSettings).first()
    if s and s.public_share_relay_url and photo.public_share_token:
        relay_url = f"{s.public_share_relay_url.rstrip('/')}/push/{photo.public_share_token}"
        headers = {"X-API-Key": s.public_share_api_key or ""}
        with httpx.Client(timeout=10) as client:
            try:
                client.delete(relay_url, headers=headers)
            except Exception:
                pass

    photo.public_share_token = None
    photo.public_share_expires_at = None
    db.commit()


def _make_public_url(base_url: str | None, token: str) -> str:
    base = (base_url or "").rstrip("/")
    return f"{base}/{token}.jpg"
