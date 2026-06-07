import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from database.session import SessionLocal
from models.settings import SystemSettings


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_migrations()
    _bootstrap_settings()
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
    expose_headers=["*"],
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
import models.machine_lock  # noqa: F401
import models.settings  # noqa: F401
import models.file_copy  # noqa: F401
import models.shortcut  # noqa: F401
import models.saved_search  # noqa: F401
import models.ai  # noqa: F401
import models.kind  # noqa: F401
import models.tag  # noqa: F401

from api import admin, ai, collections, events, file_copy, input_sessions, kinds, machines, photographers, photos, searches, settings as settings_api, shortcuts, stats, system, tags, text_items  # noqa: E402
app.include_router(ai.router)
app.include_router(admin.router)
app.include_router(kinds.router)
app.include_router(tags.router)
app.include_router(stats.router)
app.include_router(photographers.router)
app.include_router(machines.router)
app.include_router(events.router)
app.include_router(input_sessions.router)
app.include_router(photos.router)
app.include_router(collections.router)
app.include_router(text_items.router)
app.include_router(system.router)
app.include_router(settings_api.router)
app.include_router(file_copy.router)
app.include_router(shortcuts.router)
app.include_router(searches.router)

# Frontend serveres som statiske filer.
# Prioritet: HOTPREVUE_FRONTEND_DIR env-var → frontend/dist/ ved siden av backend/
def _find_frontend_dir() -> Path | None:
    if settings.hotprevue_frontend_dir:
        p = Path(settings.hotprevue_frontend_dir)
        if p.exists():
            return p
    for candidate in [
        Path(__file__).resolve().parent.parent / "frontend" / "dist",
        Path(__file__).resolve().parent.parent / "frontend",
    ]:
        if (candidate / "index.html").exists():
            return candidate
    return None


def _bootstrap_settings() -> None:
    with SessionLocal() as db:
        if db.query(SystemSettings).first() is None:
            db.add(SystemSettings(installation_id=uuid.uuid4()))
            db.commit()


_frontend_dir = _find_frontend_dir()
if _frontend_dir:
    app.mount("/", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")
