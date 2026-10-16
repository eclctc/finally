---
last_mapped_commit: 065e01660f2a51736d8dd3bf782db951debb2449
last_mapped_at: 2026-10-16
---
# External Integrations

**Analysis Date:** 2026-10-16

## APIs & External Services

**LLM Gateway (OpenRouter via LiteLLM):**
- Purpose: Chat assistant. Interprets user messages and returns structured JSON with `message`, `trades`, `watchlist_changes`
- Model: `openrouter/openai/gpt-oss-120b` (`MODEL` in `backend/app/chat/llm.py`)
- Provider routing: `EXTRA_BODY = {"provider": {"order": ["cerebras"], "allow_fallbacks": False}}` forces Cerebras inference through OpenRouter
- Options: `response_format=ChatReply` (structured output), `reasoning_effort="low"`, `max_tokens=4096`
- SDK/Client: `litellm` (`acompletion`)
- Auth: `OPENROUTER_API_KEY` env var
- Bypass: `LLM_MOCK=true` returns deterministic replies from `backend/app/chat/mock.py` with no network call
- Failure: any exception or schema mismatch raises `LLMError`; `backend/app/chat/router.py` returns HTTP 502

**Market Data (Massive, formerly Polygon.io) - optional:**
- Purpose: Real US stock prices for watched tickers and held positions
- Enabled when `MASSIVE_API_KEY` is non-empty (`backend/app/market/factory.py`)
- SDK/Client: `massive` package, `RESTClient(api_key=...)`
- Endpoints used (REST polling, not WebSocket):
  - `get_snapshot_all("stocks", tickers=...)` - current snapshot prices (`backend/app/market/massive_source.py`, `_fetch_snapshot_prices`)
  - `get_grouped_daily_aggs(date)` - end-of-day closes, used for backfill (`_fetch_grouped_daily`)
  - `get_previous_close_agg(ticker)` - per-ticker fallback lookup (`_lookup_price`)
- Polling: `MASSIVE_POLL_INTERVAL` seconds (default 15, minimum 2). Free tier allows 5 calls/min, hence the default
- Error type: `massive.exceptions.BadResponse` handled in `massive_source.py`; domain error `MarketDataError` in `backend/app/market/errors.py`
- Tests: `backend/tests/market/test_massive_source.py`

**Market Data Simulator (default, no external service):**
- In-process GBM generator in `backend/app/market/simulator.py`, seed prices in `backend/app/market/seed_prices.py`
- No network dependencies

## Data Storage

**Database:**
- SQLite, single file
  - Default path: `<repo>/db/finally.db`; container path `/app/db/finally.db` via `FINALLY_DB_PATH` (`Dockerfile`)
  - Connection: `get_connection()` context manager in `backend/app/db/connection.py` (WAL mode, commit/rollback, close)
  - Client: stdlib `sqlite3`, `sqlite3.Row` row factory, no ORM
  - Schema: `backend/app/db/schema.sql` (tables `users_profile`, `watchlist`, `positions`, `trades`, `portfolio_snapshots`, `chat_messages`)
  - Repository layer: `backend/app/db/repository.py`
  - Seed data: `backend/app/db/connection.py` (`DEFAULT_CASH`, `DEFAULT_TICKERS`)
- Persistence in Docker: named volume `finally-data` mounted at `/app/db` (`scripts/start_mac.sh`, `docker-compose.yml`)
- Test isolation: `test/docker-compose.test.yml` mounts `/app/db` as tmpfs

**File Storage:**
- Local filesystem only. Static frontend served from `STATIC_DIR` (`/app/static` in the container) via `StaticFiles` in `backend/app/main.py`. The static directory is currently absent.

**Caching:**
- In-process `PriceCache` in `backend/app/market/cache.py`. No external cache.

## Authentication & Identity

**Auth Provider:**
- None. Single-user app, no login. All rows keyed by `user_id = "default"`.
- Secrets are supplied only through environment variables (`OPENROUTER_API_KEY`, `MASSIVE_API_KEY`)

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Python `logging` module, module-level loggers (`logging.getLogger(__name__)`) in `backend/app/main.py`, `backend/app/market/factory.py`, `backend/app/market/simulator.py`
- Notable messages: "Market data: simulator" / "Market data: Massive, polling every Ns"; snapshot failures logged with `logger.exception` in `backend/app/main.py`
- No log configuration (handlers/format) is set in the app; defaults apply

**Health:**
- `GET /api/health` in `backend/app/routes/health.py`
- Used by the Dockerfile `HEALTHCHECK` and by `test/docker-compose.test.yml`

## CI/CD & Deployment

**Hosting:**
- Target: single Docker container (`Dockerfile`), port 8000
- Local: `scripts/start_mac.sh` / `scripts/start_windows.ps1` run `docker run` with `--env-file .env` (only if present); `docker-compose.yml` is an optional wrapper
- Cloud: PLAN lists AWS App Runner, Render; no config files for either are present

**Base images:**
- `node:22-slim` (frontend build stage; blocked, see STACK.md)
- `python:3.12-slim` (runtime)
- `ghcr.io/astral-sh/uv:latest` (uv binary copied into image, unpinned)
- `mcr.microsoft.com/playwright:v1.64.1-noble` (E2E runner)

**CI Pipeline:**
- GitHub Actions in `.github/workflows/claude.yml` and `.github/workflows/claude-code-review.yml`
- Both use `anthropics/claude-code-action@v1` with secret `CLAUDE_CODE_OAUTH_TOKEN`
- No build, test, or deploy workflow exists

## Environment Configuration

**Required env vars:**
- `OPENROUTER_API_KEY` - Required for live chat; app still starts without it
- None other required

**Optional env vars:**
- `MASSIVE_API_KEY` - Switches market data source to Massive
- `MASSIVE_POLL_INTERVAL` - Massive poll interval in seconds
- `LLM_MOCK` - `true` for mock chat
- `FINALLY_DB_PATH` - Database file location
- `STATIC_DIR` - Static frontend location
- `BASE_URL` - E2E target (`test/playwright.config.ts`)
- `FINALLY_IMAGE`, `FINALLY_CONTAINER`, `FINALLY_PORT`, `FINALLY_VOLUME` - Start/stop script overrides (`scripts/*.sh`)

**Secrets location:**
- `.env` file at repo root (gitignored; `.env.example` committed as template). Contents not recorded here.
- Docker runtime receives values through `--env-file` or `env_file`

## Webhooks & Callbacks

**Incoming:**
- None. The app exposes no webhook endpoints.

**Outgoing:**
- None. Outbound traffic is limited to OpenRouter (chat) and Massive (market data, if enabled).

## HTTP Surface (for integration consumers)

- `GET /api/stream/prices` - SSE price stream (`backend/app/market/router.py`, `text/event-stream`; keepalive comment lines from `backend/app/market/stream.py`)
- `GET /api/health` - Health check
- Portfolio, watchlist, and chat routes under `backend/app/routes/` and `backend/app/chat/router.py`
- Static files mounted at `/` when `STATIC_DIR` exists

---

*Integration audit: 2026-10-16*
