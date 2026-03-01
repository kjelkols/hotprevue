import os
import uuid
import threading
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path

if os.environ.get("HOTPREVUE_LOCAL"):
    from core.local_setup import setup_local_environment
    setup_local_environment()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from database.session import SessionLocal
from models.settings import SystemSettings


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.environ.get("HOTPREVUE_LOCAL"):
        _run_migrations()
    _bootstrap_settings()
    if os.environ.get("HOTPREVUE_MACHINE_ID"):
        _register_machine()
    if settings.hotprevue_open_browser:
        threading.Timer(1.0, webbrowser.open, args=["http://localhost:8000"]).start()
    yield


def _run_migrations() -> None:
    from alembic.config import Config
    from alembic import command
    cfg = Config("alembic.ini")
    command.upgrade(cfg, "head")


app = FastAPI(title="Hotprevue", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}

# Import all models so SQLAlchemy can resolve string FKs across the full schema
import models.photographer  # noqa: F401
import models.category  # noqa: F401
import models.event  # noqa: F401
import models.text_item  # noqa: F401
import models.collection  # noqa: F401
import models.input_session  # noqa: F401
import models.photo  # noqa: F401
import models.machine  # noqa: F401
import models.settings  # noqa: F401
import models.file_copy  # noqa: F401

from api import collections, events, file_copy, input_sessions, photographers, photos, settings as settings_api, system, text_items  # noqa: E402
app.include_router(photographers.router)
app.include_router(events.router)
app.include_router(input_sessions.router)
app.include_router(photos.router)
app.include_router(collections.router)
app.include_router(text_items.router)
app.include_router(system.router)
app.include_router(settings_api.router)
app.include_router(file_copy.router)

# Statiske filer monteres sist slik at API-ruter tar prioritet
if settings.hotprevue_frontend_dir:
    _frontend_path = Path(settings.hotprevue_frontend_dir)
    if _frontend_path.exists():
        app.mount("/", StaticFiles(directory=str(_frontend_path), html=True), name="frontend")


def _bootstrap_settings() -> None:
    """Create the single SystemSettings row if it does not exist yet."""
    with SessionLocal() as db:
        if db.query(SystemSettings).first() is None:
            db.add(SystemSettings(installation_id=uuid.uuid4()))
            db.commit()


def _register_machine() -> None:
    """Upsert the current machine row and update last_seen_at."""
    from datetime import datetime, timezone
    from models.machine import Machine

    machine_id = uuid.UUID(os.environ["HOTPREVUE_MACHINE_ID"])
    with SessionLocal() as db:
        machine = db.query(Machine).filter(Machine.machine_id == machine_id).first()
        if machine is None:
            machine = Machine(machine_id=machine_id, machine_name="", settings={})
            db.add(machine)
        machine.last_seen_at = datetime.now(timezone.utc)
        db.commit()
