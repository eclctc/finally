"""SQLite persistence layer for FinAlly."""

from app.db.connection import DEFAULT_USER, get_connection, init_db

__all__ = ["DEFAULT_USER", "get_connection", "init_db"]
