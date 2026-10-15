import pytest

from app.db import get_connection, init_db


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    """Point FINALLY_DB_PATH at a fresh temp file and initialize it."""
    path = tmp_path / "data" / "finally.db"
    monkeypatch.setenv("FINALLY_DB_PATH", str(path))
    init_db()
    return path


@pytest.fixture
def conn(db_path):
    """Open connection to the initialized temp database."""
    with get_connection() as connection:
        yield connection
