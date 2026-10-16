---
last_mapped_commit: 065e01660f2a51736d8dd3bf782db951debb2449
last_mapped_at: 2026-10-16
---
# Codebase Structure

**Analysis Date:** 2026-10-16

## Directory Layout

```
finally/                          # project root
├── backend/                      # FastAPI uv project (Python 3.12)
│   ├── app/                      # application package
│   │   ├── main.py               # ASGI app, lifespan, static mount
│   │   ├── deps.py               # FastAPI dependency accessors
│   │   ├── errors.py             # domain exceptions
│   │   ├── chat/                 # LLM chat feature
│   │   ├── db/                   # SQLite connection, schema, repository
│   │   ├── market/               # price sources, cache, SSE stream
│   │   ├── routes/               # REST routers and error handlers
│   │   └── services/             # portfolio and watchlist business logic
│   ├── tests/                    # pytest suites, mirror app/ layout
│   ├── pyproject.toml            # project metadata and dependencies
│   ├── uv.lock                   # locked dependencies
│   └── .python-version           # 3.12
├── frontend/                     # EMPTY on disk (Next.js app deleted; see note)
├── planning/                     # agent-facing specs and design docs
│   ├── PLAN.md                   # product spec (source of truth)
│   ├── TEAM.md                   # agent team ownership contract
│   ├── ISSUES.md                 # E2E issue log
│   ├── market_data_design.md     # market data design
│   └── archive/                  # completed market data design docs
├── test/                         # Playwright E2E suite (Node)
│   ├── tests/                    # *.spec.ts scenarios and helpers.ts
│   ├── docker-compose.test.yml   # app + Playwright containers
│   ├── playwright.config.ts
│   └── package.json
├── scripts/                      # start/stop wrappers around Docker
│   ├── start_mac.sh
│   ├── stop_mac.sh
│   ├── start_windows.ps1
│   └── stop_windows.ps1
├── db/                           # runtime volume mount target (finally.db at runtime)
├── .github/workflows/            # claude.yml, claude-code-review.yml
├── .planning/codebase/           # generated codebase maps (this document)
├── Dockerfile                    # build: Node stage (frontend) → Python runtime
├── docker-compose.yml            # optional single-service wrapper
├── .env / .env.example           # environment configuration
├── .dockerignore / .gitignore
├── pyproject.toml                # root-level project file (see note)
├── .python-version
├── README.md
├── CLAUDE.md
└── LICENSE
```

## Directory Purposes

**`backend/app/`:**
- Purpose: All server code. Only package imported at runtime (`app.main:app`).
- Contains: Python modules grouped by feature (`chat/`, `market/`) or layer (`routes/`, `services/`, `db/`).
- Key files: `backend/app/main.py`, `backend/app/deps.py`, `backend/app/errors.py`

**`backend/app/chat/`:**
- Purpose: Everything for `POST /api/chat`.
- Contains: `router.py` (route), `service.py` (turn orchestration), `llm.py` (LiteLLM call), `mock.py` (LLM_MOCK replies), `prompt.py` (message construction), `schemas.py` (structured output models).
- Key files: `backend/app/chat/service.py`, `backend/app/chat/llm.py`

**`backend/app/market/`:**
- Purpose: Market data production and streaming.
- Contains: `interface.py` (ABC), `cache.py`, `models.py`, `errors.py`, `factory.py`, `simulator.py`, `seed_prices.py`, `massive_source.py`, `stream.py` (SSE frame generator), `router.py` (SSE route).
- Key files: `backend/app/market/interface.py`, `backend/app/market/factory.py`, `backend/app/market/cache.py`

**`backend/app/db/`:**
- Purpose: SQLite persistence.
- Contains: `connection.py` (connect, init, seed), `schema.sql` (DDL), `repository.py` (SQL functions), `models.py` (dataclasses).
- Key files: `backend/app/db/schema.sql`, `backend/app/db/repository.py`

**`backend/app/routes/`:**
- Purpose: Non-chat, non-stream REST routers and shared error mapping.
- Contains: `health.py`, `portfolio.py`, `watchlist.py`, `error_handlers.py`.

**`backend/app/services/`:**
- Purpose: Business rules for portfolio and watchlist.
- Contains: `portfolio.py` (trade execution, valuation, snapshots), `watchlist.py` (ticker rules, add/remove).

**`backend/tests/`:**
- Purpose: pytest unit and API tests.
- Contains: subfolders `chat/`, `db/`, `market/`, `routes/`, `services/`, each with `conftest.py` where needed.
- Key files: `backend/tests/routes/test_api.py`, `backend/tests/market/test_conformance.py`, `backend/tests/services/test_portfolio.py`

**`test/`:**
- Purpose: Playwright end-to-end tests run against the container with `LLM_MOCK=true`.
- Contains: `tests/fresh-start.spec.ts`, `tests/trading.spec.ts`, `tests/watchlist.spec.ts`, `tests/chat.spec.ts`, `tests/portfolio-charts.spec.ts`, `tests/sse-reconnect.spec.ts`, `tests/helpers.ts`.
- Generated artifacts: `test/playwright-report/`, `test/test-results/` (ignored by `test/.gitignore`).

**`scripts/`:**
- Purpose: Start/stop the Docker container idempotently.
- Contains: `start_mac.sh` (build if needed, run with volume and optional `.env`, open browser unless `--no-open`), `stop_mac.sh`, PowerShell equivalents.

**`db/`:**
- Purpose: Volume mount point (`/app/db` in the container). `finally.db` is created here at runtime and is gitignored.
- Generated: Yes at runtime. Committed: directory only.

**`planning/`:**
- Purpose: Shared specs and agent contracts. `PLAN.md` is authoritative.
- Contains: `PLAN.md`, `TEAM.md`, `ISSUES.md`, `market_data_design.md`, `archive/`.

**`frontend/`:**
- Purpose: Intended home of the Next.js TypeScript app (static export).
- Current state: Directory exists but is empty. The Next.js project is absent from the working tree. The `Dockerfile` `frontend` stage copies `frontend/package.json` and `frontend/package-lock.json` and runs `npm run build`, so `docker build` fails until the frontend is restored.

**`.claude/`:** Tooling and agent configuration, excluded from app architecture.

**`.venv/`, `backend/.venv/`, `backend/.pytest_cache/`, `__pycache__/`:** Local tooling artifacts; not app code.

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: ASGI app `app`, lifespan, router registration, static mount.
- `Dockerfile`: `CMD ["uvicorn", "app.main:app", ...]` with `--workers 1`.

**Configuration:**
- `backend/pyproject.toml`: runtime and dev dependencies, pytest config (`asyncio_mode = "auto"`, `pythonpath = ["."]`).
- `pyproject.toml` (root): separate project file; read it before editing dependencies to confirm which one is authoritative.
- `.env.example`: documented environment variables.
- `docker-compose.yml`: service `finally`, port 8000, `finally-data` volume, optional `.env`.

**Core Logic:**
- `backend/app/services/portfolio.py`: trade rules and valuation.
- `backend/app/services/watchlist.py`: ticker rules.
- `backend/app/chat/service.py`: chat turn.
- `backend/app/market/simulator.py`: GBM simulator.

**Testing:**
- `backend/tests/`: unit and API tests, `pythonpath` set to `backend/`.
- `test/tests/`: E2E specs.
- `test/playwright.config.ts`, `test/docker-compose.test.yml`.

## Naming Conventions

**Files:**
- Python modules: `snake_case.py`, e.g. `massive_source.py`, `error_handlers.py`.
- Route modules named by resource: `portfolio.py`, `watchlist.py`, `health.py`.
- Tests: `test_<module>.py` under `backend/tests/<area>/`.
- E2E specs: `kebab-case.spec.ts`, e.g. `portfolio-charts.spec.ts`, `sse-reconnect.spec.ts`.
- Scripts: `start_mac.sh` / `start_windows.ps1` style (`snake_case` with platform suffix).
- Docs in `planning/`: `UPPERCASE.md` for agent contracts (`PLAN.md`, `TEAM.md`), `snake_case.md` for design notes.

**Directories:**
- Python packages: lowercase single words (`chat`, `market`, `db`, `routes`, `services`).

**Python symbols:**
- Functions and repository helpers: `verb_noun` (`get_cash`, `insert_trade`, `list_watchlist`, `record_portfolio_snapshot`).
- Private helpers: leading underscore (`_apply_buy`, `_seed_defaults`, `_poll_interval`).
- Classes: PascalCase, with suffix by role (`SimulatorDataSource`, `MassiveDataSource`, `ValidationError`, `ChatReply`).
- Constants: `UPPER_SNAKE` (`HISTORY_LIMIT`, `SNAPSHOT_INTERVAL_SECONDS`, `DEFAULT_CASH`).

## Where to Add New Code

**New REST resource (non-chat):**
- Router: `backend/app/routes/<resource>.py` with `router = APIRouter(prefix="/api/<resource>")`
- Business logic: `backend/app/services/<resource>.py`
- Persistence: add functions to `backend/app/db/repository.py`; add table DDL to `backend/app/db/schema.sql`
- Register in `backend/app/main.py` with `app.include_router(...)`
- Tests: `backend/tests/routes/test_<resource>.py` and `backend/tests/services/test_<resource>.py`

**New service function:**
- Implementation: `backend/app/services/portfolio.py` or `backend/app/services/watchlist.py`; create a new module under `backend/app/services/` if the concern is unrelated to either.
- Tests: `backend/tests/services/test_<module>.py`

**New market data source:**
- Implementation: `backend/app/market/<name>_source.py` subclassing `MarketDataSource`
- Wire into: `backend/app/market/factory.py`
- Conformance: add to `backend/tests/market/test_conformance.py`

**New chat capability or LLM provider change:**
- Schema: `backend/app/chat/schemas.py`
- Prompt: `backend/app/chat/prompt.py`
- Mock behavior: `backend/app/chat/mock.py` (keep keyword rules from PLAN section 9)
- Tests: `backend/tests/chat/`

**New database table:**
- DDL: `backend/app/db/schema.sql` (use `CREATE TABLE IF NOT EXISTS`; `init_db` runs it on every start)
- Dataclass: `backend/app/db/models.py`
- Access functions: `backend/app/db/repository.py`

**Shared helpers:**
- Domain errors: `backend/app/errors.py`
- Dependency accessors: `backend/app/deps.py`
- Market-specific errors: `backend/app/market/errors.py`

**E2E tests:**
- `test/tests/<feature>.spec.ts`; shared helpers in `test/tests/helpers.ts`.

**Frontend (when restored):**
- Expected at `frontend/` with `package.json` and `package-lock.json` at its root (required by the Dockerfile) and a static export to `frontend/out`.

## Special Directories

**`db/`:**
- Purpose: SQLite volume mount target.
- Generated: Yes (`finally.db`, WAL sidecar files).
- Committed: Directory only; `finally.db` is gitignored.

**`backend/.venv/` and `.venv/`:**
- Purpose: Local virtual environments.
- Generated: Yes. Committed: No.

**`backend/app/**/__pycache__/`, `backend/.pytest_cache/`:**
- Generated: Yes. Committed: No.

**`test/playwright-report/`, `test/test-results/`:**
- Generated: Yes. Committed: No.

**`.planning/codebase/`:**
- Purpose: Generated codebase maps consumed by GSD commands.
- Generated: Yes. Committed: Per project workflow.

**Runtime static directory (`/app/static` in the container, `backend/static` by default):**
- Purpose: Frontend build output served by `StaticFiles` at `/`.
- Generated: Yes, by the Dockerfile frontend stage. Not present in the working tree.

---

*Structure analysis: 2026-10-16*
