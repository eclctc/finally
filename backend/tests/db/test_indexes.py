import pytest

from app.db import init_db

TIME_ORDERED_QUERIES = {
    "snapshot prune": (
        "DELETE FROM portfolio_snapshots WHERE user_id = ? AND recorded_at < ?",
        ("default", "2026-01-01T00:00:00+00:00"),
    ),
    "snapshot list": (
        "SELECT * FROM portfolio_snapshots WHERE user_id = ? ORDER BY recorded_at, rowid",
        ("default",),
    ),
    "recent chat": (
        "SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?",
        ("default", 20),
    ),
}


@pytest.mark.parametrize("sql, params", TIME_ORDERED_QUERIES.values(), ids=TIME_ORDERED_QUERIES.keys())
def test_time_ordered_queries_use_an_index(conn, sql, params):
    plan_rows = conn.execute(f"EXPLAIN QUERY PLAN {sql}", params).fetchall()
    plan = " | ".join(row["detail"] for row in plan_rows)
    assert "USING INDEX" in plan
    assert "TEMP B-TREE" not in plan


def test_init_db_adds_missing_indexes(db_path, conn):
    conn.execute("DROP INDEX idx_snapshots_user_time")
    conn.execute("DROP INDEX idx_chat_user_time")
    conn.commit()

    init_db()

    names = {row["name"] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'index'")}
    assert {"idx_snapshots_user_time", "idx_chat_user_time"} <= names
