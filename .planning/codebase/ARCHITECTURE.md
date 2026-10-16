---
last_mapped_commit: 065e01660f2a51736d8dd3bf782db951debb2449
last_mapped_at: 2026-10-16
---
<!-- refreshed: 2026-10-16 -->

# Architecture

**Analysis Date:** 2026-10-16

## System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│  Browser (frontend/ ABSENT on disk; spec: Next.js static export)  │
└───────────────┬──────────────────────────┬───────────────────────┘
                │ GET /api/*               │ GET /api/stream/prices (SSE)
                ▼                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  FastAPI app  `backend/app/main.py`  (uvicorn, 1 worker, :8000)   │
│  ┌──────────────┐ ┌────────────────┐ ┌─────────────────────────┐  │
│  │ routes/      │ │ chat/          │ │ market/router.py        │  │
│  │ health,      │ │ router→service │ │ SSE price stream        │  │
│  │ portfolio,   │ │ →llm / mock    │ │                         │  │
│  │ watchlist    │ │                │ │                         │  │
│  └──────┬───────┘ └───────┬────────┘ └────────────┬────────────┘  │
│         ▼                 ▼                       ▼               │
│  ┌──────────────────────────────────┐   ┌──────────────────────┐ │
│  │ services/ portfolio, watchlist   │◄──┤ market/ PriceCache   │ │
│  └──────┬───────────────────────────┘   └──────────▲───────────┘ │
│         ▼                                          │ writes       │
│  ┌──────────────────────────────┐   ┌──────────────┴───────────┐ │
│  │ db/ repository + connection  │   │ MarketDataSource (ABC)   │ │
│  └──────┬───────────────────────┘   │ Simulator | MassiveSource│ │
│         ▼                           └──────────────────────────┘ │
│  SQLite  `db/finally.db` (WAL)      Background: snapshot loop    │
└──────────────────────────────────────────────────────────────────┘
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

**Overall:** Layered modular monolith (single FastAPI process) with an in-memory price cache as the hub between a pluggable market data producer and read-side consumers (REST and SSE).

**Key Characteristics:**
- One process, one uvicorn worker, one asyncio event loop. The `PriceCache` is therefore unlocked; its docstring states all access happens on the loop thread.
- Pluggable market data behind the `MarketDataSource` ABC (`backend/app/market/interface.py`); downstream code never checks which source is active.
- Thin routers delegate to service functions that take plain arguments (`conn`, `cache`, `source`), so the same functions serve REST routes and chat actions.
- Persistence is synchronous `sqlite3`, opened per request via `get_connection()` context manager; the repository layer receives the connection and never commits itself.
- Single-user model: every table carries `user_id` defaulting to `"default"` (`DEFAULT_USER` in `backend/app/db/connection.py`), hardcoded in repository defaults.
- Frontend (spec: Next.js static export) is served from the same origin via `StaticFiles` mounted at `/` only if the static directory exists (`backend/app/main.py`).

## Layers

**Routing / API layer:**
- Purpose: HTTP shape, request models, status codes.
- Location: `backend/app/routes/`, `backend/app/chat/router.py`, `backend/app/market/router.py`
- Contains: `APIRouter` instances, Pydantic request bodies (`TradeRequest`, `WatchlistAddRequest`, `ChatRequest`).
- Depends on: `app.deps`, `app.db`, `app.services`, `app.chat.service`, `app.market`
- Used by: FastAPI app in `backend/app/main.py`

**Service layer:**
- Purpose: Business rules (trade validation, weighted average cost, watchlist invariants, portfolio valuation, snapshots).
- Location: `backend/app/services/portfolio.py`, `backend/app/services/watchlist.py`, `backend/app/chat/service.py`
- Contains: plain functions taking `conn`, `cache`, `source`.
- Depends on: `app.db.repository`, `app.market` (cache and source interface), `app.errors`
- Used by: routers and `chat/service.py`

**Data access layer:**
- Purpose: SQL statements and row-to-dataclass mapping.
- Location: `backend/app/db/repository.py`, `backend/app/db/connection.py`, `backend/app/db/models.py`
- Contains: `get_cash`, `set_cash`, `list_watchlist`, `insert_trade`, `upsert_position`, `insert_snapshot`, `recent_chat_messages`, etc.
- Depends on: `sqlite3` only.
- Used by: services and routes (`routes/portfolio.py` calls `repository.list_snapshots` directly).

**Market data layer:**
- Purpose: Produce prices into the cache; expose them to readers.
- Location: `backend/app/market/`
- Contains: `PriceCache`, `PriceUpdate`, `MarketDataSource`, `SimulatorDataSource` (and `GBMSimulator` math), `MassiveDataSource`, SSE generator.
- Depends on: stdlib, `massive` SDK (Massive source only).
- Used by: `main.py` lifespan, services (via `MarketDataSource.add_ticker`/`remove_ticker`), `deps.py`.

**LLM layer:**
- Purpose: Obtain a structured `ChatReply` for a turn.
- Location: `backend/app/chat/llm.py`, `backend/app/chat/mock.py`, `backend/app/chat/prompt.py`, `backend/app/chat/schemas.py`
- Depends on: `litellm`, `pydantic`.
- Used by: `chat/service.py` only.

## Data Flow

### Primary Request Path (manual trade)

1. `POST /api/portfolio/trade` parses `TradeRequest` (`backend/app/routes/portfolio.py`)
2. Opens connection via `get_connection()` (`backend/app/db/connection.py`)
3. `execute_trade_and_sync` runs `execute_trade`, which validates side/quantity/price and writes in `with conn:` (`backend/app/services/portfolio.py`)
4. If a sell fully closes an unwatched position, `source.remove_ticker` is called (same file)
5. `record_portfolio_snapshot` inserts a snapshot immediately after the trade (same file)
6. Route returns `{trade, portfolio}`; `get_connection` commits on exit

### Chat Turn Path

1. `POST /api/chat` → `chat()` in `backend/app/chat/router.py`
2. `handle_chat_message` builds messages from portfolio, watchlist-with-prices, last 20 `chat_messages` (`backend/app/chat/service.py`, `backend/app/chat/prompt.py`)
3. `generate_reply` returns `mock_reply` if `LLM_MOCK=true`, else `request_reply` calls LiteLLM (`backend/app/chat/llm.py`)
4. On `LLMError`, the route returns 502; nothing is executed or stored
5. Watchlist changes execute first, then trades; each failure is captured as `{status: "failed", error}` rather than raised (`apply_watchlist_change`, `apply_trade`)
6. User and assistant messages (with `actions`) are inserted, and the response `{message, actions}` is returned

### Price Streaming Path

1. `lifespan` creates `PriceCache` and source, calls `source.start(tracked_tickers(conn))` (`backend/app/main.py`)
2. Source background task writes via `PriceCache.update` (`backend/app/market/cache.py`), incrementing `version`
3. `GET /api/stream/prices` runs `price_events`, which polls `cache.version` every 0.5s and yields the full payload only on change (`backend/app/market/stream.py`)
4. Client reconnects automatically per `retry: 1000` hint

### Snapshot Path

1. `record_snapshots_forever` task in `backend/app/main.py` sleeps 30s, then calls `record_portfolio_snapshot`
2. Snapshot retention (7 days) is enforced in `repository.insert_snapshot`

**State Management:**
- Durable state: SQLite file at `FINALLY_DB_PATH` (default `<repo>/db/finally.db`; the Dockerfile sets `/app/db/finally.db`).
- Live state: `PriceCache` on `app.state.price_cache` and the source on `app.state.market_source`. Lost on restart; rebuilt from `tracked_tickers` at startup.
- No server-side session state; the frontend holds sparkline history since page load.

## Key Abstractions

**MarketDataSource:**
- Purpose: Uniform producer contract for simulator and Massive.
- Examples: `backend/app/market/interface.py`, `backend/app/market/simulator.py`, `backend/app/market/massive_source.py`
- Pattern: Abstract base class with `start`, `add_ticker` (returns False when unknown), `remove_ticker`, `tickers`; `stop()` and `status()` are shared. Conformance is tested in `backend/tests/market/test_conformance.py`.

**PriceCache / PriceUpdate:**
- Purpose: Latest price, previous price, session open, timestamp, and change metadata per ticker.
- Examples: `backend/app/market/cache.py`, `backend/app/market/models.py`
- Pattern: Mutable store with monotonically increasing `version` used as a cheap change detector.

**Service functions with injected collaborators:**
- Purpose: Testable business rules without globals.
- Examples: `execute_trade(conn, cache, ticker, side, quantity)` in `backend/app/services/portfolio.py`; `add_to_watchlist(conn, source, raw_ticker)` in `backend/app/services/watchlist.py`
- Pattern: Functions receive dependencies as arguments; FastAPI `Depends` supplies them at the route layer via `backend/app/deps.py`.

**Domain errors:**
- Purpose: Decouple services from HTTP.
- Examples: `ValidationError`, `NotFoundError` (`backend/app/errors.py`), `MarketDataError` (`backend/app/market/errors.py`), `LLMError` (`backend/app/chat/llm.py`)
- Pattern: Services raise; `register_error_handlers` maps to responses. Chat service catches `ACTION_ERRORS` per action to keep the turn going.

**Structured LLM reply:**
- Purpose: Contract for chat output.
- Examples: `backend/app/chat/schemas.py`
- Pattern: `ChatReply` passed as `response_format` to LiteLLM; parsed with `model_validate_json`.

## Entry Points

**ASGI application:**
- Location: `backend/app/main.py` (`app = FastAPI(...)`)
- Triggers: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1` (Dockerfile `CMD`; `backend/` as working directory)
- Responsibilities: Load `.env` from project root, run lifespan (DB init, cache, source, snapshot task), register routers, mount static files.

**Container entry:**
- Location: `Dockerfile` (`CMD`), `docker-compose.yml`
- Triggers: `scripts/start_mac.sh` / `scripts/start_windows.ps1` (not reviewed in depth here)
- Responsibilities: Builds a Python 3.12 image, syncs dependencies from `backend/uv.lock`, exposes port 8000.

**Health probe:**
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

**What happens:** `async def trade` and `async def chat` open `get_connection()` and run blocking `sqlite3` calls on the event loop. The snapshot task in `backend/app/main.py` does the same.
**Why it's wrong:** Each query blocks the loop, which also stalls the SSE generator in `backend/app/market/stream.py` for that duration.
**Do this instead:** Keep DB work in sync functions (as `read_portfolio` and `read_watchlist` already do) and offload only the awaited source calls, or wrap DB calls in `asyncio.to_thread` if contention appears. Verify with a timing test before changing.

### Route handlers reaching into repository

**What happens:** `read_history` in `backend/app/routes/portfolio.py` calls `repository.list_snapshots` directly, bypassing the service layer that owns portfolio logic.
**Why it's wrong:** Inconsistent with `read_portfolio` and `execute_trade_and_sync`, which go through `services/`.
**Do this instead:** Add a `get_portfolio_history(conn)` function in `backend/app/services/portfolio.py` and call it from the route.

### Duplicated market-source selection in tests

**What happens:** Factory selection reads environment variables directly in `backend/app/market/factory.py`, while `MASSIVE_POLL_INTERVAL` parsing lives beside it.
**Why it's wrong:** Acceptable at current size; becomes hard to test if more settings are added.
**Do this instead:** Keep environment reads in `factory.py` and pass values into constructors (as `MassiveDataSource(cache, client, poll_interval)` already does).

## Error Handling

**Strategy:** Domain exceptions raised in services; mapped to HTTP responses centrally. Chat actions are isolated so one failed action does not abort the turn.

**Patterns:**
- `ValidationError` → 400 `{"error": msg}`; `RequestValidationError` → 400 with `field: message` (`backend/app/routes/error_handlers.py`)
- `NotFoundError` → 404; `MarketDataError` → 503 with a generic message
- `LLMError` → 502 from the chat route only; nothing stored
- Transactions: `get_connection()` commits on success and rolls back on exception; `execute_trade` also uses `with conn:`
- Background tasks: snapshot loop logs with `logger.exception` and retries next interval (`backend/app/main.py`)

## Cross-Cutting Concerns

**Logging:** Standard `logging` module; per-module `logger = logging.getLogger(__name__)` (`backend/app/main.py`, `backend/app/market/simulator.py`, `backend/app/market/factory.py`). No log configuration is set in code.
**Validation:** Pydantic request models at the route layer; business validation in `backend/app/services/portfolio.py` and `backend/app/services/watchlist.py` (ticker regex `^[A-Z]{1,5}$`).
**Authentication:** None. Single-user, no login, per `planning/PLAN.md`.
**Configuration:** Environment variables (`OPENROUTER_API_KEY`, `LLM_MOCK`, `MASSIVE_API_KEY`, `MASSIVE_POLL_INTERVAL`, `FINALLY_DB_PATH`, `STATIC_DIR`), read from `.env` at the project root.

---

*Architecture analysis: 2026-10-16*
