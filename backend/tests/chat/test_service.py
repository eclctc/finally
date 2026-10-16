import json
import sqlite3

import pytest

from app.chat import service
from app.chat.llm import LLMError
from app.chat.schemas import ChatReply, TradeInstruction, WatchlistChange
from app.chat.service import handle_chat_message
from app.db import repository


@pytest.fixture
def fake_reply(monkeypatch):
    """Make the LLM return a chosen reply; records the prompt it was given."""
    state = {"reply": None, "prompts": []}

    async def fake_generate_reply(messages, user_message):
        state["prompts"].append(messages)
        if isinstance(state["reply"], Exception):
            raise state["reply"]
        return state["reply"]

    monkeypatch.setattr(service, "generate_reply", fake_generate_reply)
    return state


def reply(trades=(), changes=()):
    return ChatReply(
        message="ok",
        trades=[TradeInstruction(ticker=t, side=s, quantity=q) for t, s, q in trades],
        watchlist_changes=[WatchlistChange(ticker=t, action=a) for t, a in changes],
    )


async def test_mock_buy_executes_and_stores(conn, cache, source, monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")
    result = await handle_chat_message(conn, cache, source, "buy something")

    assert result["actions"] == [
        {"type": "trade", "ticker": "AAPL", "side": "buy", "quantity": 1.0, "status": "ok", "price": 100.0}
    ]
    assert repository.get_cash(conn) == 9900.0
    stored = repository.recent_chat_messages(conn)
    assert [(m.role, m.actions) for m in stored] == [("user", None), ("assistant", result["actions"])]


async def test_watchlist_add_runs_before_trade(conn, cache, source, fake_reply):
    fake_reply["reply"] = reply(trades=[("pypl", "buy", 2)], changes=[("pypl", "add")])
    result = await handle_chat_message(conn, cache, source, "get me PYPL")

    assert [a["type"] for a in result["actions"]] == ["watchlist", "trade"]
    assert all(a["status"] == "ok" for a in result["actions"])
    assert result["actions"][0]["ticker"] == "PYPL"
    assert repository.is_watched(conn, "PYPL")
    assert repository.get_position(conn, "PYPL").quantity == 2


async def test_failed_actions_are_recorded_not_fatal(conn, cache, source, fake_reply):
    fake_reply["reply"] = reply(
        trades=[("AAPL", "buy", 1000), ("AAPL", "buy", 1)],
        changes=[("PYPL", "remove")],
    )
    result = await handle_chat_message(conn, cache, source, "do things")

    remove, big_buy, small_buy = result["actions"]
    assert remove["status"] == "failed" and "not on the watchlist" in remove["error"]
    assert big_buy["status"] == "failed" and "Insufficient cash" in big_buy["error"]
    assert small_buy["status"] == "ok"
    assert repository.get_position(conn, "AAPL").quantity == 1
    assert repository.recent_chat_messages(conn)[-1].actions == result["actions"]


async def test_llm_failure_stores_and_executes_nothing(conn, cache, source, fake_reply):
    fake_reply["reply"] = LLMError("boom")
    with pytest.raises(LLMError):
        await handle_chat_message(conn, cache, source, "buy AAPL")

    assert repository.recent_chat_messages(conn) == []
    assert repository.get_cash(conn) == 10000.0


async def test_prior_failures_reach_next_prompt(conn, cache, source, fake_reply):
    fake_reply["reply"] = reply(trades=[("AAPL", "sell", 5)])
    await handle_chat_message(conn, cache, source, "sell 5 AAPL")
    fake_reply["reply"] = reply()
    await handle_chat_message(conn, cache, source, "what happened?")

    second_prompt = fake_reply["prompts"][1]
    assert [m["role"] for m in second_prompt] == ["system", "user", "assistant", "user"]
    assert "Insufficient shares" in second_prompt[2]["content"]
    assert "AAPL: $100.00" in second_prompt[0]["content"]


async def test_unexpected_action_failure_is_isolated(conn, cache, source, fake_reply, monkeypatch, caplog):
    real_insert_trade = repository.insert_trade
    calls = []

    def flaky_insert_trade(*args, **kwargs):
        calls.append(1)
        if len(calls) == 2:
            raise sqlite3.OperationalError("disk I/O error")
        return real_insert_trade(*args, **kwargs)

    monkeypatch.setattr(repository, "insert_trade", flaky_insert_trade)
    fake_reply["reply"] = reply(trades=[("AAPL", "buy", 1)] * 3, changes=[("PYPL", "add")])

    result = await handle_chat_message(conn, cache, source, "go")

    assert [a["status"] for a in result["actions"]] == ["ok", "ok", "failed", "ok"]
    assert result["actions"][2]["error"] == service.UNEXPECTED_ERROR
    assert "disk I/O" not in json.dumps(result["actions"])
    assert "disk I/O error" in caplog.text
    assert repository.get_cash(conn) == 9800.0
    assert repository.get_position(conn, "AAPL").quantity == 2
    assert repository.is_watched(conn, "PYPL")
    assert conn.execute("SELECT COUNT(*) FROM trades").fetchone()[0] == 2
    assert len(repository.list_snapshots(conn)) == 2
    assert repository.recent_chat_messages(conn)[-1].actions == result["actions"]
