import pytest
from fastapi.testclient import TestClient

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
