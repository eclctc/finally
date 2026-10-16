# Phase 2: Backend Hardening - Pattern Map

**Mapped:** 2026-10-16
**Files analyzed:** 14 (9 source modified, 1 schema, 4 test files extended; no new modules)
**Analogs found:** 14 / 14 (all are modifications of tracked files under `backend/`; analog = the file itself or the sibling test)

All paths are relative to `/Users/brett/Projects/finally/backend`. All verified git-tracked. No CONTEXT.md; file list comes from 02-RESEARCH.md.

## File Classification

| File | Role | Data Flow | Analog | Match |
|------|------|-----------|--------|-------|
| `app/chat/llm.py` | service (third-party edge) | request-response | itself (lines 24-49) | exact |
| `app/chat/service.py` | service (orchestration) | request-response | itself (lines 22-60) | exact |
| `app/db/connection.py` | utility (txn helper) | CRUD | itself: `get_connection` ctx manager (34-49) | exact |
| `app/db/__init__.py` | config (re-exports) | n/a | itself (line 3-5) | exact |
| `app/db/schema.sql` | config | CRUD | itself (`CREATE TABLE IF NOT EXISTS`) | exact |
| `app/db/repository.py` | repository | CRUD | itself: `insert_watchlist_row` (40-45) | exact |
| `app/services/portfolio.py` | service | CRUD | itself: `execute_trade` (12-33), `execute_trade_and_sync` (62-71) | exact |
| `app/services/watchlist.py` | service | CRUD | itself: `add_to_watchlist`, `remove_from_watchlist` | exact |
| `app/market/cache.py` | store | in-memory state | itself | exact |
| `app/market/simulator.py` | service | transform | itself: `GBMSimulator.add/remove` (41-51) | exact |
| `app/chat/prompt.py` (optional) | utility | transform | itself | exact |
| `tests/chat/test_llm.py`, `test_router.py`, `test_service.py` | test | request-response | existing files | exact |
| `tests/db/test_connection.py`, `test_repository.py`, `tests/services/test_*.py`, `tests/market/test_cache.py`, `test_simulator.py` | test | n/a | existing files | exact |

## Pattern Assignments

### `app/chat/llm.py` (HARD-01/02/03)

Current code to change (lines 28-49):
```python
    try:
        response = await acompletion(model=MODEL, messages=messages, response_format=ChatReply,
            reasoning_effort="low", max_tokens=MAX_TOKENS, extra_body=EXTRA_BODY)
    except Exception as exc:
        raise LLMError(f"LLM request failed: {exc}") from exc
    return parse_reply(response.choices[0].message.content)   # IndexError outside try

def parse_reply(content):
    if not content:
        raise LLMError("LLM returned an empty response")
    try:
        return ChatReply.model_validate_json(content)
    except ValidationError as exc:
        raise LLMError(f"LLM response did not match schema: {exc}") from exc   # leaks input_value
```
Conventions to copy: module constants `UPPER_SNAKE` with a "why" inline comment (line 13 `MAX_TOKENS`); add `import logging` and `logger = logging.getLogger(__name__)` (project rule); `logger.exception("...")` in except blocks, no f-strings; wrap with `from exc`. Keep `raise LLMError("OPENROUTER_API_KEY is not set")` (line 27) unchanged. Move `response.choices[0].message.content` inside the `try`. Import `from litellm.exceptions import Timeout`. Add `timeout=TIMEOUT_SECONDS` to `acompletion`. All `LLMError` messages must be constants (UPSTREAM_ERROR, TIMEOUT_ERROR, BAD_REPLY_ERROR per RESEARCH).

Router already maps `LLMError` to 502 via `str(exc)` (`app/chat/router.py`); no router change needed.

### `app/db/connection.py` + `app/db/__init__.py` (savepoint helper, HARD-05)

**Analog:** `get_connection` (connection.py 34-49), already imports `contextmanager`, `Iterator`, `sqlite3`:
```python
@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    """Open a WAL-mode connection; commit on success, roll back on error, always close."""
    ...
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
```
Add `savepoint(conn)` directly below it using the same try/except-raise shape (body in RESEARCH Pattern 1: `SAVEPOINT unit` / `ROLLBACK TO unit; RELEASE unit; raise` / `RELEASE unit`). Export in `__init__.py` (currently `from app.db.connection import DEFAULT_USER, get_connection, init_db` and `__all__ = [...]`): add `savepoint` to both. Consumers import `from app.db import savepoint` (cross-package rule: import from the package).

### `app/services/portfolio.py` (HARD-05)

**Imports** (lines 1-6) already `from app.db import repository`; add `savepoint` to `from app.db import ...`.

`execute_trade` line 28: replace `with conn:` with `with savepoint(conn):` (body lines 29-33 unchanged, `return` inside is fine). Update docstring "in one transaction" if wording matters.

`execute_trade_and_sync` (62-71) target: wrap `execute_trade` + `record_portfolio_snapshot` in one `with savepoint(conn):`, compute `closed`, then `await source.remove_ticker(...)` AFTER the savepoint exits (never await inside it). Current order is trade, remove_ticker, snapshot.

### `app/services/watchlist.py` (HARD-04/05)

`add_to_watchlist` (line 26-28): keep `await source.add_ticker` first, then `with savepoint(conn): repository.insert_watchlist_row(conn, ticker)`. `remove_from_watchlist` (35-38): wrap only `delete_watchlist_row` in the savepoint, then `has_position` / `await source.remove_ticker` outside. Existing import style: `from app.db import repository` (line 3); add `savepoint`. Note: the NotFoundError raise must still happen after the savepoint closes (or inside is fine since it rolls back nothing).

### `app/db/repository.py` (HARD-04)

Current (lines 40-45):
```python
def insert_watchlist_row(conn, ticker, user_id: str = DEFAULT_USER) -> None:
    """Add a ticker to the watchlist. Raises IntegrityError if already present."""
    conn.execute(
        "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
        (new_id(), user_id, ticker, now_iso()),
    )
```
Append `ON CONFLICT (user_id, ticker) DO NOTHING` to the SQL; fix docstring ("already present is a no-op"). Keep `user_id` last param.

### `app/db/schema.sql` (HARD-08)

Append the two `CREATE INDEX IF NOT EXISTS` statements from RESEARCH (matches file's existing idempotent `CREATE TABLE IF NOT EXISTS` style; applied by `init_db` via `executescript`, connection.py 52-56).

### `app/market/cache.py` (HARD-07)

Lines 14-16 `__init__` and 26 / 43-45:
```python
self._prices: dict[str, PriceUpdate] = {}
...
open_price=previous.open_price if previous else price,
...
def remove(self, ticker): if self._prices.pop(ticker, None) is not None: self.version += 1
```
Add `self._session_opens: dict[str, float] = {}` in `__init__`; change line 26 to `open_price=self._session_opens.setdefault(ticker, price),`; leave `remove` alone. Update `update` docstring only if needed.

### `app/market/simulator.py` (HARD-07)

`GBMSimulator` (33-51): `self.profiles`/`self.prices` dicts in `__init__`; `add` uses `profile.seed_price`; `remove` pops both. Add `self.last_prices: dict[str, float] = {}`; in `remove`, store the popped price when present; in `add`, use `self.last_prices.get(ticker, profile.seed_price)`. Beware: `add` early-returns if `ticker in self.prices`, keep that.

### `app/chat/service.py` (HARD-05/06)

**Imports/constants** (lines 3-14): `ACTION_ERRORS = (ValidationError, NotFoundError, MarketDataError)`, `HISTORY_LIMIT = 20`. Add `import logging`, `logger = logging.getLogger(__name__)`, `MAX_ACTIONS_PER_KIND = 5`, `UNEXPECTED_ERROR = "..."` (fixed string), and `from app.db import repository, savepoint`.

**Duplicated pattern to collapse into `run_action`** (lines 22-42):
```python
    action = {"type": "trade", "ticker": trade.ticker.upper(), "side": trade.side, "quantity": trade.quantity}
    try:
        executed = await execute_trade_and_sync(conn, cache, source, trade.ticker, trade.side, trade.quantity)
    except ACTION_ERRORS as exc:
        return {**action, "status": "failed", "error": str(exc)}
    return {**action, "status": "ok", "price": executed.price}
```
Target: `describe_trade` / `describe_watchlist_change` return the `action` dict literal; `run_action(action, perform)` per RESEARCH Pattern 2 (ACTION_ERRORS -> failed with `str(exc)`; bare `except Exception` -> `logger.exception` + failed with `UNEXPECTED_ERROR`). This is a legitimate broad catch (boundary where failure becomes data), consistent with the ACTION_ERRORS docstring convention.

**Turn loop** (lines 55-60): keep order watchlist then trades; slice `[:MAX_ACTIONS_PER_KIND]` executed, `[MAX:]` become `skipped(...)` failed actions; wrap the two `insert_chat_message` calls in one `with savepoint(conn):`; stored `actions` must equal returned list.

### Tests (INT-04): fixtures and style to copy

- `tests/chat/test_llm.py`: `make_response(content)` builds `SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])`; add cases `choices=[]`, `choices=None`, `message=None`; parametrize style at lines 36-49. Monkeypatch `llm.acompletion`. Update `test_request_failure_raises_llm_error` (`match="upstream down"`) to assert the constant instead; assert `timeout == llm.TIMEOUT_SECONDS` is passed.
- `tests/chat/test_router.py`: `client` fixture (lines 5-11: tmp `FINALLY_DB_PATH`, delete `MASSIVE_API_KEY`, `with TestClient(app)`), pattern `monkeypatch.setenv("LLM_MOCK","false")`, post `/api/chat`, assert 502 and `body == {"error": CONST}`; use `caplog` for the secret.
- `tests/chat/test_service.py`: `fake_reply` fixture (lines 10-22, monkeypatches `service.generate_reply`) and `reply(trades=..., changes=...)` helper (25-31) for 7-trade cap and unexpected-failure tests; guard test asserts `not conn.in_transaction` inside the fake. Monkeypatch `repository.insert_trade` to raise `sqlite3.OperationalError` on call 2.
- `tests/chat/conftest.py` / `tests/services/conftest.py`: `conn` (tmp db, `init_db()`, `get_connection()`), `cache` (AAPL 100, services also MSFT 400), `source` (unstarted `SimulatorDataSource`). Race test needs two separate `get_connection()` connections and a source wrapper with `await asyncio.sleep(0)`.
- `tests/market/test_cache.py` (plain functions, `PriceCache()` inline) for open-price-after-remove; `tests/market/test_simulator.py` update `test_remove_and_readd_restarts_at_seed`; `tests/db/test_repository.py` update `test_insert_duplicate_watchlist_row_raises`; `tests/db/test_connection.py` for savepoint semantics and `EXPLAIN QUERY PLAN`.

## Shared Patterns

### Logging
**Source:** project convention (CLAUDE.md); `app/main.py` `record_snapshots_forever`.
`logger = logging.getLogger(__name__)`; `logger.exception("msg %s", arg)` with lazy %-args; never log secrets or request headers.
**Apply to:** `chat/llm.py`, `chat/service.py`.

### Error handling
**Source:** `app/errors.py`, `app/routes/error_handlers.py`; `ACTION_ERRORS` in `chat/service.py:14`.
Services raise domain errors; user-facing messages are constants for LLM errors; third-party failures wrapped `raise LLMError(CONST) from exc`.

### Transactions
**Source:** `app/db/connection.py:34-49`. Repository never commits; write sections use `with savepoint(conn):` (new), never `with conn:` once nested use is possible. Never `await` inside a savepoint.
**Apply to:** `services/portfolio.py`, `services/watchlist.py`, `chat/service.py`.

### Style
Docstrings on public functions (short, imperative, state "Raises ..."); type hints on signatures; `X | None` unions; double quotes; no emojis; services take `conn`/`cache`/`source` as args.

## No Analog Found

None. `savepoint()` is new but follows the `get_connection` context-manager shape; its body is specified and sqlite-verified in RESEARCH Pattern 1.

## Metadata

**Analog search scope:** `backend/app/**`, `backend/tests/**`
**Files scanned:** about 20 read or grepped
**Pattern extraction date:** 2026-10-16
