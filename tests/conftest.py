"""Test fixtures.

Two modes, selected automatically:
  - Docker available: testcontainers spins up a PostgreSQL container.
  - No Docker: set TEST_DATABASE_URL env var pointing to an existing database.

Either way, Alembic migrations are applied before any test runs.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Make sure the backend package is importable
BACKEND_DIR = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from database.session import get_db  # noqa: E402
from main import app  # noqa: E402


# ---------------------------------------------------------------------------
# Detect Docker / choose database URL
# ---------------------------------------------------------------------------

def _docker_available() -> bool:
    try:
        import docker
        docker.from_env().ping()
        return True
    except Exception:
        return False


def _get_test_database_url() -> str:
    """Return an asyncpg-compatible URL for the test database."""
    env_url = os.environ.get("TEST_DATABASE_URL")
    if env_url:
        # Normalise to asyncpg driver
        return env_url.replace("postgresql://", "postgresql+asyncpg://").replace(
            "postgresql+psycopg2://", "postgresql+asyncpg://"
        )
    if _docker_available():
        return None  # Signal to use testcontainers
    raise RuntimeError(
        "Neither Docker nor TEST_DATABASE_URL is available.\n"
        "Options:\n"
        "  1. Enable Docker Desktop WSL integration\n"
        "  2. Install PostgreSQL and set:\n"
        "     export TEST_DATABASE_URL=postgresql://user:pass@localhost/testdb"
    )


# ---------------------------------------------------------------------------
# Session-scoped database URL fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def database_url():
    url = _get_test_database_url()
    if url is not None:
        return url

    # Docker is available — use testcontainers
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine") as pg:
        jdbc = pg.get_connection_url()
        yield jdbc.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
        return  # container cleaned up by context manager

    # Unreachable, but makes the generator valid
    yield  # noqa: unreachable


@pytest.fixture(scope="session", autouse=True)
def run_migrations(database_url):
    """Run Alembic migrations against the test database."""
    sync_url = (
        database_url
        .replace("postgresql+asyncpg://", "postgresql://")
        .replace("postgresql+psycopg2://", "postgresql://")
    )
    subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=str(BACKEND_DIR),
        env={**os.environ, "DATABASE_URL": database_url},
        check=True,
    )


# ---------------------------------------------------------------------------
# Per-test async client
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client(database_url):
    """AsyncClient with the app wired to the test database."""
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
    await engine.dispose()


# ---------------------------------------------------------------------------
# Real images fixture (requires downloaded test assets)
# ---------------------------------------------------------------------------

TEST_IMAGES_DIR = Path(__file__).parent.parent / ".test-images"


def pytest_addoption(parser):
    parser.addoption(
        "--real-images",
        action="store_true",
        default=False,
        help="Run tests marked with @pytest.mark.real_images (requires downloaded test assets).",
    )


def pytest_collection_modifyitems(config, items):
    if config.getoption("--real-images"):
        return
    skip = pytest.mark.skip(reason="Pass --real-images to run (see: make download-test-images)")
    for item in items:
        if item.get_closest_marker("real_images"):
            item.add_marker(skip)


@pytest.fixture(scope="session")
def real_image_dir():
    """Path to the downloaded test image directory.

    Structure expected:
        .test-images/
            jpeg/   ← JPEG files from various cameras
            raw/    ← RAW files (optional)
    """
    if not TEST_IMAGES_DIR.exists() or not any(TEST_IMAGES_DIR.iterdir()):
        pytest.skip("Test images not downloaded. Run: make download-test-images")
    return TEST_IMAGES_DIR


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_image_path(tmp_path):
    """Create a tiny valid JPEG for registration tests.

    Uses the tmp_path hash to vary the colour so every test produces a
    unique image (and therefore a unique hothash).
    """
    import hashlib

    from PIL import Image

    seed = int(hashlib.md5(str(tmp_path).encode()).hexdigest()[:6], 16)
    r, g, b = (seed >> 16) & 0xFF, (seed >> 8) & 0xFF, seed & 0xFF
    img = Image.new("RGB", (200, 200), color=(r, g, b))
    path = tmp_path / "test_image.jpg"
    img.save(str(path), format="JPEG")
    return str(path)
