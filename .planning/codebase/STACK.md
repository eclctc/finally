---
last_mapped_commit: 065e01660f2a51736d8dd3bf782db951debb2449
last_mapped_at: 2026-10-16
---
# Technology Stack

**Analysis Date:** 2026-10-16

## Languages

**Primary:**
- Python 3.12+ - All application code in `backend/app/` and tests in `backend/tests/`

**Secondary:**
- Bash - Start/stop scripts in `scripts/start_mac.sh`, `scripts/stop_mac.sh`
- PowerShell - Start/stop scripts in `scripts/start_windows.ps1`, `scripts/stop_windows.ps1`
- TypeScript - E2E tests in `test/tests/*.spec.ts` and `test/playwright.config.ts` only
- SQL - Schema in `backend/app/db/schema.sql`

**Frontend:**
- Not present. The `frontend/` directory exists but is empty (the Next.js project was deleted in commit `065e016`). The PLAN specifies Next.js + TypeScript + Tailwind + Recharts, but none of it is on disk.

## Runtime

**Environment:**
- Python 3.12 in the container (`python:3.12-slim` base in `Dockerfile`)
- `backend/pyproject.toml` declares `requires-python = ">=3.12"`; `backend/.python-version` is `3.12`
- Root `pyproject.toml` (project name `finally`) declares `requires-python = ">=3.14"` and root `.python-version` is `3.14`. This root project is not used by the Dockerfile or by `backend/`. The root `.venv/` is a Python 3.14 environment.
- Node 22 (`node:22-slim`) is referenced in `Dockerfile` for the frontend build stage, which currently cannot run because `frontend/` is empty
- Node/npm is used only for the E2E test project in `test/`

**Package Manager:**
- uv (Astral) - Python dependency management for `backend/`
  - Lockfile: present at `backend/uv.lock`
  - Container install: `uv sync --frozen --no-dev --no-install-project` in `Dockerfile`
  - uv is copied into the image from `ghcr.io/astral-sh/uv:latest` (unpinned)
- npm - E2E test dependencies in `test/`
  - Lockfile: present at `test/package-lock.json`
  - Frontend lockfile: missing (frontend absent)

## Frameworks

**Core:**
- FastAPI 0.143.2 - HTTP API, routers, static file mounting. Entry point `app.main:app` in `backend/app/main.py`
- Starlette 1.8.0 - Transitive under FastAPI; provides `StaticFiles` and `StreamingResponse` used for SSE
- Pydantic 2.14.1 - Request/response models and LLM structured output schema (`backend/app/chat/schemas.py`)
- Uvicorn 0.54.0 (with `standard` extras) - ASGI server, run single-worker in `Dockerfile` CMD

**AI / LLM:**
- LiteLLM 1.105.1 - `acompletion` call to `openrouter/openai/gpt-oss-120b` in `backend/app/chat/llm.py`

**Market Data:**
- Massive Python SDK 2.8.0 (`massive` package, formerly Polygon.io client) - `RESTClient` in `backend/app/market/factory.py` and `backend/app/market/massive_source.py`

**Testing:**
- pytest 9.1.1 - Backend test runner; config in `backend/pyproject.toml` (`asyncio_mode = "auto"`, `testpaths = ["tests"]`, `pythonpath = ["."]`)
- pytest-asyncio 1.4.0 - Async test support
- httpx 0.28.1 (dev group) - FastAPI `TestClient` transport and HTTP mocking
- Playwright (`@playwright/test` 1.64.1) - E2E tests in `test/`, config in `test/playwright.config.ts`
- `@types/node` ^26.6.5 - Type definitions for the E2E project

**Build/Dev:**
- uv_build (`>=0.12.3,<0.13.0`) - Build backend for the root `pyproject.toml` only
- Docker multi-stage build - `Dockerfile` (Stage 1 Node 22 frontend build, Stage 2 Python 3.12 runtime)
- Docker Compose - `docker-compose.yml` (optional wrapper), `test/docker-compose.test.yml` (E2E)
- Playwright container image `mcr.microsoft.com/playwright:v1.64.1-noble` for E2E

## Key Dependencies

**Critical:**
- `litellm` 1.105.1 - Only LLM gateway; routes to OpenRouter with Cerebras as the required provider
- `massive` 2.8.0 - Real market data client; only imported when `MASSIVE_API_KEY` is set
- `fastapi` 0.143.2 / `uvicorn` 0.54.0 - Serve API, SSE, and static frontend on port 8000
- `pydantic` 2.14.1 - Validates LLM output (`ChatReply`) and API payloads

**Infrastructure:**
- `python-dotenv` 1.2.4 - Loads `<repo>/.env` at import time in `backend/app/main.py`
- Standard library `sqlite3` - Database access in `backend/app/db/connection.py` (no ORM)
- Standard library `asyncio`, `random`, `math` - In-process GBM market simulator in `backend/app/market/simulator.py`
- `pytest` / `pytest-asyncio` / `httpx` - Dev-only

## Configuration

**Environment variables** (read via `os.getenv` / `os.environ`):
- `OPENROUTER_API_KEY` - Read in `backend/app/chat/llm.py`; missing key yields an `LLMError` (chat returns 502)
- `LLM_MOCK` - `true` enables deterministic mock replies (`backend/app/chat/llm.py`)
- `MASSIVE_API_KEY` - Non-empty selects Massive data source (`backend/app/market/factory.py`)
- `MASSIVE_POLL_INTERVAL` - Poll seconds for Massive, default 15, minimum 2 (`backend/app/market/factory.py`)
- `FINALLY_DB_PATH` - SQLite file path; default `<repo>/db/finally.db` (`backend/app/db/connection.py`). Set to `/app/db/finally.db` in `Dockerfile`
- `STATIC_DIR` - Static frontend directory; default `backend/static` (`backend/app/main.py`). Set to `/app/static` in `Dockerfile`

**Env file:**
- `.env` at repo root is loaded by `backend/app/main.py` via `load_dotenv`, and is passed to Docker via `--env-file` (`scripts/start_mac.sh`) or `env_file` (`docker-compose.yml`, optional)
- Template: `.env.example` (committed). Keys listed: `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, `LLM_MOCK`
- Actual `.env` contents are not recorded in this document

**Build config:**
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

**Development:**
- Python 3.12+ and uv for backend (`cd backend && uv run pytest`)
- Docker for the full container; `scripts/start_mac.sh` also uses `open` / `xdg-open`
- Node.js and npm for E2E tests in `test/`
- Frontend build requires Node 22 once `frontend/` is restored

**Production:**
- Single Docker container, single uvicorn worker, port 8000
- Named volume for SQLite persistence
- Deployment target per PLAN: any container platform (AWS App Runner, Render). No deployment config is present beyond `docker-compose.yml`.

## Known Build Blockers

- `Dockerfile` stage 1 copies `frontend/package.json`, `frontend/package-lock.json`, and `frontend/` source. With `frontend/` empty, `docker build` will fail at the `COPY frontend/package.json` step.
- `scripts/start_mac.sh` and `docker-compose.yml` depend on that image build.

---

*Stack analysis: 2026-10-16*
