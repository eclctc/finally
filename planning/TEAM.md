# FinAlly Agent Team — Working Contract

Shared contract for the agent team. `PLAN.md` is the spec; this file fixes ownership, interfaces, and how we coordinate so everyone can work in parallel. If you need to change anything in here, message the affected owners first, then update this file.

## 1. Team and Ownership

| Name | Role | Owns (only this owner edits these) |
|---|---|---|
| `db-engineer` | Database | `backend/app/db/`, `backend/tests/db/` |
| `backend-engineer` | Backend API + market data | `backend/pyproject.toml`, `backend/uv.lock`, `backend/app/main.py`, `backend/app/market/`, `backend/app/services/`, `backend/app/routes/`, `backend/app/errors.py`, `backend/app/deps.py`, matching `backend/tests/*` |
| `llm-engineer` | LLM chat | `backend/app/chat/`, `backend/tests/chat/` |
| `frontend-engineer` | Frontend | `frontend/` |
| `devops-engineer` | Docker + scripts | `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `scripts/`, `.env.example` |
| `integration-tester` | E2E tests | `test/`, `planning/ISSUES.md` |

The team lead (`team-lead`) coordinates and owns `planning/TEAM.md`, `README.md`.

Rules:
- Edit only files you own. Need a change elsewhere? Message the owner.
- Need a Python dependency? Message `backend-engineer` (single owner of `pyproject.toml` avoids lockfile conflicts). Already installed: fastapi, uvicorn[standard], massive, litellm, pydantic, python-dotenv; dev: pytest, pytest-asyncio, httpx.
- Do not `git commit`. The lead commits at milestones.
- Follow the global code style: simple, small modules, clear names, no defensive over-engineering, no emojis, `uv run` / `uv add` only.
- Write unit tests for your own code and keep them passing: `cd backend && uv run pytest tests/<yours>`.

## 2. Local Runtime Isolation

Everyone shares one working tree, so avoid collisions:

| Who | Backend port | Other |
|---|---|---|
| frontend-engineer | 8000 | Next dev server 3000 |
| backend-engineer | 8001 | |
| llm-engineer | 8002 | |
| devops-engineer | 8020 (container) | image tag `finally:dev` |
| integration-tester | 8010 (container) | compose project `finally-test` |

- The DB path comes from env `FINALLY_DB_PATH`, default `<repo>/db/finally.db` (container: `/app/db/finally.db`). When running a server locally, set `FINALLY_DB_PATH` to a file in your own scratch dir. Unit tests use pytest `tmp_path`.
- Run the backend locally: `cd backend && FINALLY_DB_PATH=... LLM_MOCK=true uv run uvicorn app.main:app --port <yours>`.

## 3. Backend Module Interfaces

Market data is fully designed in `planning/market_data_design.md` (copy-ready code + tests). Use its module layout and the integration rules in its section 13.

### 3.1 `app.db` (db-engineer)

```python
# app/db/__init__.py exports
get_connection() -> ContextManager[sqlite3.Connection]  # WAL, row_factory=sqlite3.Row, commits on success, rolls back on error
init_db() -> None                                         # create schema + seed if missing; idempotent
DEFAULT_USER = "default"

# app/db/repository.py — all take conn first, user_id: str = DEFAULT_USER last
get_cash(conn) -> float
set_cash(conn, amount: float) -> None
list_watchlist(conn) -> list[str]                  # ordered by added_at
is_watched(conn, ticker) -> bool
insert_watchlist_row(conn, ticker) -> None
delete_watchlist_row(conn, ticker) -> bool         # False if no row
list_positions(conn) -> list[Position]
get_position(conn, ticker) -> Position | None
has_position(conn, ticker) -> bool
upsert_position(conn, ticker, quantity, avg_cost) -> None
delete_position(conn, ticker) -> None
insert_trade(conn, ticker, side, quantity, price) -> Trade
insert_snapshot(conn, total_value) -> None          # also prunes snapshots older than 7 days
list_snapshots(conn) -> list[Snapshot]              # oldest first
insert_chat_message(conn, role, content, actions: list[dict] | None) -> None
recent_chat_messages(conn, limit=20) -> list[ChatMessage]  # oldest first
```

`Position`, `Trade`, `Snapshot`, `ChatMessage` are small dataclasses in `app/db/models.py` mirroring the PLAN §7 columns. Schema SQL lives in `app/db/schema.sql`.

### 3.2 Services (backend-engineer)

```python
# app/errors.py
class ValidationError(Exception)   # -> 400 {"error": str(exc)}
class NotFoundError(Exception)     # -> 404 {"error": str(exc)}
# MarketDataError (app.market)     # -> 503

# app/services/watchlist.py
async def add_to_watchlist(conn, source, raw_ticker) -> str
async def remove_from_watchlist(conn, source, ticker) -> None

# app/services/portfolio.py
def execute_trade(conn, cache, ticker, side, quantity) -> Trade           # sync, one transaction
async def execute_trade_and_sync(conn, cache, source, ticker, side, quantity) -> Trade
def get_portfolio(conn, cache) -> dict                                     # same shape as GET /api/portfolio
def record_portfolio_snapshot(conn, cache) -> None

# app/deps.py
get_price_cache(request), get_market_source(request)
```

A 30-second snapshot background task runs in the lifespan in `main.py`.

### 3.3 Chat (llm-engineer)

```python
# app/chat/router.py
router = APIRouter()   # POST /api/chat ; backend-engineer includes it in main.py
# app/chat/service.py
async def handle_chat_message(conn, cache, source, message: str) -> dict  # response body below
```

Uses the cerebras-inference skill (`.claude/skills/cerebras/SKILL.md`). Env `LLM_MOCK=true` gives the fixed mock rules in PLAN §9. Watchlist changes run first, then trades, via the service functions in 3.2.

### 3.4 Static files

`main.py` mounts `StaticFiles(directory=STATIC_DIR, html=True)` at `/` **after** all API routers, only if the directory exists. `STATIC_DIR` env, default `backend/static`. The Dockerfile copies the Next.js export (`frontend/out`) to `/app/static` and sets `STATIC_DIR=/app/static`.

## 4. HTTP API Contract (frontend <-> backend)

Errors: `{"error": "<reason>"}` with 400 / 404 / 502 / 503.

```
GET  /api/health                 -> {"status": "ok", "market_data": {...}}
GET  /api/stream/prices          -> SSE; each event data = {TICKER: PriceUpdate, ...}
     PriceUpdate = {ticker, price, previous_price, open_price, timestamp, change, change_percent, direction}

GET  /api/portfolio              -> {cash_balance, total_value, positions_value, unrealized_pnl,
                                     positions: [{ticker, quantity, avg_cost, current_price,
                                                  market_value, unrealized_pnl, pnl_percent}]}
POST /api/portfolio/trade        {ticker, quantity, side}
                                 -> {trade: {id, ticker, side, quantity, price, executed_at},
                                     portfolio: <same as GET /api/portfolio>}
GET  /api/portfolio/history      -> {snapshots: [{total_value, recorded_at}]}

GET  /api/watchlist              -> {tickers: [{ticker, price, previous_price, open_price, change,
                                                change_percent, direction, timestamp}]}  (price fields null if unpriced)
POST /api/watchlist   {ticker}   -> {ticker}
DELETE /api/watchlist/{ticker}   -> {ticker}

POST /api/chat        {message}  -> {message: str,
                                     actions: [
                                       {type: "watchlist", ticker, action: "add"|"remove", status: "ok"|"failed", error?},
                                       {type: "trade", ticker, side, quantity, status: "ok"|"failed", price?, error?}
                                     ]}
```

Ticker strings are upper-cased by the backend. `PriceUpdate.timestamp` (SSE and `GET /api/watchlist`) is Unix seconds as a float (per `market_data_design.md` §4). All database timestamps (`executed_at`, `recorded_at`, etc.) are ISO 8601 strings.

## 5. Frontend Test IDs (for Playwright)

The frontend must expose these `data-testid` attributes so E2E tests can be written before the UI is finished:

| testid | Element |
|---|---|
| `connection-status` | header dot; `data-status="connected" \| "reconnecting" \| "disconnected"` |
| `total-value`, `cash-balance` | header values |
| `watchlist` | watchlist panel |
| `watchlist-row-{TICKER}` | one row per ticker |
| `watchlist-price-{TICKER}` | price cell |
| `watchlist-add-input`, `watchlist-add-button` | add ticker |
| `watchlist-remove-{TICKER}` | remove button |
| `main-chart` | selected-ticker chart; `data-ticker="{TICKER}"` |
| `trade-ticker`, `trade-quantity`, `trade-buy`, `trade-sell` | trade bar |
| `trade-error` | trade error message |
| `positions-table`, `position-row-{TICKER}` | positions table |
| `heatmap`, `pnl-chart` | portfolio charts |
| `chat-panel`, `chat-input`, `chat-send`, `chat-loading` | chat |
| `chat-message` | each message; `data-role="user" \| "assistant"` |
| `chat-action` | each inline action confirmation; `data-status="ok" \| "failed"` |
| `chat-error` | chat error message |

## 6. Coordination Protocol

- Talk directly with `SendMessage` to the teammate by name. Keep messages short and concrete (file, function, expected vs actual).
- When you finish a piece someone depends on, tell them immediately:
  - `db-engineer` -> `backend-engineer`, `llm-engineer` when `app.db` is usable.
  - `backend-engineer` -> `llm-engineer` when services exist; -> `frontend-engineer`, `devops-engineer` when the API runs.
  - `frontend-engineer` -> `devops-engineer`, `integration-tester` when `npm run build` produces `frontend/out` with the test IDs.
  - `devops-engineer` -> `integration-tester` when the image builds and serves the app.
- Until a dependency lands, build against this contract (stubs or fakes in your own tests), not by editing someone else's files.
- **Issues**: `integration-tester` logs each E2E failure in `planning/ISSUES.md` (id, owner, steps, expected, actual, status) and messages the owner. The owner proves the root cause, fixes it, adds a unit test if feasible, and replies. The tester re-runs and marks it fixed.
- Report status to `team-lead` when you finish a milestone, are blocked, or need a contract decision.
