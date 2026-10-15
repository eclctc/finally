"""Data access functions. Each takes an open connection; the caller owns the transaction."""

import json
import sqlite3
from datetime import datetime, timedelta, timezone

from app.db.connection import DEFAULT_USER, new_id, now_iso
from app.db.models import ChatMessage, Position, Snapshot, Trade

SNAPSHOT_RETENTION = timedelta(days=7)


def get_cash(conn: sqlite3.Connection, user_id: str = DEFAULT_USER) -> float:
    """Cash balance for the user."""
    row = conn.execute("SELECT cash_balance FROM users_profile WHERE id = ?", (user_id,)).fetchone()
    return row["cash_balance"]


def set_cash(conn: sqlite3.Connection, amount: float, user_id: str = DEFAULT_USER) -> None:
    """Overwrite the user's cash balance."""
    conn.execute("UPDATE users_profile SET cash_balance = ? WHERE id = ?", (amount, user_id))


def list_watchlist(conn: sqlite3.Connection, user_id: str = DEFAULT_USER) -> list[str]:
    """Watched tickers in the order they were added."""
    rows = conn.execute(
        "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY added_at, rowid", (user_id,)
    ).fetchall()
    return [row["ticker"] for row in rows]


def is_watched(conn: sqlite3.Connection, ticker: str, user_id: str = DEFAULT_USER) -> bool:
    """True if the ticker is on the user's watchlist."""
    row = conn.execute(
        "SELECT 1 FROM watchlist WHERE user_id = ? AND ticker = ?", (user_id, ticker)
    ).fetchone()
    return row is not None


def insert_watchlist_row(conn: sqlite3.Connection, ticker: str, user_id: str = DEFAULT_USER) -> None:
    """Add a ticker to the watchlist. Raises IntegrityError if already present."""
    conn.execute(
        "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
        (new_id(), user_id, ticker, now_iso()),
    )


def delete_watchlist_row(conn: sqlite3.Connection, ticker: str, user_id: str = DEFAULT_USER) -> bool:
    """Remove a ticker from the watchlist. Returns False if it was not watched."""
    cursor = conn.execute("DELETE FROM watchlist WHERE user_id = ? AND ticker = ?", (user_id, ticker))
    return cursor.rowcount > 0


def list_positions(conn: sqlite3.Connection, user_id: str = DEFAULT_USER) -> list[Position]:
    """All open positions ordered by ticker."""
    rows = conn.execute(
        "SELECT * FROM positions WHERE user_id = ? ORDER BY ticker", (user_id,)
    ).fetchall()
    return [Position(**row) for row in rows]


def get_position(conn: sqlite3.Connection, ticker: str, user_id: str = DEFAULT_USER) -> Position | None:
    """The user's position in a ticker, or None."""
    row = conn.execute(
        "SELECT * FROM positions WHERE user_id = ? AND ticker = ?", (user_id, ticker)
    ).fetchone()
    return Position(**row) if row else None


def has_position(conn: sqlite3.Connection, ticker: str, user_id: str = DEFAULT_USER) -> bool:
    """True if the user holds the ticker."""
    return get_position(conn, ticker, user_id) is not None


def upsert_position(
    conn: sqlite3.Connection, ticker: str, quantity: float, avg_cost: float, user_id: str = DEFAULT_USER
) -> None:
    """Insert a position or replace its quantity and average cost."""
    conn.execute(
        """
        INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, ticker) DO UPDATE SET
            quantity = excluded.quantity,
            avg_cost = excluded.avg_cost,
            updated_at = excluded.updated_at
        """,
        (new_id(), user_id, ticker, quantity, avg_cost, now_iso()),
    )


def delete_position(conn: sqlite3.Connection, ticker: str, user_id: str = DEFAULT_USER) -> None:
    """Remove the user's position in a ticker."""
    conn.execute("DELETE FROM positions WHERE user_id = ? AND ticker = ?", (user_id, ticker))


def insert_trade(
    conn: sqlite3.Connection, ticker: str, side: str, quantity: float, price: float, user_id: str = DEFAULT_USER
) -> Trade:
    """Append a trade to the log and return it."""
    trade = Trade(new_id(), user_id, ticker, side, quantity, price, now_iso())
    conn.execute(
        "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (trade.id, trade.user_id, trade.ticker, trade.side, trade.quantity, trade.price, trade.executed_at),
    )
    return trade


def insert_snapshot(conn: sqlite3.Connection, total_value: float, user_id: str = DEFAULT_USER) -> None:
    """Record a portfolio value snapshot and prune the user's snapshots older than 7 days."""
    conn.execute(
        "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) VALUES (?, ?, ?, ?)",
        (new_id(), user_id, total_value, now_iso()),
    )
    cutoff = (datetime.now(timezone.utc) - SNAPSHOT_RETENTION).isoformat()
    conn.execute(
        "DELETE FROM portfolio_snapshots WHERE user_id = ? AND recorded_at < ?", (user_id, cutoff)
    )


def list_snapshots(conn: sqlite3.Connection, user_id: str = DEFAULT_USER) -> list[Snapshot]:
    """Portfolio snapshots, oldest first."""
    rows = conn.execute(
        "SELECT * FROM portfolio_snapshots WHERE user_id = ? ORDER BY recorded_at, rowid", (user_id,)
    ).fetchall()
    return [Snapshot(**row) for row in rows]


def insert_chat_message(
    conn: sqlite3.Connection, role: str, content: str, actions: list[dict] | None, user_id: str = DEFAULT_USER
) -> None:
    """Store a chat message; actions are serialized to JSON text."""
    actions_json = json.dumps(actions) if actions is not None else None
    conn.execute(
        "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (new_id(), user_id, role, content, actions_json, now_iso()),
    )


def recent_chat_messages(conn: sqlite3.Connection, limit: int = 20, user_id: str = DEFAULT_USER) -> list[ChatMessage]:
    """The latest chat messages, returned oldest first."""
    rows = conn.execute(
        "SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
        (user_id, limit),
    ).fetchall()
    return [_row_to_chat_message(row) for row in reversed(rows)]


def _row_to_chat_message(row: sqlite3.Row) -> ChatMessage:
    """Build a ChatMessage, decoding the actions JSON."""
    actions = json.loads(row["actions"]) if row["actions"] is not None else None
    return ChatMessage(row["id"], row["user_id"], row["role"], row["content"], actions, row["created_at"])
