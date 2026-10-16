import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from litellm.exceptions import Timeout

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


def raise_timeout():
    raise Timeout(message="slow", model=llm.MODEL, llm_provider="openrouter")


def respond_with_content(content):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


@pytest.mark.parametrize(
    "behavior, expected_constant",
    [
        (lambda: SimpleNamespace(choices=[]), "UPSTREAM_ERROR"),
        (lambda: respond_with_content("not json"), "BAD_REPLY_ERROR"),
        (raise_timeout, "TIMEOUT_ERROR"),
    ],
    ids=["no-choices", "bad-content", "timeout"],
)
def test_bad_llm_replies_return_fixed_502(client, monkeypatch, behavior, expected_constant):
    monkeypatch.setenv("LLM_MOCK", "false")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    async def fake_completion(**kwargs):
        return behavior()

    monkeypatch.setattr("app.chat.llm.acompletion", fake_completion)
    response = client.post("/api/chat", json={"message": "buy"})

    assert response.status_code == 502
    assert response.json() == {"error": getattr(llm, expected_constant)}
    assert client.get("/api/portfolio").json()["positions"] == []


def reply_with_quantity(token: str) -> str:
    """Build model content for a PYPL add plus an AAPL buy, with token as a raw JSON number."""
    reply = {
        "message": "Done.",
        "trades": [{"ticker": "AAPL", "side": "buy", "quantity": "QUANTITY"}],
        "watchlist_changes": [{"ticker": "PYPL", "action": "add"}],
    }
    return json.dumps(reply).replace('"QUANTITY"', token)


@pytest.mark.parametrize(
    "token",
    ["NaN", "Infinity", "-Infinity", "1e999"],
    ids=["nan", "inf", "neg-inf", "overflow"],
)
def test_non_finite_trade_quantity_returns_502(client, monkeypatch, token):
    monkeypatch.setenv("LLM_MOCK", "false")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    async def fake_completion(**kwargs):
        return respond_with_content(reply_with_quantity(token))

    monkeypatch.setattr("app.chat.llm.acompletion", fake_completion)
    response = client.post("/api/chat", json={"message": "buy"})

    assert response.status_code == 502
    assert response.json() == {"error": llm.BAD_REPLY_ERROR}
    portfolio = client.get("/api/portfolio").json()
    assert portfolio["positions"] == []
    assert portfolio["cash_balance"] == 10000.0
    with get_connection() as conn:
        assert repository.recent_chat_messages(conn) == []
        assert repository.is_watched(conn, "PYPL") is False
