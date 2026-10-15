import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    """The full app (simulator, mock LLM) against a fresh database."""
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("LLM_MOCK", "true")
    monkeypatch.delenv("MASSIVE_API_KEY", raising=False)
    with TestClient(app) as test_client:
        yield test_client
