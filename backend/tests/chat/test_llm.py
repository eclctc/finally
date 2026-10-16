import json
from types import SimpleNamespace

import pytest

from app.chat import llm
from app.chat.llm import LLMError, generate_reply, parse_reply
from app.chat.mock import mock_reply


def make_response(content):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


VALID = json.dumps(
    {
        "message": "Bought.",
        "trades": [{"ticker": "AAPL", "side": "buy", "quantity": 2.5}],
        "watchlist_changes": [{"ticker": "PYPL", "action": "add"}],
    }
)


def test_parse_full_reply():
    reply = parse_reply(VALID)
    assert reply.message == "Bought."
    assert reply.trades[0].quantity == 2.5
    assert reply.watchlist_changes[0].action == "add"


def test_parse_empty_arrays():
    reply = parse_reply('{"message": "Hi", "trades": [], "watchlist_changes": []}')
    assert reply.trades == [] and reply.watchlist_changes == []


@pytest.mark.parametrize(
    "content",
    [
        None,
        "",
        "not json",
        '{"message": "Hi"}',
        '{"message": "Hi", "trades": [{"ticker": "AAPL", "side": "hold", "quantity": 1}], "watchlist_changes": []}',
        '{"message": "Hi", "trades": [], "watchlist_changes": [{"ticker": "AAPL", "action": "watch"}]}',
    ],
)
def test_parse_malformed_raises(content):
    with pytest.raises(LLMError):
        parse_reply(content)


@pytest.mark.parametrize(
    "text, trades, changes",
    [
        ("Please BUY something", [("AAPL", "buy", 1)], []),
        ("sell it", [("AAPL", "sell", 1)], []),
        ("add a ticker", [], [("PYPL", "add")]),
        ("how am I doing?", [], []),
    ],
)
def test_mock_rules(text, trades, changes):
    reply = mock_reply(text)
    assert reply.message
    assert [(t.ticker, t.side, t.quantity) for t in reply.trades] == trades
    assert [(c.ticker, c.action) for c in reply.watchlist_changes] == changes


async def test_generate_reply_uses_mock(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")
    reply = await generate_reply([], "buy")
    assert reply.trades[0].side == "buy"


async def test_request_reply_parses_model_output(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "false")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    captured = {}

    async def fake_completion(**kwargs):
        captured.update(kwargs)
        return make_response(VALID)

    monkeypatch.setattr(llm, "acompletion", fake_completion)
    reply = await generate_reply([{"role": "user", "content": "hi"}], "hi")
    assert reply.message == "Bought."
    assert captured["model"] == llm.MODEL
    assert captured["extra_body"] == llm.EXTRA_BODY


@pytest.mark.parametrize("upstream_text", ["upstream down", ""])
async def test_request_failure_raises_llm_error(monkeypatch, upstream_text):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    async def failing_completion(**kwargs):
        raise RuntimeError(upstream_text)

    monkeypatch.setattr(llm, "acompletion", failing_completion)
    with pytest.raises(LLMError) as excinfo:
        await llm.request_reply([])
    assert str(excinfo.value) == llm.UPSTREAM_ERROR


async def test_missing_api_key_raises(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(LLMError, match="OPENROUTER_API_KEY"):
        await llm.request_reply([])
