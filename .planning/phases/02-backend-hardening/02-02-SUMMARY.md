---
phase: 02-backend-hardening
plan: 02
subsystem: database
tags: [sqlite, idempotent-insert, indexes, tdd]
requires: []
provides:
  - Idempotent watchlist insert (ON CONFLICT DO NOTHING)
  - Per-user time-ordered indexes on portfolio_snapshots and chat_messages
affects: [backend/app/services/watchlist.py (plan 02-04 builds on this)]
tech-stack:
  added: []
  patterns: ["let the UNIQUE constraint arbitrate races via ON CONFLICT", "CREATE INDEX IF NOT EXISTS in schema.sql applied by init_db on every startup"]
key-files:
  created:
    - backend/tests/db/test_indexes.py
  modified:
    - backend/app/db/repository.py
    - backend/app/db/schema.sql
    - backend/tests/db/test_repository.py
    - backend/tests/services/test_watchlist.py
key-decisions:
  - "Fix the duplicate-add race in SQL (ON CONFLICT DO NOTHING) rather than try/except around the insert"
  - "Deliver indexes to existing volumes through init_db's executescript, no migration step"
requirements-completed: [HARD-04, HARD-08]
status: complete
plan_head_before: 6ba74b25c583d370b65cc4b4ca933612ee254157
plan_head_after: ef19fe8fcfe4c0907b1959621dbeea9226756c79
actuals:
  tokens: 3000
  tasks: 2
  commits: 4
duration: 15min
completed: 2026-10-16
---

# Phase 2 Plan 02: Idempotent Watchlist Insert and History Indexes Summary

Concurrent same-ticker watchlist adds now store one row and raise nothing (`ON CONFLICT (user_id, ticker) DO NOTHING`), and the snapshot prune/list and recent-chat queries are served by two per-user, time-ordered indexes with no temp sort.

## Tasks

1. **Task 1 (tracer): concurrent adds store one row.** RED commit `d05fcb6`, GREEN commit `6dc35e9`.
2. **Task 2: time-ordered indexes.** RED commit `8f38a5c`, GREEN commit `ef19fe8`.

## TDD Evidence

**Task 1 RED.** Ran `uv run pytest -q tests/services/test_watchlist.py tests/db/test_repository.py`: 2 failed, 20 passed. Both target tests failed with `sqlite3.IntegrityError: UNIQUE constraint failed: watchlist.user_id, watchlist.ticker` raised from `insert_watchlist_row`. Semantic assessment: the race test reached the insert for the second caller after both passed the `is_watched` pre-check (the monkeypatched `add_ticker` yields once), so it reproduces the planned bug, not a fixture fault.

**Task 2 RED.** `uv run pytest -q tests/db/test_indexes.py`: 4 failed. The three query-plan cases failed on the assertion `'USING INDEX' in 'SCAN portfolio_snapshots | USE TEMP B-TREE FOR ORDER BY'` (and the prune/chat equivalents). `test_init_db_adds_missing_indexes` failed with `sqlite3.OperationalError: no such index: idx_snapshots_user_time` at its DROP INDEX setup step, which is the expected state before the indexes exist (it is not an assertion failure; the index being absent is exactly the missing behavior).

**GREEN.** Both tasks pass; full backend suite 108 passed (103 baseline plus 5 new: 1 race test, 3 parametrized plan cases, 1 init_db test; the replaced repository test is net zero).

The plan is `type: execute`, so the formal `tdd-red-evidence` classifier was not required.

## Deviations from Plan

None - plan executed exactly as written. One small cleanup: the `sqlite3` and `pytest` imports in `backend/tests/db/test_repository.py` became unused after replacing the IntegrityError test and were removed.

## Verification

- `cd backend && uv run pytest -q tests/services/test_watchlist.py tests/db/test_repository.py tests/routes`: 32 passed
- `cd backend && uv run pytest -q tests/db/`: 21 passed
- `cd backend && uv run pytest -q`: 108 passed
- Acceptance greps: `ON CONFLICT (user_id, ticker) DO NOTHING` count 1 in repository.py; both `CREATE INDEX IF NOT EXISTS` lines present in schema.sql.

## Known Stubs

None.

## Threat Flags

None. T-02-04 and T-02-05 mitigated as planned; `backend/app/services/watchlist.py` was not modified (plan 02-04 owns it).

## Self-Check: PASSED

- FOUND: backend/tests/db/test_indexes.py
- FOUND commits: d05fcb6, 6dc35e9, 8f38a5c, ef19fe8
