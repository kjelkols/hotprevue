import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.session import SessionLocal
from models.settings import SystemSettings


@asynccontextmanager
async def lifespan(app: FastAPI):
    _bootstrap_settings()
    yield


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
import models.settings  # noqa: F401

from api import collections, events, input_sessions, photographers, photos, text_items  # noqa: E402
app.include_router(photographers.router)
app.include_router(events.router)
app.include_router(input_sessions.router)
app.include_router(photos.router)
app.include_router(collections.router)
app.include_router(text_items.router)


def _bootstrap_settings() -> None:
    """Create the single SystemSettings row if it does not exist yet."""
    with SessionLocal() as db:
        if db.query(SystemSettings).first() is None:
            db.add(SystemSettings(installation_id=uuid.uuid4()))
            db.commit()
