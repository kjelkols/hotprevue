"""Test fixtures.

Two modes, selected automatically:
  - Docker available: testcontainers spins up a PostgreSQL container.
  - No Docker: set TEST_DATABASE_URL env var pointing to an existing database.

Either way, Alembic migrations are applied before any test runs.
"""

import os
import subprocess
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.testclient import TestClient

from database.session import get_db
from main import app

BACKEND_DIR = Path(__file__).parent.parent


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


def _get_test_database_url() -> str | None:
    """Return a psycopg2-compatible URL for the test database."""
    env_url = os.environ.get("TEST_DATABASE_URL")
    if env_url:
        return (
            env_url
            .replace("postgresql+asyncpg://", "postgresql://")
            .replace("postgresql+psycopg2://", "postgresql://")
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
        yield url
        return

    # Docker is available — use testcontainers
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg.get_connection_url()


@pytest.fixture(scope="session", autouse=True)
def run_migrations(database_url):
    """Run Alembic migrations against the test database."""
    import sys
    alembic_bin = str(Path(sys.executable).parent / "alembic")
    subprocess.run(
        [alembic_bin, "upgrade", "head"],
        cwd=str(BACKEND_DIR),
        env={**os.environ, "DATABASE_URL": database_url},
        check=True,
    )


# ---------------------------------------------------------------------------
# Per-test cleanup — truncate all data tables for isolation
# ---------------------------------------------------------------------------

_DATA_TABLES = (
    "photo_corrections", "image_files", "duplicate_files",
    "collection_items", "session_errors",
    "photos", "input_sessions", "collections",
    "events", "categories", "photographers", "system_settings",
)


@pytest.fixture(autouse=True)
def clean_db(database_url):
    """Truncate all data tables before each test."""
    from sqlalchemy import text
    engine = create_engine(database_url)
    with engine.connect() as conn:
        conn.execute(text(f"TRUNCATE {', '.join(_DATA_TABLES)} RESTART IDENTITY CASCADE"))
        conn.commit()
    engine.dispose()


# ---------------------------------------------------------------------------
# Per-test client and direct DB session
# ---------------------------------------------------------------------------

@pytest.fixture
def client(database_url, clean_db):
    """TestClient with the app wired to the test database."""
    engine = create_engine(database_url)
    TestSessionLocal = sessionmaker(engine, expire_on_commit=False)

    def override_get_db():
        with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def db(database_url, clean_db):
    """Direct DB session connected to the test database (for seeding data)."""
    engine = create_engine(database_url)
    TestSessionLocal = sessionmaker(engine, expire_on_commit=False)
    with TestSessionLocal() as session:
        yield session
    engine.dispose()


# ---------------------------------------------------------------------------
# Real images fixture (requires downloaded test assets)
# ---------------------------------------------------------------------------

TEST_IMAGES_DIR = BACKEND_DIR.parent / ".test-images"


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
    """Path to the downloaded test image directory."""
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
