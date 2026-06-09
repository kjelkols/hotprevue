"""Hotprevue public share relay.

Receives coldpreview pushes from Hotprevue backend, stores them on disk,
and lets nginx serve them as static files. Cleanup runs on startup and
hourly via a background thread.
"""
import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse

# ─── Config ───────────────────────────────────────────────────────────────────

SHARE_DIR = Path(os.environ.get("SHARE_DIR", "/var/www/share"))
API_KEY = os.environ.get("RELAY_API_KEY", "")
META_FILE = SHARE_DIR / ".meta.json"

app = FastAPI(title="Hotprevue relay", docs_url=None, redoc_url=None)

_lock = threading.Lock()


# ─── Metadata helpers ─────────────────────────────────────────────────────────

def _load_meta() -> dict:
    if META_FILE.exists():
        try:
            return json.loads(META_FILE.read_text())
        except Exception:
            pass
    return {}


def _save_meta(meta: dict) -> None:
    META_FILE.write_text(json.dumps(meta, indent=2))


# ─── Cleanup ──────────────────────────────────────────────────────────────────

def _cleanup() -> int:
    now = datetime.now(timezone.utc).timestamp()
    with _lock:
        meta = _load_meta()
        removed = 0
        for token, entry in list(meta.items()):
            expires = entry.get("expires_at", 0)
            if expires and now > expires:
                img = SHARE_DIR / f"{token}.jpg"
                if img.exists():
                    img.unlink()
                del meta[token]
                removed += 1
        _save_meta(meta)
    return removed


def _cleanup_loop() -> None:
    while True:
        time.sleep(3600)
        _cleanup()


# ─── Auth ─────────────────────────────────────────────────────────────────────

def _check_key(x_api_key: str = Header(...)) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Ugyldig API-nøkkel")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/push/{token}", status_code=201)
async def push(
    token: str,
    file: UploadFile,
    ttl_seconds: int = 86400 * 30,
    x_api_key: str = Header(...),
) -> JSONResponse:
    _check_key(x_api_key)

    if not token.isalnum() or len(token) > 64:
        raise HTTPException(status_code=422, detail="Ugyldig token")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fil for stor (maks 20 MB)")

    SHARE_DIR.mkdir(parents=True, exist_ok=True)
    dest = SHARE_DIR / f"{token}.jpg"

    expires_ts = datetime.now(timezone.utc).timestamp() + ttl_seconds

    with _lock:
        dest.write_bytes(data)
        meta = _load_meta()
        meta[token] = {"expires_at": expires_ts}
        _save_meta(meta)

    return JSONResponse({"token": token, "expires_at": expires_ts}, status_code=201)


@app.delete("/push/{token}", status_code=204)
async def delete_push(
    token: str,
    x_api_key: str = Header(...),
) -> None:
    _check_key(x_api_key)

    with _lock:
        img = SHARE_DIR / f"{token}.jpg"
        if img.exists():
            img.unlink()
        meta = _load_meta()
        meta.pop(token, None)
        _save_meta(meta)


@app.get("/health")
def health() -> dict:
    with _lock:
        meta = _load_meta()
    return {"status": "ok", "active": len(meta)}


# ─── Startup ──────────────────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup() -> None:
    SHARE_DIR.mkdir(parents=True, exist_ok=True)
    _cleanup()
    t = threading.Thread(target=_cleanup_loop, daemon=True)
    t.start()


if __name__ == "__main__":
    uvicorn.run("relay:app", host="127.0.0.1", port=8010, reload=False)
