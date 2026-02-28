"""Fixtures for unit tests — override parent conftest to skip DB setup.

Unit tests in this directory test utils functions directly and need no database.
"""

import pytest


@pytest.fixture(scope="session")
def database_url():
    """No database for unit tests."""
    return None


@pytest.fixture(scope="session", autouse=True)
def run_migrations(database_url):
    """No-op — no DB migrations for unit tests."""
    pass


@pytest.fixture(autouse=True)
def clean_db(database_url):
    """No-op — no DB cleanup for unit tests."""
    pass
