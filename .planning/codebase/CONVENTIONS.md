---
last_mapped_commit: 065e01660f2a51736d8dd3bf782db951debb2449
last_mapped_at: 2026-10-16
---
<!-- refreshed: 2026-10-16 -->

# Coding Conventions

**Analysis Date:** 2026-10-16

**Scope note:** The `frontend/` directory is deleted in commit `065e016` (the directory on disk is empty; recoverable from `5681c3a`). Conventions below cover the Python backend (`backend/app/`), the backend tests, and the Playwright E2E suite in `test/`. No frontend conventions can be documented from the current tree.

## Naming Patterns

**Files:**
- Python modules are `snake_case.py`, grouped by domain package: `backend/app/chat/`, `backend/app/market/`, `backend/app/db/`, `backend/app/services/`, `backend/app/routes/`.
- Each domain package exposes its public surface through `__init__.py` (e.g. `backend/app/market/__init__.py` re-exports `PriceCache`, `MarketDataSource`, `MarketDataError`, `create_market_data_source`).
- Route modules are named by resource: `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/routes/health.py`. Domain routers that live beside their domain use `router.py`: `backend/app/chat/router.py`, `backend/app/market/router.py`.
- Tests mirror the source tree with `test_<module>.py`: `backend/tests/services/test_portfolio.py` covers `backend/app/services/portfolio.py`.
- E2E specs are kebab-case `.spec.ts`: `test/tests/sse-reconnect.spec.ts`, `test/tests/portfolio-charts.spec.ts`.
- Shared test helpers: `test/tests/helpers.ts`; pytest fixtures: `conftest.py` per test package.

**Functions:**
- `snake_case`, verb-first: `execute_trade`, `execute_trade_and_sync`, `record_portfolio_snapshot`, `add_to_watchlist`, `remove_from_watchlist`, `get_portfolio`, `position_summary`.
- Private helpers are prefixed with a single underscore: `_apply_buy`, `_apply_sell` in `backend/app/services/portfolio.py`; `_seed_defaults` in `backend/app/db/connection.py`.
- Async functions are used where I/O can block the event loop (market source calls, chat service, trade route): `async def add_to_watchlist(...)` in `backend/app/services/watchlist.py`.
- Boolean-returning predicates use `is_`/`has_`: `is_watched`, `has_position`, `is_mock_enabled`.
- Repository functions are named after SQL verbs: `get_cash`, `set_cash`, `list_positions`, `upsert_position`, `delete_position`, `insert_trade`, `insert_snapshot` in `backend/app/db/repository.py`.

**Variables:**
- `snake_case`; module-level constants are `UPPER_SNAKE_CASE`: `SNAPSHOT_INTERVAL_SECONDS` (`backend/app/main.py`), `HISTORY_LIMIT` (`backend/app/chat/service.py`), `QUANTITY_TOLERANCE` (`backend/app/services/portfolio.py`), `DEFAULT_TICKERS` (`backend/app/db/connection.py`).
- Module logger is always named `logger = logging.getLogger(__name__)`.

**Types / Classes:**
- `PascalCase`. Domain errors end in `Error`: `ValidationError`, `NotFoundError` (`backend/app/errors.py`), `MarketDataError` (`backend/app/market/errors.py`), `LLMError` (`backend/app/chat/llm.py`).
- Request bodies are Pydantic `BaseModel` subclasses ending in `Request`: `TradeRequest` (`backend/app/routes/portfolio.py`), `ChatRequest` (`backend/app/chat/router.py`).
- LLM output shapes are `BaseModel` subclasses named by role: `ChatReply`, `TradeInstruction`, `WatchlistChange` (`backend/app/chat/schemas.py`).
- Data records are `@dataclass` (`Position`, `Trade`, `Snapshot`, `ChatMessage` in `backend/app/db/models.py`; `PriceUpdate` in `backend/app/market/models.py`). `PriceUpdate` uses `frozen=True, slots=True`.
- Abstract base classes use `ABC` + `@abstractmethod`: `MarketDataSource` in `backend/app/market/interface.py`.

## Code Style

**Formatting:**
- No formatter configuration is committed (no `ruff`, `black`, or `.editorconfig` in the backend or root `pyproject.toml`). Observed style is consistent with a ~100-120 column limit, double quotes, and trailing commas on multi-line literals.
- Keep the same style when adding code; do not introduce a second formatter without adding its config.

**Linting:**
- No linter configured for Python. Type hints are used on all function signatures in `backend/app/`; prefer keeping that.
- TypeScript/Playwright: `test/` uses default `@playwright/test` lint behavior; no ESLint config is present.

**Python version:**
- `backend/.python-version` pins `3.12`; `backend/pyproject.toml` requires `>=3.12`. Root `pyproject.toml` and `/.python-version` specify `3.14` and are unrelated to the backend app (root project has no dependencies). Use the backend's `uv` project for all backend commands: `uv run --project backend ...`.
- Use modern syntax: `X | None` unions (`Position | None` in `backend/app/db/repository.py`), `list[str]` builtins, `from __future__` is not used.

## Import Organization

**Order (as observed):**
1. Standard library (`import asyncio`, `import sqlite3`, `from dataclasses import ...`)
2. Third-party (`from fastapi import ...`, `from pydantic import ...`, `from litellm import acompletion`)
3. First-party absolute imports from `app.` (`from app.db import repository`, `from app.errors import ValidationError`)
4. Relative imports only inside a domain package (`from .llm import generate_reply` in `backend/app/chat/service.py`, `from .watchlist import normalize_ticker` in `backend/app/services/portfolio.py`)

**Path Aliases:**
- None. Backend imports are absolute from the `app` package (`pythonpath = ["."]` in `backend/pyproject.toml`). Use absolute imports across packages and relative imports within a package.

**Re-exports:**
- Packages use `__init__.py` to define a public API and `__all__`-style re-exports. Import from the package, not the internal module, when crossing packages: `from app.market import PriceCache` (not `app.market.cache`), `from app.db import get_connection, init_db, repository`.

## Error Handling

**Strategy:** Domain exceptions are raised from services and converted to HTTP responses centrally. Routes do not build error responses by hand.

**Domain exceptions (`backend/app/errors.py`):**
- `ValidationError` -> HTTP 400 `{"error": "<reason>"}`
- `NotFoundError` -> HTTP 404 `{"error": "<reason>"}`
- `MarketDataError` (`backend/app/market/errors.py`) -> HTTP 503 `{"error": "Market data unavailable, try again"}`
- `RequestValidationError` (Pydantic/FastAPI) -> HTTP 400, field-prefixed message
- All registered in `backend/app/routes/error_handlers.py` via `register_error_handlers(app)`.

**Raising:**

```python

# backend/app/services/portfolio.py

if side not in SIDES:
    raise ValidationError(f"Side must be 'buy' or 'sell', got {side!r}")
```

- Messages are user-facing sentences, include the offending value with `!r` or formatted money, and are asserted in tests with `pytest.raises(..., match=...)`.

**Catching:**
- Catch narrow exception tuples at the boundary where a failure becomes data, not control flow. Example: `ACTION_ERRORS = (ValidationError, NotFoundError, MarketDataError)` in `backend/app/chat/service.py` turns a failed chat action into `{"status": "failed", "error": ...}`.
- Wrap third-party failures into a domain error at the module edge: `request_reply` in `backend/app/chat/llm.py` converts any `acompletion` exception into `LLMError` with `from exc`.
- Broad `except Exception` is used only in long-running background loops that must not die: `record_snapshots_forever` in `backend/app/main.py` and the Massive poller in `backend/app/market/massive_source.py`. Each logs with `logger.exception(...)`.
- Do not add defensive `try/except` around code that cannot fail; the project guidance is to use exception handling only when needed.

**Transactions:**
- `get_connection()` (`backend/app/db/connection.py`) is a context manager: commits on success, rolls back on any exception, always closes. Use it as `with get_connection() as conn:` in routes and services.
- Write functions in services wrap their writes in `with conn:` so a trade's cash and position updates are atomic (`execute_trade` in `backend/app/services/portfolio.py`).

## Logging

**Framework:** Standard library `logging`. No `print` statements in `backend/app/`.

**Patterns:**
- `logger = logging.getLogger(__name__)` at module top.
- Use `logger.exception(...)` inside `except` blocks for unexpected failures; `logger.warning(...)` for degraded-but-continuing states; `logger.info(...)` for startup configuration (`backend/app/market/factory.py`).
- Use %-style lazy args, not f-strings: `logger.warning("No startup price for %s; next poll will retry", ticker)`.
- No API keys or secrets may be logged.

## Comments

**When to Comment:**
- Use docstrings for every module, public function, and class. Keep them short and imperative: `"""Validate and fill a market order at the cached price, in one transaction."""`
- Inline comments are rare and explain a non-obvious *why*: `MAX_TOKENS = 4096  # an uncapped request reserves 40k tokens of credit, ...` in `backend/app/chat/llm.py`; `QUANTITY_TOLERANCE = 1e-9  # float residue below this counts as zero shares`.
- Do not add comments that restate the code.

**Docstrings:**
- Triple-double-quoted, one-line summary; add a second paragraph only when a contract needs stating (e.g. `add_ticker` in `backend/app/market/interface.py` documents the `False` vs `MarketDataError` distinction).
- Routes and public service functions carry docstrings describing behavior and raised errors ("Raises ValidationError.").
- No JSDoc/TSDoc usage is observed in `test/`.

## Function Design

**Size:** Short functions; most are under ~15 lines. Split a function when it does two things: `execute_trade` delegates to `_apply_buy` / `_apply_sell` and `insert_trade`.

**Parameters:**
- Explicit dependencies are passed in, not imported globally: `execute_trade(conn, cache, ticker, side, quantity)`. Services take `conn`, `cache`, and `source` as arguments so tests can inject fakes.
- Repository functions take `user_id: str = DEFAULT_USER` as the last parameter. Keep this pattern when adding repository functions.
- FastAPI dependencies are retrieved via `Depends(get_price_cache)` / `Depends(get_market_source)` (`backend/app/deps.py`).

**Return Values:**
- Services return plain `dict` for API payloads (`get_portfolio`, `position_summary`, `apply_trade`) and `dataclass` instances for domain rows (`insert_trade` returns `Trade`).
- Routes return dicts or Pydantic-compatible values; FastAPI serializes them. Use `JSONResponse` only for non-200 responses (`backend/app/chat/router.py`).
- Repository "not found" returns `None` (`get_position`); a delete that may miss returns `bool` (`delete_watchlist_row`).

**Money and numbers:**
- Round money to cents with `round(x, 2)` at persistence and response boundaries (`_apply_buy`, `get_portfolio`). Use `round(..., 4)` for per-share average cost in responses.
- Quantities are `float` (fractional shares allowed). Compare against `QUANTITY_TOLERANCE` instead of `== 0`.

## Module Design

**Exports:** Each package's `__init__.py` is the public API. Internal modules are underscore-free but not imported from outside their package.

**Barrel Files:** Used for `backend/app/market/__init__.py`, `backend/app/db/__init__.py`, and `backend/app/chat/__init__.py`. Keep them to re-exports only.

**Dependency direction (observed):**
- `routes` -> `services` -> `db.repository` / `market`. `chat.service` -> `services` (portfolio, watchlist) and `chat.llm`.
- `services` do not import from `routes`. Keep this direction when adding features.

**Configuration:**
- Environment variables are read at call time with `os.getenv` / `os.environ.get` (e.g. `LLM_MOCK` in `backend/app/chat/llm.py`, `FINALLY_DB_PATH` in `backend/app/db/connection.py`). Read `.env` once at startup with `load_dotenv` in `backend/app/main.py`.

## Frontend

Not present on disk. The `frontend/` directory was deleted in commit `065e016`. PLAN.md specifies Next.js + TypeScript + Tailwind + Recharts with `data-testid` attributes used by E2E tests (e.g. `trade-ticker`, `cash-balance`, `positions-table` in `test/tests/trading.spec.ts`). Keep `data-testid` attributes stable when rebuilding the frontend.

---

*Convention analysis: 2026-10-16*
