import json
import os
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


async def test_actions_commit_one_by_one_without_spanning_awaits(conn, cache, source, fake_reply, monkeypatch):
    in_transaction_at_await = []
    real_add, real_remove = source.add_ticker, source.remove_ticker

    async def spy_add(ticker):
        in_transaction_at_await.append(conn.in_transaction)
        return await real_add(ticker)

    async def spy_remove(ticker):
        in_transaction_at_await.append(conn.in_transaction)
        return await real_remove(ticker)

    monkeypatch.setattr(source, "add_ticker", spy_add)
    monkeypatch.setattr(source, "remove_ticker", spy_remove)
    fake_reply["reply"] = reply(
        trades=[("PYPL", "buy", 1)],
        changes=[("PYPL", "add"), ("UBER", "add"), ("AAPL", "remove")],
    )

    await handle_chat_message(conn, cache, source, "go")

    assert in_transaction_at_await == [False, False, False]
    assert conn.in_transaction is False
    other = sqlite3.connect(os.environ["FINALLY_DB_PATH"])
    watched = {row[0] for row in other.execute("SELECT ticker FROM watchlist")}
    assert {"PYPL", "UBER"} <= watched and "AAPL" not in watched
    assert other.execute("SELECT COUNT(*) FROM trades").fetchone()[0] == 1
    assert other.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0] == 2
    other.close()


async def test_no_transaction_open_during_llm_call(conn, cache, source, monkeypatch):
    seen = {}

    async def fake_generate_reply(messages, user_message):
        seen["in_transaction"] = conn.in_transaction
        other = sqlite3.connect(os.environ["FINALLY_DB_PATH"], timeout=0)
        other.execute("BEGIN IMMEDIATE")
        other.rollback()
        other.close()
        seen["lock_taken"] = True
        return reply(trades=[("AAPL", "buy", 1)], changes=[("PYPL", "add")])

    monkeypatch.setattr(service, "generate_reply", fake_generate_reply)

    await handle_chat_message(conn, cache, source, "go")

    assert seen == {"in_transaction": False, "lock_taken": True}


async def test_reply_without_actions_stores_empty_list(conn, cache, source, fake_reply):
    fake_reply["reply"] = reply()

    result = await handle_chat_message(conn, cache, source, "hello")

    assert result["actions"] == []
    assert repository.recent_chat_messages(conn)[-1].actions == []
    assert repository.get_cash(conn) == 10000.0


CAP_TICKERS = ["PYPL", "UBER", "SHOP", "COIN", "PLTR", "SNOW", "ROKU"]


async def test_actions_over_the_cap_are_skipped_not_rejected(conn, cache, source, fake_reply):
    fake_reply["reply"] = reply(
        trades=[("AAPL", "buy", 0.5)] * 7,
        changes=[(ticker, "add") for ticker in CAP_TICKERS],
    )

    result = await handle_chat_message(conn, cache, source, "flood")

    actions = result["actions"]
    assert result["message"] == "ok"
    assert len(actions) == 14
    assert [(a["ticker"], a["status"]) for a in actions[:5]] == [(t, "ok") for t in CAP_TICKERS[:5]]
    for skipped_change, ticker in zip(actions[5:7], ["SNOW", "ROKU"]):
        assert skipped_change["type"] == "watchlist" and skipped_change["ticker"] == ticker
        assert skipped_change["status"] == "failed"
        assert skipped_change["error"].startswith("Skipped: only the first 5 watchlist changes")
    assert [(a["type"], a["status"]) for a in actions[7:12]] == [("trade", "ok")] * 5
    for skipped_trade in actions[12:]:
        assert skipped_trade["type"] == "trade" and skipped_trade["status"] == "failed"
        assert skipped_trade["error"].startswith("Skipped: only the first 5 trades")
    assert repository.get_cash(conn) == 9750.0
    assert repository.is_watched(conn, "PLTR")
    assert not repository.is_watched(conn, "SNOW") and not repository.is_watched(conn, "ROKU")
    assert repository.recent_chat_messages(conn)[-1].actions == actions


@pytest.mark.parametrize(("count", "executed", "skipped"), [(5, 5, 0), (6, 5, 1)])
async def test_trade_cap_boundary(conn, cache, source, fake_reply, count, executed, skipped):
    fake_reply["reply"] = reply(trades=[("AAPL", "buy", 1)] * count)

    result = await handle_chat_message(conn, cache, source, "buy")

    statuses = [a["status"] for a in result["actions"]]
    assert statuses.count("ok") == executed
    assert statuses.count("failed") == skipped
    assert repository.get_cash(conn) == 10000.0 - executed * 100


async def test_cap_applies_per_kind(conn, cache, source, fake_reply):
    fake_reply["reply"] = reply(
        trades=[("AAPL", "buy", 1)] * 5,
        changes=[(ticker, "add") for ticker in CAP_TICKERS[:5]],
    )

    result = await handle_chat_message(conn, cache, source, "both kinds at the cap")

    assert [a["status"] for a in result["actions"]] == ["ok"] * 10
