"""SQLite connection handling and lazy schema initialization."""

import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

DEFAULT_USER = "default"
DEFAULT_CASH = 10000.0
DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def now_iso() -> str:
    """Current UTC time as an ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    """New random UUID string for a primary key."""
    return str(uuid.uuid4())


def get_db_path() -> Path:
    """Database file path from FINALLY_DB_PATH, defaulting to <repo>/db/finally.db."""
    return Path(os.environ.get("FINALLY_DB_PATH", REPO_ROOT / "db" / "finally.db"))


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    """Open a WAL-mode connection; commit on success, roll back on error, always close."""
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Create tables and seed the default user and watchlist if missing. Idempotent."""
    with get_connection() as conn:
        conn.executescript(SCHEMA_PATH.read_text())
        _seed_defaults(conn)


def _seed_defaults(conn: sqlite3.Connection) -> None:
    """Insert the default user and watchlist only when no user profile exists yet."""
    if conn.execute("SELECT 1 FROM users_profile WHERE id = ?", (DEFAULT_USER,)).fetchone():
        return
    timestamp = now_iso()
    conn.execute(
        "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
        (DEFAULT_USER, DEFAULT_CASH, timestamp),
    )
    conn.executemany(
        "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
        [(new_id(), DEFAULT_USER, ticker, timestamp) for ticker in DEFAULT_TICKERS],
    )
