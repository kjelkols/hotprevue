from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.events import router as events_router
from api.images import router as images_router
from database.session import engine
from models.base import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing to do — migrations are managed by Alembic
    yield
    # Shutdown: close DB connections
    await engine.dispose()


app = FastAPI(title="Hotprevue API", version="0.1.0", lifespan=lifespan)

app.include_router(images_router)
app.include_router(events_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
