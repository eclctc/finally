---
phase: 02-backend-hardening
plan: 04
subsystem: backend-chat-persistence
tags: [sqlite, savepoint, chat, atomicity, fastapi]

requires:
  - phase: 01-walking-skeleton
    provides: existing backend (chat service, portfolio and watchlist services)
provides:
  - savepoint(conn) context manager exported from app.db
  - per-action isolation in chat turns via run_action with fixed UNEXPECTED_ERROR reason
  - trade plus snapshot as one atomic unit; watchlist writes committed before any market-source await
  - chat user and assistant rows stored together with exactly the returned actions
affects: [05-ai-chat, backend-hardening]

actuals:
  tokens: 5200
  tasks: 2
  commits: 4
plan_head_before: 6ba74b25c583d370b65cc4b4ca933612ee254157
plan_head_after: 6d7798b0a11b64fa6deea983cef2b1c61d3e12af

tech-stack:
  added: []
  patterns:
    - "savepoint(conn): one fixed-name SAVEPOINT; outermost RELEASE commits, nested rolls back only itself"
    - "Never await inside a savepoint; await the market source before or after the DB unit"

key-files:
  created: []
  modified:
    - backend/app/db/connection.py
    - backend/app/db/__init__.py
    - backend/app/services/portfolio.py
    - backend/app/services/watchlist.py
    - backend/app/chat/service.py
    - backend/tests/chat/test_service.py
    - backend/tests/db/test_connection.py
    - backend/tests/services/test_portfolio.py

key-decisions:
  - "Per-action committed units via savepoint(conn), not one transaction around the whole turn (avoids holding a write lock across awaits)"
  - "Unexpected action failures return the fixed UNEXPECTED_ERROR string; the real exception goes to logger.exception only"
  - "The broad except Exception in run_action is a deliberate HARD-05 exception to the convention that reserves broad catches for background loops; confined to that one boundary"

patterns-established:
  - "run_action boundary: ACTION_ERRORS -> str(exc); any other Exception -> logged, fixed reason"
  - "describe_* helpers build the action record before the outcome is known"

requirements-completed: [HARD-05]

coverage:
  - id: D1
    description: "An unexpected exception in one chat action is recorded as a failed action with a fixed reason while the other actions still commit"
    requirement: HARD-05
    verification:
      - kind: unit
        ref: "backend/tests/chat/test_service.py#test_unexpected_action_failure_is_isolated"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each action commits on its own; no transaction is open across market-source awaits or the LLM call"
    requirement: HARD-05
    verification:
      - kind: unit
        ref: "backend/tests/chat/test_service.py#test_actions_commit_one_by_one_without_spanning_awaits"
        status: pass
      - kind: unit
        ref: "backend/tests/chat/test_service.py#test_no_transaction_open_during_llm_call"
        status: pass
    human_judgment: false
  - id: D3
    description: "savepoint commit, nested rollback and re-raise behavior; a trade and its snapshot are one unit"
    requirement: HARD-05
    verification:
      - kind: unit
        ref: "backend/tests/db/test_connection.py (three savepoint tests); backend/tests/services/test_portfolio.py#test_trade_and_snapshot_are_one_unit"
        status: pass
    human_judgment: false
  - id: D4
    description: "Stored chat actions equal the returned actions; an actionless reply stores an empty list"
    requirement: HARD-05
    verification:
      - kind: unit
        ref: "backend/tests/chat/test_service.py#test_reply_without_actions_stores_empty_list"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 04: Atomic, isolated chat actions Summary

**`savepoint(conn)` replaces the connection-level commit as the unit of work, and a `run_action` wrapper turns any per-action failure (including unexpected `sqlite3.OperationalError`) into a stored `failed` action with the fixed reason `UNEXPECTED_ERROR`, so one bad action no longer aborts a chat turn.**

## Performance

- **Duration:** about 12 min
- **Tasks:** 2 (tracer + auto, both TDD)
- **Files modified:** 8 (5 source, 3 test)
- **Commits:** 4 (RED, GREEN, RED, GREEN)

## Accomplishments

- `savepoint(conn)` in `backend/app/db/connection.py`, exported from `app.db`: commits when outermost, rolls back only itself when nested, re-raises.
- `execute_trade` and `execute_trade_and_sync` use it; the trade and its portfolio snapshot succeed or fail together, and the market-source `remove_ticker` await now happens after the unit.
- `run_action`, `describe_trade`, `describe_watchlist_change`, `UNEXPECTED_ERROR` in `backend/app/chat/service.py`; `apply_trade` and `apply_watchlist_change` lost their duplicated try/except.
- User and assistant chat rows are written in one savepoint with actions equal to the returned list.
- Watchlist insert and delete are savepoint units that never span an await.

## TDD Gate Compliance

- **RED 1** (`1ca5190`): `test_unexpected_action_failure_is_isolated` failed with the target `sqlite3.OperationalError("disk I/O error")` escaping `handle_chat_message` (the planned reason; not an import or fixture fault).
- **GREEN 1** (`f085dfe`): savepoint helper, portfolio savepoints, `run_action`, chat rows in one unit; test passes along with chat, services, routes and db suites (57 passed).
- **RED 2** (`c4e73ef`): `test_actions_commit_one_by_one_without_spanning_awaits` failed with `[False, True, True]` instead of `[False, False, False]` (the watchlist insert left a transaction open across the next await). The other new tests (`test_no_transaction_open_during_llm_call`, `test_reply_without_actions_stores_empty_list`, the three savepoint tests, `test_trade_rolls_back_with_an_enclosing_savepoint`, `test_trade_and_snapshot_are_one_unit`) already passed on the Task 1 code; they pin the contract and are regression guards, not reproductions, as the plan anticipated.
- **GREEN 2** (`6d7798b`): watchlist writes wrapped in savepoints; full suite 112 passed.
- No REFACTOR commit was needed. RED evidence was assessed manually by inspecting pytest output (the `gsd check tdd-red-evidence` classifier was not run; pytest output is not one of its supported report formats).

## Deviations from Plan

None - plan executed exactly as written. One note on a project convention: the plan text said the broad `except Exception` in `run_action` is "allowed by the project conventions". Per the project notes, the `run_action` docstring states the HARD-05 rationale instead, and the catch is confined to that single boundary with `logger.exception`.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None - no new endpoints, auth paths or schema changes. Mitigations T-02-07, T-02-08, T-02-09 from the plan threat model are implemented and covered by tests.

## Verification

- `cd backend && uv run pytest -q`: 112 passed (baseline 103 + 9 new tests).
- `grep -v '^\s*#' backend/app/services/portfolio.py | grep -c 'with conn:'` outputs 0.
- All task acceptance-criteria greps pass (savepoint def/export, run_action, UNEXPECTED_ERROR, describe helpers, new test names, `with savepoint(conn):` counts of 2 in portfolio.py and 2 in watchlist.py).

## Next Phase Readiness

HARD-05 is complete. Phase 5 can show `failed` actions inline; `UNEXPECTED_ERROR` is a public string. Accepted limitation (research A6): if the final chat-row insert itself fails (storage fault), earlier committed actions stay unrecorded and the request returns 500.

## Self-Check: PASSED

Modified files exist, and commits `1ca5190`, `f085dfe`, `c4e73ef`, `6d7798b` are on the branch.
