import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI

from database.session import SessionLocal
from models.settings import SystemSettings


@asynccontextmanager
async def lifespan(app: FastAPI):
    _bootstrap_settings()
    yield


app = FastAPI(title="Hotprevue", version="0.1.0", lifespan=lifespan)


def _bootstrap_settings() -> None:
    """Create the single SystemSettings row if it does not exist yet."""
    with SessionLocal() as db:
        if db.query(SystemSettings).first() is None:
            db.add(SystemSettings(installation_id=uuid.uuid4()))
            db.commit()
