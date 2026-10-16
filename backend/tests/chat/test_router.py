import pytest
from fastapi.testclient import TestClient

from app.chat import llm
from app.db import get_connection, repository
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.delenv("MASSIVE_API_KEY", raising=False)
    with TestClient(app) as test_client:
        yield test_client


def test_chat_mock_buy(client, monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")
    response = client.post("/api/chat", json={"message": "buy"})

    assert response.status_code == 200
    body = response.json()
    assert body["message"]
    assert body["actions"][0]["type"] == "trade"
    assert body["actions"][0]["status"] == "ok"
    assert client.get("/api/portfolio").json()["positions"][0]["ticker"] == "AAPL"


def test_chat_llm_failure_returns_502(client, monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "false")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    response = client.post("/api/chat", json={"message": "buy"})

    assert response.status_code == 502
    assert "OPENROUTER_API_KEY" in response.json()["error"]
    assert client.get("/api/portfolio").json()["positions"] == []


def test_upstream_error_returns_fixed_502(client, monkeypatch, caplog):
    monkeypatch.setenv("LLM_MOCK", "false")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    async def failing_completion(**kwargs):
        raise RuntimeError("secret upstream detail sk-123")

    monkeypatch.setattr("app.chat.llm.acompletion", failing_completion)
    response = client.post("/api/chat", json={"message": "buy"})

    assert response.status_code == 502
    assert response.json() == {"error": llm.UPSTREAM_ERROR}
    assert "sk-123" not in response.text
    assert "sk-123" in caplog.text
    portfolio = client.get("/api/portfolio").json()
    assert portfolio["positions"] == []
    assert portfolio["cash_balance"] == 10000.0
    with get_connection() as conn:
        assert repository.recent_chat_messages(conn) == []
