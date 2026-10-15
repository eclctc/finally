import sqlite3
from datetime import datetime, timedelta, timezone

import pytest

from app.db import repository as repo
from app.db.connection import DEFAULT_TICKERS


def test_cash_get_and_set(conn):
    assert repo.get_cash(conn) == 10000.0
    repo.set_cash(conn, 1234.5)
    assert repo.get_cash(conn) == 1234.5


def test_list_watchlist_returns_seed_in_order(conn):
    assert repo.list_watchlist(conn) == DEFAULT_TICKERS


def test_insert_watchlist_row_appends(conn):
    repo.insert_watchlist_row(conn, "PYPL")
    assert repo.list_watchlist(conn)[-1] == "PYPL"
    assert repo.is_watched(conn, "PYPL")


def test_insert_duplicate_watchlist_row_raises(conn):
    with pytest.raises(sqlite3.IntegrityError):
        repo.insert_watchlist_row(conn, "AAPL")


def test_delete_watchlist_row(conn):
    assert repo.delete_watchlist_row(conn, "AAPL") is True
    assert not repo.is_watched(conn, "AAPL")
    assert repo.delete_watchlist_row(conn, "AAPL") is False


def test_positions_upsert_get_and_delete(conn):
    assert repo.get_position(conn, "AAPL") is None
    assert not repo.has_position(conn, "AAPL")

    repo.upsert_position(conn, "AAPL", 10, 190.0)
    repo.upsert_position(conn, "AAPL", 15, 195.0)
    position = repo.get_position(conn, "AAPL")
    assert (position.ticker, position.quantity, position.avg_cost) == ("AAPL", 15, 195.0)
    assert repo.has_position(conn, "AAPL")

    repo.upsert_position(conn, "MSFT", 2.5, 400.0)
    assert [p.ticker for p in repo.list_positions(conn)] == ["AAPL", "MSFT"]

    repo.delete_position(conn, "AAPL")
    assert [p.ticker for p in repo.list_positions(conn)] == ["MSFT"]


def test_insert_trade_returns_and_stores_trade(conn):
    trade = repo.insert_trade(conn, "AAPL", "buy", 1.5, 190.0)
    assert (trade.ticker, trade.side, trade.quantity, trade.price) == ("AAPL", "buy", 1.5, 190.0)
    row = conn.execute("SELECT * FROM trades WHERE id = ?", (trade.id,)).fetchone()
    assert row["executed_at"] == trade.executed_at
    assert row["user_id"] == "default"


def test_snapshots_listed_oldest_first(conn):
    repo.insert_snapshot(conn, 10000.0)
    repo.insert_snapshot(conn, 10050.0)
    assert [s.total_value for s in repo.list_snapshots(conn)] == [10000.0, 10050.0]


def test_insert_snapshot_prunes_older_than_seven_days(conn):
    old = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    recent = (datetime.now(timezone.utc) - timedelta(days=6)).isoformat()
    conn.execute(
        "INSERT INTO portfolio_snapshots (id, total_value, recorded_at) VALUES ('old', 1, ?), ('recent', 2, ?)",
        (old, recent),
    )
    repo.insert_snapshot(conn, 3.0)
    assert [s.total_value for s in repo.list_snapshots(conn)] == [2.0, 3.0]


def test_chat_messages_round_trip_actions(conn):
    actions = [{"type": "trade", "ticker": "AAPL", "side": "buy", "quantity": 1, "status": "ok"}]
    repo.insert_chat_message(conn, "user", "buy apple", None)
    repo.insert_chat_message(conn, "assistant", "done", actions)
    messages = repo.recent_chat_messages(conn)
    assert [(m.role, m.content, m.actions) for m in messages] == [
        ("user", "buy apple", None),
        ("assistant", "done", actions),
    ]


def test_recent_chat_messages_limits_to_latest_oldest_first(conn):
    for index in range(25):
        repo.insert_chat_message(conn, "user", f"msg {index}", None)
    messages = repo.recent_chat_messages(conn, limit=20)
    assert [m.content for m in messages] == [f"msg {index}" for index in range(5, 25)]
