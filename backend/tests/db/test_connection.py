import sqlite3

import pytest

from app.db import get_connection, init_db, repository, savepoint

TABLES = {"users_profile", "watchlist", "positions", "trades", "portfolio_snapshots", "chat_messages"}


def test_init_db_creates_file_and_tables(db_path):
    assert db_path.exists()
    with get_connection() as conn:
        rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    assert TABLES <= {row["name"] for row in rows}


def test_init_db_seeds_default_user_and_watchlist(conn):
    user = conn.execute("SELECT * FROM users_profile").fetchone()
    assert user["id"] == "default"
    assert user["cash_balance"] == 10000.0
    count = conn.execute("SELECT COUNT(*) FROM watchlist WHERE user_id = 'default'").fetchone()[0]
    assert count == 10


def test_init_db_is_idempotent(db_path):
    with get_connection() as conn:
        conn.execute("UPDATE users_profile SET cash_balance = 5.0")
    init_db()
    with get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM users_profile").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM watchlist").fetchone()[0] == 10
        assert conn.execute("SELECT cash_balance FROM users_profile").fetchone()[0] == 5.0


def test_connection_uses_wal_and_row_factory(conn):
    assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    assert conn.row_factory is sqlite3.Row


def test_connection_rolls_back_on_error(db_path):
    with pytest.raises(RuntimeError):
        with get_connection() as conn:
            conn.execute("UPDATE users_profile SET cash_balance = 1.0")
            raise RuntimeError("boom")
    with get_connection() as conn:
        assert conn.execute("SELECT cash_balance FROM users_profile").fetchone()[0] == 10000.0


def test_watchlist_unique_per_user(conn):
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO watchlist (id, ticker, added_at) VALUES ('x', 'AAPL', '2026-01-01')"
        )


def test_outermost_savepoint_commits(db_path):
    with get_connection() as conn:
        with savepoint(conn):
            conn.execute("UPDATE users_profile SET cash_balance = 1.0")
        assert conn.in_transaction is False
        other = sqlite3.connect(db_path)
        assert other.execute("SELECT cash_balance FROM users_profile").fetchone()[0] == 1.0
        other.close()


def test_nested_savepoint_rolls_back_only_itself(conn):
    with savepoint(conn):
        repository.insert_watchlist_row(conn, "PYPL")
        with pytest.raises(RuntimeError):
            with savepoint(conn):
                repository.insert_watchlist_row(conn, "UBER")
                raise RuntimeError("boom")
    assert repository.is_watched(conn, "PYPL")
    assert not repository.is_watched(conn, "UBER")


def test_savepoint_rolls_back_and_reraises(conn):
    with pytest.raises(RuntimeError):
        with savepoint(conn):
            conn.execute("UPDATE users_profile SET cash_balance = 1.0")
            raise RuntimeError("boom")
    assert repository.get_cash(conn) == 10000.0
    assert conn.in_transaction is False
