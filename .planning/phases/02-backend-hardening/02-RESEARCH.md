# Phase 2: Backend Hardening - Research

**Researched:** 2026-10-16
**Domain:** Hardening an existing FastAPI + sqlite3 + LiteLLM backend (error mapping, idempotent writes, transaction boundaries, price-cache state, indexes)
**Confidence:** HIGH. Every defect was reproduced against the current code this session. The library behaviors (LiteLLM timeout and empty-choices shapes, sqlite3 SAVEPOINT semantics, query plans) were tested by running the installed packages, not recalled.

<user_constraints>
## User Constraints (from CONTEXT.md)

No `02-CONTEXT.md` exists. The user chose to continue without discuss-phase. The effective constraints come from the planner prompt, ROADMAP.md, STATE.md and the project CLAUDE.md files.

### Locked Decisions
- Backend-only phase on the existing, working backend in `/Users/brett/Projects/finally/backend` (uv, Python 3.12, 103 passing pytest tests). Keep it and harden it with targeted fixes. Do not redesign.
- Research flag (ROADMAP): prove the transaction boundary with a failing test first. `execute_trade`'s `with conn:` commits, so nesting does not give atomicity. Use per-action SAVEPOINTs opened only after the LLM returns. Enforce the action cap in the service, not the schema.
- Cap is 5 trades and 5 watchlist changes per chat turn. Items over the cap are recorded as `failed` actions with a reason, and the reply is not rejected.
- Chat history stays session-only (`GET /api/chat` is v2). No cloud deploy, Docker hardening or root repo cleanup.
- User style: simple, incremental, no defensive over-engineering, short well-named functions, docstrings, exceptions only where needed, root cause proven before fixing, `uv run` only, no emojis.

### Claude's Discretion
- Exact public error wording, the timeout value, the savepoint helper's home, plan slicing.
- How the simulator behaves on re-add (see Open Question 2).

### Deferred Ideas (OUT OF SCOPE)
- Frontend work (Phases 3 to 6), watchlist size cap (DATA-V2-03), server-side history bucketing, `GET /api/chat`, the `position_summary` avg-cost fallback, async/threadpool conversion of sqlite calls, auth.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HARD-01 | `POST /api/chat` returns 502 not 500 on no choices, empty or unparseable content | `request_reply` indexes `response.choices[0]` outside the `try`. Reproduced `IndexError` for `choices=[]` and `AttributeError` for `message=None`. A real LiteLLM call against a fake server returned `len(choices) == 0` for `"choices": []`. |
| HARD-02 | Fixed public 502 message, full error only in the log, keep actionable missing-key message | Reproduced two leaks: `LLMError(f"LLM request failed: {exc}")` and the pydantic `ValidationError` text (which echoes `input_value`). Fix: constant messages plus `logger.exception`. |
| HARD-03 | LLM request timeout, timeout gives 502 | `acompletion(timeout=...)` is real. The default is 600 s. Measured: `timeout=1` raised `litellm.exceptions.Timeout` after 1.13 s with exactly one connection (no hidden retries). |
| HARD-04 | Concurrent same-ticker adds never 500 | Reproduced `sqlite3.IntegrityError` via `asyncio.gather`. Fix is `ON CONFLICT (user_id, ticker) DO NOTHING`. |
| HARD-05 | Unexpected action failure is a `failed` action, the stored message matches what executed, no write lock across the LLM call | Reproduced the abort (`OperationalError` propagates, cash 9900.0, 0 chat rows). The savepoint design below is proven by sqlite3 experiments. |
| HARD-06 | Cap of 5 trades and 5 watchlist changes, overflow recorded as `failed` | Service-level slicing. Schema untouched. |
| HARD-07 | Re-add keeps the original session open price | Reproduced the reset (`open` 110.0 instead of 100.0). The simulator also draws a new random price on re-add, which the fix must handle. |
| HARD-08 | Per-user time-ordered indexes on `portfolio_snapshots` and `chat_messages` | Query plans captured before (SCAN + TEMP B-TREE) and after (SEARCH USING INDEX). |
| INT-04 | pytest passes with a test reproducing each fix | Reproduction tests for every item exist as scratch tests (see Validation Architecture). |
</phase_requirements>

## Summary

All defects are real and reproduce on the current code (103 tests pass today). The fixes are small and local. The only part needing design care is the chat turn. `execute_trade` uses `with conn:`, which COMMITs on exit, so wrapping it in an outer SAVEPOINT fails with `no such savepoint: sp` (reproduced) and also commits the outer work. The fix is a tiny `savepoint(conn)` context manager that works both as the outermost unit (RELEASE commits) and nested (RELEASE only merges). `execute_trade` swaps `with conn:` for `with savepoint(conn):`, and the chat service isolates each action behind a catch-all that records `failed`.

Key hazard found while researching: SQLite write locks and read snapshots must never span an `await` that really suspends. Only `MassiveDataSource.add_ticker` suspends (via `asyncio.to_thread`). The service uses synchronous sqlite on the event loop, so another coroutine's write blocks the whole loop for the 5 s busy timeout while the suspended chat coroutine holds the lock. A deferred transaction that reads, awaits, then writes also fails immediately with `database is locked` (reproduced). So savepoints must wrap only the synchronous write section of each action, never the awaited market lookup. The "DB write lock is not held across the LLM call" criterion is already true today (the connection is only SELECTing at that point). The new code must not regress it, so add a guard test.

**Primary recommendation:** Three parallel, test-first plans: (A) LLM boundary (HARD-01/02/03), (B) small independent fixes (HARD-04 idempotent insert, HARD-07 session open memory plus simulator resume, HARD-08 indexes), (C) chat turn (savepoint helper, per-action isolation, caps; HARD-05/06). INT-04 is the gate on all three.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LLM error mapping to 502 and timeout | API / Backend (`chat/llm.py`, `chat/router.py`) | — | Boundary with the third party. The router already maps `LLMError` to 502. |
| Public vs logged error text | API / Backend | — | Logging is server-side only. |
| Idempotent watchlist add | Database / Storage (`ON CONFLICT`) | API / Backend service | The UNIQUE constraint is the source of truth for duplicates. |
| Per-action atomicity and caps | API / Backend (`chat/service.py`, `services/*`) | Database (SAVEPOINT) | Business rule lives in the service. SQLite provides the savepoint. |
| Session open price memory | In-memory price cache (`market/cache.py`) | Market source (simulator) | Open price is cache state for the backend lifetime. |
| Time-ordered query indexes | Database / Storage (`schema.sql`) | — | Applied idempotently at startup by `init_db`. |

## Standard Stack

No new dependencies. All versions are already pinned in `backend/uv.lock`.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python | 3.12.13 | Runtime | `requires-python = ">=3.12"` [VERIFIED: `uv run python`] |
| sqlite3 (stdlib) | SQLite 3.53.1 | Persistence, SAVEPOINT, `ON CONFLICT DO NOTHING` | Already the only DB layer [VERIFIED: `sqlite3.sqlite_version`] |
| litellm | 1.105.1 | `acompletion(timeout=...)`, `litellm.exceptions.Timeout` | Existing LLM gateway [VERIFIED: `importlib.metadata`] |
| pydantic | 2.14.1 | `ChatReply` validation | Existing [VERIFIED] |
| fastapi | 0.143.2 | Routes, TestClient | Existing [VERIFIED] |

### Supporting (tests)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest | 9.1.1 | Runner (`asyncio_mode = "auto"`) | All tests |
| pytest-asyncio | 1.4.0 | Async tests, `asyncio.gather` race repro | HARD-04, HARD-05 |
| httpx | 0.28.1 | TestClient transport | Route-level 502 tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ON CONFLICT DO NOTHING` | `try/except IntegrityError` in the service | Works, but needs exception handling the project style discourages. |
| Per-action committed savepoints (recommended) | One `BEGIN` around the whole turn | Stronger atomicity with the chat rows, but holds a write lock and read snapshot across Massive's `await` (see Pitfall 3). |

**Installation:** none. **Package legitimacy:** this phase installs no external packages, so no legitimacy gate run is needed.

## Package Legitimacy Audit

No packages are added or changed. Audit not applicable.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
POST /api/chat
   |
   v
chat/router.py  --(LLMError)--> 502 {"error": <fixed public message>}
   |
   v
chat/service.handle_chat_message
   1. SELECT-only context (portfolio, watchlist, last 20 messages)   [no txn, no lock]
   2. await generate_reply --> chat/llm.request_reply
          acompletion(timeout=30) -- Timeout/any Exception -> logger.exception + LLMError(fixed msg)
          choices[0].message.content -- missing -> same path
          parse_reply -- bad JSON/shape -> logger + LLMError(fixed msg)
   3. (LLM returned; only now do writes begin)
   4. cap: first 5 watchlist changes, first 5 trades run; the rest become failed actions
   5. for each action: run_action(perform)
          await market lookup (NO savepoint open)
          with savepoint(conn):  sync writes only  --> RELEASE (outermost) commits
          known error -> failed + str(exc); unexpected -> logger.exception + failed + fixed reason
   6. with savepoint(conn): insert user row + assistant row (actions == returned list)
   7. return {"message", "actions"}
```

### Recommended Project Structure
```
backend/app/
├── db/connection.py      # + savepoint(conn) context manager (export from db/__init__.py)
├── db/schema.sql         # + two CREATE INDEX IF NOT EXISTS
├── db/repository.py      # insert_watchlist_row -> ON CONFLICT DO NOTHING
├── chat/llm.py           # constants, timeout, fixed messages, logging
├── chat/service.py       # run_action, caps, describe helpers
├── market/cache.py       # _session_opens
└── market/simulator.py   # resume last price on re-add
```

### Pattern 1: `savepoint(conn)` context manager
**What:** One helper used wherever a write section must be atomic. Outermost use behaves like a transaction (RELEASE commits). Nested use rolls back only itself.
**Proven behavior** (Python 3.12.13, `isolation_level=''`, `autocommit=-1`, run this session):
- `SAVEPOINT` outside a transaction starts one (`in_transaction` True). Outermost `RELEASE` commits (a second connection sees the row).
- `with conn:` inside a savepoint commits everything, then `RELEASE sp` raises `OperationalError: no such savepoint: sp`.
- `ROLLBACK TO sp; RELEASE sp` inside an implicit write transaction keeps earlier pending rows and keeps `in_transaction` True.
- Same-name nested savepoints work as a stack, so one fixed name is enough.
- `with conn:` rollback also discards earlier pending (uncommitted) rows, e.g. an earlier successful watchlist insert (row `30` was lost in the experiment).
```python
# Source: verified by running sqlite3 experiments this session (scratchpad sp_exp.py)
@contextmanager
def savepoint(conn: sqlite3.Connection) -> Iterator[None]:
    """Atomic unit of work: commits when outermost, rolls back only itself when nested."""
    conn.execute("SAVEPOINT unit")
    try:
        yield
    except Exception:
        conn.execute("ROLLBACK TO unit")
        conn.execute("RELEASE unit")
        raise
    conn.execute("RELEASE unit")
```

### Pattern 2: One `run_action` wrapper in the chat service
**What:** Replaces the duplicated `try/except ACTION_ERRORS` in `apply_watchlist_change` and `apply_trade`.
```python
async def run_action(action: dict, perform) -> dict:
    """Run one action; any failure becomes a failed action instead of aborting the turn."""
    try:
        outcome = await perform()
    except ACTION_ERRORS as exc:
        return {**action, "status": "failed", "error": str(exc)}
    except Exception:
        logger.exception("Chat action failed unexpectedly: %s", action)
        return {**action, "status": "failed", "error": UNEXPECTED_ERROR}
    return {**action, "status": "ok", **outcome}
```
The unexpected-failure reason must be a fixed string. The failed action is stored and fed back to the LLM and the UI, so raw exception text (SQL, paths) must not enter it.

### Pattern 3: Cap in the service
```python
MAX_ACTIONS_PER_KIND = 5
def skipped(action: dict, noun: str) -> dict:
    return {**action, "status": "failed",
            "error": f"Skipped: only the first {MAX_ACTIONS_PER_KIND} {noun} per message are executed"}
```
Split `reply.watchlist_changes[:5]` and `[5:]` (same for trades). Extract `describe_trade(trade)` / `describe_watchlist_change(change)` from the existing `action = {...}` literals so executed and skipped items share one shape. Keep the order: watchlist actions first, then trades (`service.py:55-56`).

### Anti-Patterns to Avoid
- **Wrapping the awaited lookup in a savepoint.** A SAVEPOINT is a deferred transaction. SELECT then `await` (Massive suspends) then INSERT can fail instantly with `database is locked` (reproduced: error after 0.00 s, no busy-timeout wait).
- **`BEGIN IMMEDIATE` before awaits.** Holds the write lock while the loop serves other coroutines whose sync writes then block the loop for the busy timeout (reproduced: 0.33 s with a 0.3 s timeout).
- **`maxItems` / `max_length` on `ChatReply`.** Rejects the entire reply (502, nothing executes) and changes the `response_format` schema sent to the provider. The roadmap already says cap in the service.
- **Catching `Exception` around parse plus action execution in the LLM function.** Keep the LLM `try` to the request and extraction only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplicate-insert race | check-then-insert plus lock or retry loop | `INSERT ... ON CONFLICT (user_id, ticker) DO NOTHING` | The UNIQUE constraint already arbitrates. No exception handling needed. |
| Request timeout | `asyncio.wait_for` wrapper | `acompletion(timeout=...)` | Built in, raises `litellm.exceptions.Timeout`, no hidden retries (measured). |
| Nested atomicity | manual "transaction depth" counter | SQLite SAVEPOINT | Native, stackable. |
| Query ordering speed | in-app caching or pruning | composite indexes | Plans switch from SCAN + TEMP B-TREE to SEARCH USING INDEX. |

## Runtime State Inventory

Not a rename/migration phase. One relevant runtime note:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `finally-data` volumes lack the new indexes | None as a migration: `init_db` runs `executescript(schema.sql)` on every startup, so `CREATE INDEX IF NOT EXISTS` applies to existing volumes. Verify with a test that creates the old schema then runs `init_db`. |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | `OPENROUTER_API_KEY`, `LLM_MOCK` unchanged | None |
| Build artifacts | None | None |

## Common Pitfalls

### Pitfall 1: Nesting `execute_trade`'s `with conn:` inside a savepoint
**What goes wrong:** `with conn:` commits on exit, ending the transaction. The later `RELEASE` raises `no such savepoint`.
**How to avoid:** Replace `with conn:` in `execute_trade` (`services/portfolio.py:28`) with `with savepoint(conn):`. Standalone behavior is unchanged (outermost RELEASE commits). Write this as the failing test first.
**Warning signs:** `OperationalError: no such savepoint`.

### Pitfall 2: `with conn:` rollback discards unrelated pending work
**What goes wrong:** A chat turn adds PYPL (insert pending in an implicit transaction) and then a trade fails unexpectedly. `with conn:` rolls back everything uncommitted, so PYPL vanishes while the action list says `ok`. The stored message would not match reality.
**How to avoid:** Every write section is its own savepoint, so a failure rolls back only itself.

### Pitfall 3: Lock or snapshot held across a suspending `await`
**What goes wrong:** Only `MassiveDataSource.add_ticker` truly suspends (`asyncio.to_thread`). The simulator's coroutines never yield. So this is invisible in simulator mode and in tests unless the test source yields (`await asyncio.sleep(0)`).
**How to avoid:** `await` first, then `with savepoint(conn):` around the sync write. In `add_to_watchlist` wrap only `insert_watchlist_row`; in `remove_from_watchlist` wrap only `delete_watchlist_row`. In `execute_trade_and_sync` wrap `execute_trade` plus `record_portfolio_snapshot`, then do `await source.remove_ticker` after the savepoint (it is safe to move: a closed position is no longer valued, so the snapshot does not need its price).
**Alternative considered:** one `BEGIN` around the whole turn gives atomicity with the chat rows but needs the Massive lookups moved before the transaction. Not recommended (Open Question 1).

### Pitfall 4: `trade + snapshot` split across commits
**What goes wrong:** Today `execute_trade` commits, then `record_portfolio_snapshot` runs. If the snapshot raises, the trade is committed but the action would be labelled failed.
**How to avoid:** Put both in one savepoint in `execute_trade_and_sync`. A failed action then means nothing happened.

### Pitfall 5: Cache-only open fix creates nonsense for unknown simulator tickers
**What goes wrong:** Keeping the open in the cache is not enough. `GBMSimulator.remove` forgets the price and `add` draws a NEW random seed price for unknown tickers. Reproduced: first add 71.06, re-add 342.02. With a retained open of 71.06 the daily change would read about +381%.
**How to avoid:** Also make `GBMSimulator.remove` remember the last price and `add` resume from it. For Massive nothing extra is needed (re-add fetches the real price; the open is kept by the cache).

### Pitfall 6: Existing tests that encode the old behavior
Update these deliberately, not by accident:
1. `tests/chat/test_llm.py::test_request_failure_raises_llm_error` has `match="upstream down"` (asserts the leak).
2. `tests/db/test_repository.py::test_insert_duplicate_watchlist_row_raises` (duplicate raises `IntegrityError`; becomes "duplicate is ignored").
3. `tests/market/test_simulator.py::test_remove_and_readd_restarts_at_seed` (becomes "resumes at last price").

### Pitfall 7: Test sources that never yield hide the race
Use a wrapper `async def slow_add(t): await asyncio.sleep(0); return await real(t)` on the source, and open two separate connections via `get_connection()` (the `conn` fixture is one connection).

### Pitfall 8: The write-lock-across-LLM criterion passes today
At the LLM call the connection has only run SELECTs (`in_transaction` is False). A test for it is a regression guard, not a reproduction. State that honestly in the plan.

## Code Examples

### Reproductions (all executed against current code; scratch file `/private/tmp/claude-501/-Users-brett-Projects-finally/20e9045f-d8ce-4b82-8c58-2f8d643d1a0b/scratchpad/test_repro.py`)

| Req | Test idea | Observed today |
|-----|-----------|----------------|
| HARD-01 | fake `acompletion` returns `SimpleNamespace(choices=[])`, `choices=[SimpleNamespace(message=None)]`, `choices=None` | `IndexError: list index out of range` (and `AttributeError` for `message=None`) |
| HARD-02 | fake raises `RuntimeError("secret upstream detail sk-123")`; `parse_reply('{"message": "SECRETOUT"}')` | message is `LLM request failed: secret upstream detail sk-123`; schema error text echoes `input_value={'message': 'SECRETOUT'}` |
| HARD-04 | `asyncio.gather` of two `get_connection()` + `add_to_watchlist(..., "ZZZZ")` with a yielding source | `['ZZZZ', IntegrityError('UNIQUE constraint failed: watchlist.user_id, watchlist.ticker')]` |
| HARD-05 | patch `repository.insert_trade` to raise `sqlite3.OperationalError("disk I/O error")` on call 2 of 3 trades plus a PYPL add | `handle_chat_message` raises; cash 9900.0, chat rows 0, AAPL qty 1.0 |
| HARD-07 | `update 100`, `update 110`, `remove`, `update 110` | `open_price` 110.0 (expected 100.0) |
| HARD-08 | `EXPLAIN QUERY PLAN` on the three repository queries | `SCAN portfolio_snapshots` + `USE TEMP B-TREE FOR ORDER BY`; `SCAN chat_messages` + `USE TEMP B-TREE FOR ORDER BY` |

### LLM boundary (HARD-01/02/03)
Current code [VERIFIED: backend/app/chat/llm.py:37-39]:
```python
    except Exception as exc:
        raise LLMError(f"LLM request failed: {exc}") from exc
    return parse_reply(response.choices[0].message.content)
```
Target shape:
```python
TIMEOUT_SECONDS = 30
UPSTREAM_ERROR = "The AI assistant is unavailable, please try again"
TIMEOUT_ERROR = "The AI assistant timed out, please try again"
BAD_REPLY_ERROR = "The AI assistant returned an unusable reply, please try again"

try:
    response = await acompletion(model=MODEL, messages=messages, response_format=ChatReply,
        reasoning_effort="low", max_tokens=MAX_TOKENS, extra_body=EXTRA_BODY, timeout=TIMEOUT_SECONDS)
    content = response.choices[0].message.content
except Timeout as exc:                      # from litellm.exceptions import Timeout
    logger.exception("LLM request timed out")
    raise LLMError(TIMEOUT_ERROR) from exc
except Exception as exc:
    logger.exception("LLM request failed")
    raise LLMError(UPSTREAM_ERROR) from exc
return parse_reply(content)
```
`parse_reply` keeps its empty and invalid branches but raises `LLMError(BAD_REPLY_ERROR)` after `logger.exception`/`logger.warning` of the validation error. `raise LLMError("OPENROUTER_API_KEY is not set")` stays as is (existing test matches it). The router's `str(exc)` then becomes safe because every `LLMError` is built from a constant. Add a router-level test: monkeypatch `app.chat.llm.acompletion`, post `/api/chat`, assert 502 and `body == {"error": UPSTREAM_ERROR}`, and with `caplog` assert the secret text is in the log and not in the body.

### Idempotent insert (HARD-04)
Current [VERIFIED: backend/app/db/repository.py:40-45] `insert_watchlist_row` does a plain `INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)`. Add `ON CONFLICT (user_id, ticker) DO NOTHING` and fix the docstring ("Raises IntegrityError" is no longer true). The pre-check `is_watched` stays (it skips the market lookup).

### Session open memory (HARD-07)
Current [VERIFIED: backend/app/market/cache.py:26,43-45]: `open_price=previous.open_price if previous else price,` and `remove` does `self._prices.pop(ticker, None)`.
```python
self._session_opens: dict[str, float] = {}        # survives remove()
...
open_price=self._session_opens.setdefault(ticker, price),
```
`remove` is untouched. Existing cache tests still hold (first update sets the open, later updates keep it).
Simulator: `remove` stores the popped price in `self.last_prices`; `add` uses `self.last_prices.get(ticker, profile.seed_price)`.

### Indexes (HARD-08)
Queries [VERIFIED: backend/app/db/repository.py:116-118, 123-125, 142-145]:
- `DELETE FROM portfolio_snapshots WHERE user_id = ? AND recorded_at < ?`
- `SELECT * FROM portfolio_snapshots WHERE user_id = ? ORDER BY recorded_at, rowid`
- `SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`

Append to `schema.sql` (it currently has only `CREATE TABLE IF NOT EXISTS` statements and no secondary indexes):
```sql
CREATE INDEX IF NOT EXISTS idx_snapshots_user_time ON portfolio_snapshots (user_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_chat_user_time ON chat_messages (user_id, created_at);
```
Plans after (run this session): `SEARCH portfolio_snapshots USING INDEX idx_snapshots_user_time (user_id=?)`, `... (user_id=? AND recorded_at<?)` for the DELETE, and `SEARCH chat_messages USING INDEX idx_chat_user_time (user_id=?)`. No TEMP B-TREE: SQLite appends rowid to every index, so `ORDER BY recorded_at, rowid` and the backward `DESC` scan are satisfied. Index names are proposals; any names work.

### Guard test for the lock criterion (HARD-05)
Inside the fake `generate_reply`, assert `not conn.in_transaction`, and open a second `sqlite3.connect(path, timeout=0)` and run `BEGIN IMMEDIATE` then `rollback()` without error.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Return `str(exc)` upstream text in 502 | Fixed public string, log full exception | This phase | Closes an information-disclosure path |
| `with conn:` as the unit of atomicity | Stackable SAVEPOINT helper | This phase | Composable in a chat turn |

**Deprecated/outdated:** Starlette emits `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated`. It is pre-existing, harmless, and out of scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 30 s is a sensible LLM timeout (Cerebras answers in seconds; LiteLLM default is 600 s) | Code Examples | Too short gives spurious 502s, too long gives long spinners. Easy to tune. |
| A2 | The proposed public message wordings are acceptable | Code Examples | Cosmetic. Phase 5 UI shows them verbatim. |
| A3 | LiteLLM and OpenRouter exception text does not contain the API key (relevant for logs only) | Code Examples | A key could land in server logs. Low, but never log request headers. |
| A4 | The sqlite3 default busy timeout is 5 s | Summary | Only affects how long the Massive-mode lock hazard stalls the loop. |
| A5 | Resuming the simulator at the last price on re-add is the wanted behavior | Pitfall 5 | User may prefer restart at the original open. Needs confirmation. |
| A6 | Accepting "chat-row insert failure leaves executed actions unrecorded" is fine | Open Questions | Only matters on a storage-layer failure. |

## Open Questions

1. **Per-action committed units (recommended) or one transaction for the whole turn?**
   - Known: the whole-turn `BEGIN` after the LLM gives full atomicity with the chat rows, but the Massive `add_ticker` await then sits inside a transaction (stall or `database is locked`, reproduced mechanisms).
   - Recommendation: per-action units, and insert the user and assistant rows together in one savepoint. The one residual risk is a failure of that final insert (500, actions already committed). Accepted unless the user wants whole-turn atomicity.
2. **Simulator on re-add: resume at last price (recommended) or restart at the original open?**
   - Resuming gives real continuity of daily change %. Restarting at the open gives change 0 after re-add, which is a visible reset. Both avoid the nonsense of the cache-only fix. Resuming changes `test_remove_and_readd_restarts_at_seed`.
3. **Mention the cap in the system prompt?** Recommended: one line in `chat/prompt.py` ("at most 5 trades and 5 watchlist changes per message"). Low risk, reduces skipped actions.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| uv | all commands | yes | 0.12.3 | — |
| Python | runtime | yes | 3.12.13 | — |
| SQLite | savepoints, `ON CONFLICT`, indexes | yes | 3.53.1 | — |
| pytest + pytest-asyncio + httpx | tests | yes | 9.1.1 / 1.4.0 / 0.28.1 | — |
| Network / API keys | none (LLM faked or mocked) | n/a | — | — |

**Missing dependencies:** none.
Shell note: `uv` prints a harmless `VIRTUAL_ENV ... does not match` warning. Use `/usr/bin/grep` for GNU flags.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.1.1 with pytest-asyncio 1.4.0 (`asyncio_mode = "auto"`) |
| Config file | `backend/pyproject.toml` (`testpaths = ["tests"]`, `pythonpath = ["."]`) |
| Quick run command | `cd backend && uv run pytest -q tests/<area>/<file>.py` |
| Full suite command | `cd backend && uv run pytest -q` (about 2 s, 103 passed at baseline) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HARD-01 | `choices=[]`, `message=None`, `content` None/""/non-JSON/wrong shape give `LLMError`; via route gives 502 not 500 | unit + route | `uv run pytest -q tests/chat/test_llm.py tests/chat/test_router.py` | extend existing |
| HARD-02 | 502 body equals the fixed constant, secret appears in `caplog` only, missing-key message still contains `OPENROUTER_API_KEY` | unit + route | same | extend existing (update the `upstream down` test) |
| HARD-03 | `acompletion` receives `timeout == llm.TIMEOUT_SECONDS`; fake `litellm.exceptions.Timeout` gives timeout message and 502 | unit + route | same | extend existing |
| HARD-04 | `gather` of two adds with a yielding source: no exception, one row; repo duplicate insert is a no-op | service + db | `uv run pytest -q tests/services/test_watchlist.py tests/db/test_repository.py` | extend existing |
| HARD-05 | Unexpected failure on trade 2 of 3: that trade fully rolled back, others and an earlier PYPL add persist, `actions` equals stored `actions`; nested savepoint rollback keeps siblings; `execute_trade` inside a savepoint does not raise; `not conn.in_transaction` during the LLM call | service + db | `uv run pytest -q tests/chat/test_service.py tests/db/test_connection.py tests/services/test_portfolio.py` | extend existing; savepoint tests are new |
| HARD-06 | 7 trades and 7 changes: 5 executed each, 2 `failed` each with reason, replies not rejected, stored == returned, cash reflects only 5 | service | `uv run pytest -q tests/chat/test_service.py` | extend existing |
| HARD-07 | cache: remove then update keeps `open_price`; simulator: unknown ticker re-add resumes at last price (not a new random seed) and open is retained | unit | `uv run pytest -q tests/market/test_cache.py tests/market/test_simulator.py` | extend existing (update the restart-at-seed test) |
| HARD-08 | `EXPLAIN QUERY PLAN` for the three queries contains `USING INDEX` and not `TEMP B-TREE`; `init_db` applies them to a DB created without indexes | db | `uv run pytest -q tests/db/test_connection.py` | extend existing |
| INT-04 | Entire suite green | full | `cd backend && uv run pytest -q` | yes |

### Sampling Rate
- **Per task commit:** the single touched test file (seconds).
- **Per wave merge:** `cd backend && uv run pytest -q`.
- **Phase gate:** full suite green before `/gsd-verify-work`. Each fix lands as a failing test first, then the fix.

### Wave 0 Gaps
- None for infrastructure. The `conn`, `cache` and `source` fixtures already exist in `tests/services/conftest.py` and `tests/chat/conftest.py`. New tests are added to existing files. The race test opens its own `get_connection()` connections. A route-level 502 test needs `monkeypatch.setattr("app.chat.llm.acompletion", fake)` with `LLM_MOCK=false` and `OPENROUTER_API_KEY=test-key`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Spec calls for no login |
| V3 Session Management | no | Single user, no sessions |
| V4 Access Control | no | Out of scope (CONCERNS notes LAN exposure; excluded) |
| V5 Input Validation | yes | Existing `^[A-Z]{1,5}$`, pydantic `ChatReply`; unchanged |
| V7 Error Handling and Logging | yes | Fixed public messages, `logger.exception` server-side, no secrets or raw model output in responses |
| V11 Business Logic | yes | Per-turn action cap, atomic per-action writes |
| V6 Cryptography | no | None |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Upstream error text or model output echoed to client | Information disclosure | Constant `LLMError` messages (HARD-02) |
| Prompt-injected flood of trades or adds | Tampering / Elevation | Cap 5 + 5 per turn, overflow recorded as failed (HARD-06) |
| Hung upstream holds request and connection | Denial of service | `timeout=` on `acompletion` (HARD-03) |
| Raw exception text stored in chat history and fed back to the LLM | Information disclosure | Fixed `UNEXPECTED_ERROR` reason for unexpected action failures |

## Recommended Plan Slicing (for the planner)

Three plans, all runnable in one wave (disjoint files), each test-first:
- **02-01 LLM boundary** (HARD-01, 02, 03): `chat/llm.py`, tests in `tests/chat/`.
- **02-02 Independent fixes** (HARD-04, 07, 08): `db/repository.py`, `db/schema.sql`, `market/cache.py`, `market/simulator.py` plus tests.
- **02-03 Chat turn** (HARD-05, 06): `db/connection.py` + `db/__init__.py` (`savepoint`), `services/portfolio.py`, `services/watchlist.py`, `chat/service.py`, optionally `chat/prompt.py`, plus tests. First task: the failing nested-savepoint and unexpected-failure tests.
- **INT-04**: final full-suite gate task in the last plan.

## Sources

### Primary (HIGH confidence)
- Source files read this session: `backend/app/chat/{llm,service,router,schemas,prompt,mock}.py`, `services/{watchlist,portfolio}.py`, `db/{connection,repository,schema.sql,__init__}.py`, `market/{cache,simulator,massive_source,interface,models,seed_prices}.py`, `main.py`, routes, and the tests under `backend/tests/`.
- Executed experiments (scratchpad): `sp_exp.py` (savepoint semantics), `busy_exp.py` (lock and snapshot behavior), `idx_exp.py` (query plans), `timeout_exp.py` (LiteLLM timeout against a stalled local server), `shape_exp.py` (LiteLLM response shapes against a local fake server), `test_repro.py` (all defect reproductions).
- LiteLLM 1.105.1 source: `main.py` (`timeout: float | None = None`) and `litellm_core_utils/completion_timeout.py` (fallback 600.0 s).
- `.planning/REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `codebase/CONCERNS.md`, `research/PITFALLS.md`.

### Secondary / Tertiary
- None. No web sources were needed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new packages.
- Architecture: HIGH, savepoint design proven by experiment.
- Pitfalls: HIGH, each reproduced. The Massive-mode stall window is MEDIUM (mechanism reproduced, real-world likelihood not measured).

**Research date:** 2026-10-16
**Valid until:** 2026-11-15 (stable stack; revisit if LiteLLM is upgraded)
