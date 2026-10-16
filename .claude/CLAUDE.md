<!-- GSD:project-start source:PROJECT.md -->

## Project

**FinAlly — AI Trading Workstation**

FinAlly (Finance Ally) is a single-user, Bloomberg-terminal-style trading workstation that streams live (simulated or real) market data, lets the user trade a $10,000 virtual portfolio, and includes an AI chat copilot that analyzes positions and executes trades and watchlist changes by natural language. It ships as one Docker container on port 8000 and is the capstone project for an agentic AI coding course. The full specification is `planning/PLAN.md`.

**Core Value:** A user runs one Docker command, opens `http://localhost:8000`, and sees prices streaming, can trade, and can talk to an AI that trades for them. All of this happens in one dense, dark, live-updating terminal UI.

### Constraints

- **Tech stack**: Next.js (TypeScript, static export), Tailwind, Recharts only, FastAPI, uv, SQLite. PLAN.md fixes these choices.
- **Deployment**: one container, one port (8000), same-origin `/api/*`, no CORS. PLAN.md §3.
- **Runtime**: Node 22 LTS for the build stage, Python 3.12 runtime, single uvicorn worker.
- **Code style**: keep it simple and incremental, no defensive over-engineering, short named functions, `uv run`/`uv add` only, no emojis in code. These are the user's global instructions.
- **Testing**: backend pytest, frontend Vitest + RTL, E2E Playwright with `LLM_MOCK=true`.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- Python 3.12+ - All application code in `backend/app/` and tests in `backend/tests/`
- Bash - Start/stop scripts in `scripts/start_mac.sh`, `scripts/stop_mac.sh`
- PowerShell - Start/stop scripts in `scripts/start_windows.ps1`, `scripts/stop_windows.ps1`
- TypeScript - E2E tests in `test/tests/*.spec.ts` and `test/playwright.config.ts` only
- SQL - Schema in `backend/app/db/schema.sql`
- Not present. The `frontend/` directory exists but is empty (the Next.js project was deleted in commit `065e016`). The PLAN specifies Next.js + TypeScript + Tailwind + Recharts, but none of it is on disk.

## Runtime

- Python 3.12 in the container (`python:3.12-slim` base in `Dockerfile`)
- `backend/pyproject.toml` declares `requires-python = ">=3.12"`; `backend/.python-version` is `3.12`
- Root `pyproject.toml` (project name `finally`) declares `requires-python = ">=3.14"` and root `.python-version` is `3.14`. This root project is not used by the Dockerfile or by `backend/`. The root `.venv/` is a Python 3.14 environment.
- Node 22 (`node:22-slim`) is referenced in `Dockerfile` for the frontend build stage, which currently cannot run because `frontend/` is empty
- Node/npm is used only for the E2E test project in `test/`
- uv (Astral) - Python dependency management for `backend/`
- npm - E2E test dependencies in `test/`

## Frameworks

- FastAPI 0.143.2 - HTTP API, routers, static file mounting. Entry point `app.main:app` in `backend/app/main.py`
- Starlette 1.8.0 - Transitive under FastAPI; provides `StaticFiles` and `StreamingResponse` used for SSE
- Pydantic 2.14.1 - Request/response models and LLM structured output schema (`backend/app/chat/schemas.py`)
- Uvicorn 0.54.0 (with `standard` extras) - ASGI server, run single-worker in `Dockerfile` CMD
- LiteLLM 1.105.1 - `acompletion` call to `openrouter/openai/gpt-oss-120b` in `backend/app/chat/llm.py`
- Massive Python SDK 2.8.0 (`massive` package, formerly Polygon.io client) - `RESTClient` in `backend/app/market/factory.py` and `backend/app/market/massive_source.py`
- pytest 9.1.1 - Backend test runner; config in `backend/pyproject.toml` (`asyncio_mode = "auto"`, `testpaths = ["tests"]`, `pythonpath = ["."]`)
- pytest-asyncio 1.4.0 - Async test support
- httpx 0.28.1 (dev group) - FastAPI `TestClient` transport and HTTP mocking
- Playwright (`@playwright/test` 1.64.1) - E2E tests in `test/`, config in `test/playwright.config.ts`
- `@types/node` ^26.6.5 - Type definitions for the E2E project
- uv_build (`>=0.12.3,<0.13.0`) - Build backend for the root `pyproject.toml` only
- Docker multi-stage build - `Dockerfile` (Stage 1 Node 22 frontend build, Stage 2 Python 3.12 runtime)
- Docker Compose - `docker-compose.yml` (optional wrapper), `test/docker-compose.test.yml` (E2E)
- Playwright container image `mcr.microsoft.com/playwright:v1.64.1-noble` for E2E

## Key Dependencies

- `litellm` 1.105.1 - Only LLM gateway; routes to OpenRouter with Cerebras as the required provider
- `massive` 2.8.0 - Real market data client; only imported when `MASSIVE_API_KEY` is set
- `fastapi` 0.143.2 / `uvicorn` 0.54.0 - Serve API, SSE, and static frontend on port 8000
- `pydantic` 2.14.1 - Validates LLM output (`ChatReply`) and API payloads
- `python-dotenv` 1.2.4 - Loads `<repo>/.env` at import time in `backend/app/main.py`
- Standard library `sqlite3` - Database access in `backend/app/db/connection.py` (no ORM)
- Standard library `asyncio`, `random`, `math` - In-process GBM market simulator in `backend/app/market/simulator.py`
- `pytest` / `pytest-asyncio` / `httpx` - Dev-only

## Configuration

- `OPENROUTER_API_KEY` - Read in `backend/app/chat/llm.py`; missing key yields an `LLMError` (chat returns 502)
- `LLM_MOCK` - `true` enables deterministic mock replies (`backend/app/chat/llm.py`)
- `MASSIVE_API_KEY` - Non-empty selects Massive data source (`backend/app/market/factory.py`)
- `MASSIVE_POLL_INTERVAL` - Poll seconds for Massive, default 15, minimum 2 (`backend/app/market/factory.py`)
- `FINALLY_DB_PATH` - SQLite file path; default `<repo>/db/finally.db` (`backend/app/db/connection.py`). Set to `/app/db/finally.db` in `Dockerfile`
- `STATIC_DIR` - Static frontend directory; default `backend/static` (`backend/app/main.py`). Set to `/app/static` in `Dockerfile`
- `.env` at repo root is loaded by `backend/app/main.py` via `load_dotenv`, and is passed to Docker via `--env-file` (`scripts/start_mac.sh`) or `env_file` (`docker-compose.yml`, optional)
- Template: `.env.example` (committed). Keys listed: `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, `LLM_MOCK`
- Actual `.env` contents are not recorded in this document
- `backend/pyproject.toml` - Backend dependencies and pytest config
- `backend/uv.lock` - Pinned backend dependency graph
- `Dockerfile`, `.dockerignore` - Image build
- `test/playwright.config.ts` - E2E projects (`fresh-start` runs before `features`), `workers: 1`, base URL from `BASE_URL` (default `http://localhost:8010`)
- No linter or formatter config (no ruff, mypy, eslint, prettier config) is present

## Persistence

- SQLite file at `db/finally.db` (repo root in dev; `/app/db/finally.db` in container, volume `finally-data`)
- WAL journal mode, set per connection in `backend/app/db/connection.py`
- Schema created idempotently from `backend/app/db/schema.sql` at startup via `init_db()` in `backend/app/main.py` lifespan
- `db/` directory currently exists but is empty

## Platform Requirements

- Python 3.12+ and uv for backend (`cd backend && uv run pytest`)
- Docker for the full container; `scripts/start_mac.sh` also uses `open` / `xdg-open`
- Node.js and npm for E2E tests in `test/`
- Frontend build requires Node 22 once `frontend/` is restored
- Single Docker container, single uvicorn worker, port 8000
- Named volume for SQLite persistence
- Deployment target per PLAN: any container platform (AWS App Runner, Render). No deployment config is present beyond `docker-compose.yml`.

## Known Build Blockers

- `Dockerfile` stage 1 copies `frontend/package.json`, `frontend/package-lock.json`, and `frontend/` source. With `frontend/` empty, `docker build` will fail at the `COPY frontend/package.json` step.
- `scripts/start_mac.sh` and `docker-compose.yml` depend on that image build.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Python modules are `snake_case.py`, grouped by domain package: `backend/app/chat/`, `backend/app/market/`, `backend/app/db/`, `backend/app/services/`, `backend/app/routes/`.
- Each domain package exposes its public surface through `__init__.py` (e.g. `backend/app/market/__init__.py` re-exports `PriceCache`, `MarketDataSource`, `MarketDataError`, `create_market_data_source`).
- Route modules are named by resource: `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/routes/health.py`. Domain routers that live beside their domain use `router.py`: `backend/app/chat/router.py`, `backend/app/market/router.py`.
- Tests mirror the source tree with `test_<module>.py`: `backend/tests/services/test_portfolio.py` covers `backend/app/services/portfolio.py`.
- E2E specs are kebab-case `.spec.ts`: `test/tests/sse-reconnect.spec.ts`, `test/tests/portfolio-charts.spec.ts`.
- Shared test helpers: `test/tests/helpers.ts`; pytest fixtures: `conftest.py` per test package.
- `snake_case`, verb-first: `execute_trade`, `execute_trade_and_sync`, `record_portfolio_snapshot`, `add_to_watchlist`, `remove_from_watchlist`, `get_portfolio`, `position_summary`.
- Private helpers are prefixed with a single underscore: `_apply_buy`, `_apply_sell` in `backend/app/services/portfolio.py`; `_seed_defaults` in `backend/app/db/connection.py`.
- Async functions are used where I/O can block the event loop (market source calls, chat service, trade route): `async def add_to_watchlist(...)` in `backend/app/services/watchlist.py`.
- Boolean-returning predicates use `is_`/`has_`: `is_watched`, `has_position`, `is_mock_enabled`.
- Repository functions are named after SQL verbs: `get_cash`, `set_cash`, `list_positions`, `upsert_position`, `delete_position`, `insert_trade`, `insert_snapshot` in `backend/app/db/repository.py`.
- `snake_case`; module-level constants are `UPPER_SNAKE_CASE`: `SNAPSHOT_INTERVAL_SECONDS` (`backend/app/main.py`), `HISTORY_LIMIT` (`backend/app/chat/service.py`), `QUANTITY_TOLERANCE` (`backend/app/services/portfolio.py`), `DEFAULT_TICKERS` (`backend/app/db/connection.py`).
- Module logger is always named `logger = logging.getLogger(__name__)`.
- `PascalCase`. Domain errors end in `Error`: `ValidationError`, `NotFoundError` (`backend/app/errors.py`), `MarketDataError` (`backend/app/market/errors.py`), `LLMError` (`backend/app/chat/llm.py`).
- Request bodies are Pydantic `BaseModel` subclasses ending in `Request`: `TradeRequest` (`backend/app/routes/portfolio.py`), `ChatRequest` (`backend/app/chat/router.py`).
- LLM output shapes are `BaseModel` subclasses named by role: `ChatReply`, `TradeInstruction`, `WatchlistChange` (`backend/app/chat/schemas.py`).
- Data records are `@dataclass` (`Position`, `Trade`, `Snapshot`, `ChatMessage` in `backend/app/db/models.py`; `PriceUpdate` in `backend/app/market/models.py`). `PriceUpdate` uses `frozen=True, slots=True`.
- Abstract base classes use `ABC` + `@abstractmethod`: `MarketDataSource` in `backend/app/market/interface.py`.

## Code Style

- No formatter configuration is committed (no `ruff`, `black`, or `.editorconfig` in the backend or root `pyproject.toml`). Observed style is consistent with a ~100-120 column limit, double quotes, and trailing commas on multi-line literals.
- Keep the same style when adding code; do not introduce a second formatter without adding its config.
- No linter configured for Python. Type hints are used on all function signatures in `backend/app/`; prefer keeping that.
- TypeScript/Playwright: `test/` uses default `@playwright/test` lint behavior; no ESLint config is present.
- `backend/.python-version` pins `3.12`; `backend/pyproject.toml` requires `>=3.12`. Root `pyproject.toml` and `/.python-version` specify `3.14` and are unrelated to the backend app (root project has no dependencies). Use the backend's `uv` project for all backend commands: `uv run --project backend ...`.
- Use modern syntax: `X | None` unions (`Position | None` in `backend/app/db/repository.py`), `list[str]` builtins, `from __future__` is not used.

## Import Organization

- None. Backend imports are absolute from the `app` package (`pythonpath = ["."]` in `backend/pyproject.toml`). Use absolute imports across packages and relative imports within a package.
- Packages use `__init__.py` to define a public API and `__all__`-style re-exports. Import from the package, not the internal module, when crossing packages: `from app.market import PriceCache` (not `app.market.cache`), `from app.db import get_connection, init_db, repository`.

## Error Handling

- `ValidationError` -> HTTP 400 `{"error": "<reason>"}`
- `NotFoundError` -> HTTP 404 `{"error": "<reason>"}`
- `MarketDataError` (`backend/app/market/errors.py`) -> HTTP 503 `{"error": "Market data unavailable, try again"}`
- `RequestValidationError` (Pydantic/FastAPI) -> HTTP 400, field-prefixed message
- All registered in `backend/app/routes/error_handlers.py` via `register_error_handlers(app)`.
- Messages are user-facing sentences, include the offending value with `!r` or formatted money, and are asserted in tests with `pytest.raises(..., match=...)`.
- Catch narrow exception tuples at the boundary where a failure becomes data, not control flow. Example: `ACTION_ERRORS = (ValidationError, NotFoundError, MarketDataError)` in `backend/app/chat/service.py` turns a failed chat action into `{"status": "failed", "error": ...}`.
- Wrap third-party failures into a domain error at the module edge: `request_reply` in `backend/app/chat/llm.py` converts any `acompletion` exception into `LLMError` with `from exc`.
- Broad `except Exception` is used only in long-running background loops that must not die: `record_snapshots_forever` in `backend/app/main.py` and the Massive poller in `backend/app/market/massive_source.py`. Each logs with `logger.exception(...)`.
- Do not add defensive `try/except` around code that cannot fail; the project guidance is to use exception handling only when needed.
- `get_connection()` (`backend/app/db/connection.py`) is a context manager: commits on success, rolls back on any exception, always closes. Use it as `with get_connection() as conn:` in routes and services.
- Write functions in services wrap their writes in `with conn:` so a trade's cash and position updates are atomic (`execute_trade` in `backend/app/services/portfolio.py`).

## Logging

- `logger = logging.getLogger(__name__)` at module top.
- Use `logger.exception(...)` inside `except` blocks for unexpected failures; `logger.warning(...)` for degraded-but-continuing states; `logger.info(...)` for startup configuration (`backend/app/market/factory.py`).
- Use %-style lazy args, not f-strings: `logger.warning("No startup price for %s; next poll will retry", ticker)`.
- No API keys or secrets may be logged.

## Comments

- Use docstrings for every module, public function, and class. Keep them short and imperative: `"""Validate and fill a market order at the cached price, in one transaction."""`
- Inline comments are rare and explain a non-obvious *why*: `MAX_TOKENS = 4096  # an uncapped request reserves 40k tokens of credit, ...` in `backend/app/chat/llm.py`; `QUANTITY_TOLERANCE = 1e-9  # float residue below this counts as zero shares`.
- Do not add comments that restate the code.
- Triple-double-quoted, one-line summary; add a second paragraph only when a contract needs stating (e.g. `add_ticker` in `backend/app/market/interface.py` documents the `False` vs `MarketDataError` distinction).
- Routes and public service functions carry docstrings describing behavior and raised errors ("Raises ValidationError.").
- No JSDoc/TSDoc usage is observed in `test/`.

## Function Design

- Explicit dependencies are passed in, not imported globally: `execute_trade(conn, cache, ticker, side, quantity)`. Services take `conn`, `cache`, and `source` as arguments so tests can inject fakes.
- Repository functions take `user_id: str = DEFAULT_USER` as the last parameter. Keep this pattern when adding repository functions.
- FastAPI dependencies are retrieved via `Depends(get_price_cache)` / `Depends(get_market_source)` (`backend/app/deps.py`).
- Services return plain `dict` for API payloads (`get_portfolio`, `position_summary`, `apply_trade`) and `dataclass` instances for domain rows (`insert_trade` returns `Trade`).
- Routes return dicts or Pydantic-compatible values; FastAPI serializes them. Use `JSONResponse` only for non-200 responses (`backend/app/chat/router.py`).
- Repository "not found" returns `None` (`get_position`); a delete that may miss returns `bool` (`delete_watchlist_row`).
- Round money to cents with `round(x, 2)` at persistence and response boundaries (`_apply_buy`, `get_portfolio`). Use `round(..., 4)` for per-share average cost in responses.
- Quantities are `float` (fractional shares allowed). Compare against `QUANTITY_TOLERANCE` instead of `== 0`.

## Module Design

- `routes` -> `services` -> `db.repository` / `market`. `chat.service` -> `services` (portfolio, watchlist) and `chat.llm`.
- `services` do not import from `routes`. Keep this direction when adding features.
- Environment variables are read at call time with `os.getenv` / `os.environ.get` (e.g. `LLM_MOCK` in `backend/app/chat/llm.py`, `FINALLY_DB_PATH` in `backend/app/db/connection.py`). Read `.env` once at startup with `load_dotenv` in `backend/app/main.py`.

## Frontend

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App factory and lifespan | Creates FastAPI app, registers routers and error handlers, starts market source and snapshot task, mounts static files | `backend/app/main.py` |
| Dependency accessors | Pull `price_cache` and `market_source` from `app.state` | `backend/app/deps.py` |
| Error mapping | Maps `ValidationError`/`NotFoundError`/`MarketDataError`/`RequestValidationError` to `{"error": ...}` with 400/404/503 | `backend/app/routes/error_handlers.py`, `backend/app/errors.py` |
| Health route | `GET /api/health` with market source status | `backend/app/routes/health.py` |
| Portfolio routes | `GET /api/portfolio`, `POST /api/portfolio/trade`, `GET /api/portfolio/history` | `backend/app/routes/portfolio.py` |
| Watchlist routes | `GET/POST /api/watchlist`, `DELETE /api/watchlist/{ticker}` | `backend/app/routes/watchlist.py` |
| Chat route | `POST /api/chat`; maps `LLMError` to HTTP 502 | `backend/app/chat/router.py` |
| Chat orchestration | Builds prompt, calls LLM, executes watchlist then trade actions, stores messages | `backend/app/chat/service.py` |
| LLM client | LiteLLM → OpenRouter (Cerebras provider), structured output parsing | `backend/app/chat/llm.py` |
| Mock LLM | Keyword-driven deterministic replies when `LLM_MOCK=true` | `backend/app/chat/mock.py` |
| Prompt builder | System prompt, portfolio context, history, user message | `backend/app/chat/prompt.py` |
| Chat schemas | `ChatReply`, `TradeInstruction`, `WatchlistChange` (Pydantic) | `backend/app/chat/schemas.py` |
| Trade engine | Validates and fills market orders, updates cash/positions in one transaction | `backend/app/services/portfolio.py` |
| Watchlist service | Ticker normalization/validation, add/remove with market source sync | `backend/app/services/watchlist.py` |
| Price cache | In-memory latest price per ticker, session open, and `version` counter | `backend/app/market/cache.py` |
| Market source interface | Abstract producer that writes into `PriceCache` | `backend/app/market/interface.py` |
| Source factory | Selects Massive when `MASSIVE_API_KEY` is non-empty, else simulator | `backend/app/market/factory.py` |
| GBM simulator | Correlated GBM price generation on a 0.5s tick | `backend/app/market/simulator.py`, `backend/app/market/seed_prices.py` |
| Massive source | REST polling of Massive API via `asyncio.to_thread` | `backend/app/market/massive_source.py` |
| SSE stream | Emits full price map on cache version change, keepalives, retry hint | `backend/app/market/stream.py`, `backend/app/market/router.py` |
| DB connection | Per-call SQLite connection, WAL, commit/rollback, idempotent schema + seed | `backend/app/db/connection.py` |
| Schema | DDL for all six tables | `backend/app/db/schema.sql` |
| Repository | SQL access functions taking an open connection | `backend/app/db/repository.py` |
| Row dataclasses | `Position`, `Trade`, `Snapshot`, `ChatMessage` | `backend/app/db/models.py` |

## Pattern Overview

- One process, one uvicorn worker, one asyncio event loop. The `PriceCache` is therefore unlocked; its docstring states all access happens on the loop thread.
- Pluggable market data behind the `MarketDataSource` ABC (`backend/app/market/interface.py`); downstream code never checks which source is active.
- Thin routers delegate to service functions that take plain arguments (`conn`, `cache`, `source`), so the same functions serve REST routes and chat actions.
- Persistence is synchronous `sqlite3`, opened per request via `get_connection()` context manager; the repository layer receives the connection and never commits itself.
- Single-user model: every table carries `user_id` defaulting to `"default"` (`DEFAULT_USER` in `backend/app/db/connection.py`), hardcoded in repository defaults.
- Frontend (spec: Next.js static export) is served from the same origin via `StaticFiles` mounted at `/` only if the static directory exists (`backend/app/main.py`).

## Layers

- Purpose: HTTP shape, request models, status codes.
- Location: `backend/app/routes/`, `backend/app/chat/router.py`, `backend/app/market/router.py`
- Contains: `APIRouter` instances, Pydantic request bodies (`TradeRequest`, `WatchlistAddRequest`, `ChatRequest`).
- Depends on: `app.deps`, `app.db`, `app.services`, `app.chat.service`, `app.market`
- Used by: FastAPI app in `backend/app/main.py`
- Purpose: Business rules (trade validation, weighted average cost, watchlist invariants, portfolio valuation, snapshots).
- Location: `backend/app/services/portfolio.py`, `backend/app/services/watchlist.py`, `backend/app/chat/service.py`
- Contains: plain functions taking `conn`, `cache`, `source`.
- Depends on: `app.db.repository`, `app.market` (cache and source interface), `app.errors`
- Used by: routers and `chat/service.py`
- Purpose: SQL statements and row-to-dataclass mapping.
- Location: `backend/app/db/repository.py`, `backend/app/db/connection.py`, `backend/app/db/models.py`
- Contains: `get_cash`, `set_cash`, `list_watchlist`, `insert_trade`, `upsert_position`, `insert_snapshot`, `recent_chat_messages`, etc.
- Depends on: `sqlite3` only.
- Used by: services and routes (`routes/portfolio.py` calls `repository.list_snapshots` directly).
- Purpose: Produce prices into the cache; expose them to readers.
- Location: `backend/app/market/`
- Contains: `PriceCache`, `PriceUpdate`, `MarketDataSource`, `SimulatorDataSource` (and `GBMSimulator` math), `MassiveDataSource`, SSE generator.
- Depends on: stdlib, `massive` SDK (Massive source only).
- Used by: `main.py` lifespan, services (via `MarketDataSource.add_ticker`/`remove_ticker`), `deps.py`.
- Purpose: Obtain a structured `ChatReply` for a turn.
- Location: `backend/app/chat/llm.py`, `backend/app/chat/mock.py`, `backend/app/chat/prompt.py`, `backend/app/chat/schemas.py`
- Depends on: `litellm`, `pydantic`.
- Used by: `chat/service.py` only.

## Data Flow

### Primary Request Path (manual trade)

### Chat Turn Path

### Price Streaming Path

### Snapshot Path

- Durable state: SQLite file at `FINALLY_DB_PATH` (default `<repo>/db/finally.db`; the Dockerfile sets `/app/db/finally.db`).
- Live state: `PriceCache` on `app.state.price_cache` and the source on `app.state.market_source`. Lost on restart; rebuilt from `tracked_tickers` at startup.
- No server-side session state; the frontend holds sparkline history since page load.

## Key Abstractions

- Purpose: Uniform producer contract for simulator and Massive.
- Examples: `backend/app/market/interface.py`, `backend/app/market/simulator.py`, `backend/app/market/massive_source.py`
- Pattern: Abstract base class with `start`, `add_ticker` (returns False when unknown), `remove_ticker`, `tickers`; `stop()` and `status()` are shared. Conformance is tested in `backend/tests/market/test_conformance.py`.
- Purpose: Latest price, previous price, session open, timestamp, and change metadata per ticker.
- Examples: `backend/app/market/cache.py`, `backend/app/market/models.py`
- Pattern: Mutable store with monotonically increasing `version` used as a cheap change detector.
- Purpose: Testable business rules without globals.
- Examples: `execute_trade(conn, cache, ticker, side, quantity)` in `backend/app/services/portfolio.py`; `add_to_watchlist(conn, source, raw_ticker)` in `backend/app/services/watchlist.py`
- Pattern: Functions receive dependencies as arguments; FastAPI `Depends` supplies them at the route layer via `backend/app/deps.py`.
- Purpose: Decouple services from HTTP.
- Examples: `ValidationError`, `NotFoundError` (`backend/app/errors.py`), `MarketDataError` (`backend/app/market/errors.py`), `LLMError` (`backend/app/chat/llm.py`)
- Pattern: Services raise; `register_error_handlers` maps to responses. Chat service catches `ACTION_ERRORS` per action to keep the turn going.
- Purpose: Contract for chat output.
- Examples: `backend/app/chat/schemas.py`
- Pattern: `ChatReply` passed as `response_format` to LiteLLM; parsed with `model_validate_json`.

## Entry Points

- Location: `backend/app/main.py` (`app = FastAPI(...)`)
- Triggers: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1` (Dockerfile `CMD`; `backend/` as working directory)
- Responsibilities: Load `.env` from project root, run lifespan (DB init, cache, source, snapshot task), register routers, mount static files.
- Location: `Dockerfile` (`CMD`), `docker-compose.yml`
- Triggers: `scripts/start_mac.sh` / `scripts/start_windows.ps1` (not reviewed in depth here)
- Responsibilities: Builds a Python 3.12 image, syncs dependencies from `backend/uv.lock`, exposes port 8000.
- Location: `backend/app/routes/health.py`
- Triggers: Docker `HEALTHCHECK` in `Dockerfile`.

## Architectural Constraints

- **Threading:** Single asyncio event loop in one uvicorn worker. Massive REST calls are offloaded with `asyncio.to_thread` (`backend/app/market/massive_source.py`). The SQLite access in async handlers (`backend/app/chat/router.py`, `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`) and in the snapshot task is synchronous and blocks the loop for the duration of each query.
- **Global state:** `app` and its `state` in `backend/app/main.py`; `PriceCache` instance on `app.state`; module-level `_prices` in cache via instance only. Settings are read from environment at call time (`backend/app/chat/llm.py`, `backend/app/market/factory.py`, `backend/app/db/connection.py`).
- **Circular imports:** None observed. Dependency direction is `routes/chat router → services → db/market`; `market` does not import `services`.
- **Import-time side effects:** `backend/app/main.py` calls `load_dotenv` at import and constructs `app` at import; `REPO_ROOT` is resolved at import in `backend/app/db/connection.py`.
- **Single-user hardcoding:** `DEFAULT_USER = "default"` is the default argument for every repository function.
- **Schema location:** Spec (`planning/PLAN.md`) places schema under `backend/db/`; actual location is `backend/app/db/schema.sql`.

## Anti-Patterns

### Synchronous SQLite inside async endpoints

### Route handlers reaching into repository

### Duplicated market-source selection in tests

## Error Handling

- `ValidationError` → 400 `{"error": msg}`; `RequestValidationError` → 400 with `field: message` (`backend/app/routes/error_handlers.py`)
- `NotFoundError` → 404; `MarketDataError` → 503 with a generic message
- `LLMError` → 502 from the chat route only; nothing stored
- Transactions: `get_connection()` commits on success and rolls back on exception; `execute_trade` also uses `with conn:`
- Background tasks: snapshot loop logs with `logger.exception` and retries next interval (`backend/app/main.py`)

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| cerebras-inference | Use this to write code to call an LLM using LiteLLM and OpenRouter with the Cerebras inference provider | `.claude/skills/cerebras/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
