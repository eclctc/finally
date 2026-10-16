# FinAlly — AI Trading Workstation

## What This Is

FinAlly (Finance Ally) is a single-user, Bloomberg-terminal-style trading workstation that streams live (simulated or real) market data, lets the user trade a $10,000 virtual portfolio, and includes an AI chat copilot that analyzes positions and executes trades and watchlist changes by natural language. It ships as one Docker container on port 8000 and is the capstone project for an agentic AI coding course. The full specification is `planning/PLAN.md`.

## Core Value

A user runs one Docker command, opens `http://localhost:8000`, and sees prices streaming, can trade, and can talk to an AI that trades for them. All of this happens in one dense, dark, live-updating terminal UI.

## Requirements

### Validated

<!-- Inferred from the existing backend (103 pytest tests pass). -->

- ✓ Market data abstraction: GBM simulator (correlated moves, random events, ~500ms) and Massive REST poller behind one `MarketDataSource` interface, selected by `MASSIVE_API_KEY`. Existing.
- ✓ In-memory price cache with previous price, session open price, timestamp, and version. It tracks the union of watchlist and held tickers. Existing.
- ✓ SSE endpoint `GET /api/stream/prices` pushes one JSON object keyed by ticker when the cache version changes. Existing.
- ✓ SQLite lazy init (WAL) with schema and seed: default user with $10k cash and 10 default watchlist tickers. Existing.
- ✓ Portfolio API: `GET /api/portfolio`, `POST /api/portfolio/trade`, `GET /api/portfolio/history`. Market orders, fractional shares, weighted avg cost on buys, row deleted at zero. Existing.
- ✓ Portfolio snapshots every 30s and after each trade, pruned after 7 days. Existing.
- ✓ Watchlist API: GET/POST/DELETE with `^[A-Z]{1,5}$` validation, no-op on duplicate add, 404 on missing remove. Existing.
- ✓ Chat API `POST /api/chat`: LiteLLM → OpenRouter `gpt-oss-120b` (Cerebras) with structured output. Watchlist changes run first, then trades. Failures are recorded in `actions`. The last 20 messages are kept as history. `LLM_MOCK=true` keyword rules. Existing.
- ✓ `GET /api/health`, 400 `{"error": ...}` validation responses. Existing.
- ✓ Dockerfile (multi-stage Node 22 → Python 3.12), start/stop scripts for macOS/Linux and Windows. Existing (build currently blocked by the missing frontend).
- ✓ Playwright E2E suite in `test/` with `docker-compose.test.yml` (fresh start, watchlist, trading, portfolio charts, chat, SSE reconnect). Existing (currently unrunnable without a UI).
- ✓ Next.js 16 static export in `frontend/`, built by the unchanged Dockerfile and served by FastAPI on :8000 — Phase 1
- ✓ Tailwind 4 `@theme static` dark tokens (`#0d1117`/`#1a1a2e`, accent `#ecad0a`, blue `#209dd7`, purple `#753991`), system fonts, no third-party origins — Phase 1
- ✓ Vitest + React Testing Library harness with ResizeObserver/EventSource/scrollIntoView stubs; shared `testIds`, `format`, `api` modules — Phase 1
- ✓ `next dev` proxies `/api/*` to :8000 with unbuffered SSE (dev only) — Phase 1

### Active

**Frontend (built fresh, PLAN.md §10):**
- [ ] Header: live total portfolio value, cash balance, connection status dot (green/yellow/red) — static header reading `/api/portfolio` shipped in Phase 1; live updates and dot in Phase 3
- [ ] Watchlist panel: ticker, price with green/red flash (~500ms fade), daily change % vs session open, sparkline accumulated from SSE since page load, add/remove tickers
- [ ] Main chart for the selected ticker (click a watchlist row to select)
- [ ] Portfolio heatmap (Recharts Treemap) sized by weight, colored by P&L
- [ ] P&L line chart from `/api/portfolio/history`
- [ ] Positions table: ticker, qty, avg cost, current price, unrealized P&L, % change
- [ ] Trade bar: ticker, quantity, buy/sell buttons, instant market fill, inline errors
- [ ] AI chat panel: docked/collapsible, history, loading indicator, inline trade/watchlist confirmations and failures, inline 502 errors
- [ ] `EventSource` SSE client with automatic reconnection
- [ ] Recharts for all charts
- [ ] Frontend unit tests with Vitest + React Testing Library (harness in place since Phase 1; coverage grows per phase)
- [ ] Layout keeps Chart and Heatmap usable at the 1024px minimum (UI review found ~68px cells; decide before Phase 3)

**Backend hardening (from `.planning/codebase/CONCERNS.md`):**
- [ ] Chat LLM path returns 502 (not 500) for empty or malformed LLM responses
- [ ] Concurrent duplicate watchlist adds do not return 500 (treat as already watched)
- [ ] Chat turn actions and the stored chat row stay consistent when a later action fails unexpectedly
- [ ] Cap the number of trades and watchlist changes per chat turn
- [ ] LLM 502 error body does not leak raw upstream error detail

**Integration:**
- [ ] `docker build` succeeds and `scripts/start_mac.sh` launches a working app at `http://localhost:8000`
- [ ] The Playwright E2E suite in `test/` passes against the container with `LLM_MOCK=true`

### Out of Scope

- Authentication / multi-user. The spec calls for no login, and the schema already carries `user_id` for the future.
- Realized P&L. Excluded in v1 by the spec; the trades table retains the data.
- Limit orders, order book, fees, and confirmation dialogs. The spec says market orders only with instant fill.
- Token-by-token chat streaming. Cerebras is fast enough; a loading indicator is sufficient.
- Cloud deployment (Terraform/App Runner). This is a stretch goal and the user excluded it.
- Docker hardening (non-root user, pinned base images and uv). The user excluded it.
- Root repo cleanup (stray root `pyproject.toml` at Python 3.14, extra venv). The user excluded it.
- WebSockets. SSE is the decided transport.

## Context

- This is a brownfield project. The backend in `backend/` (FastAPI, uv, Python 3.12) is functionally complete and well tested. The codebase map is in `.planning/codebase/`.
- The previous frontend was deliberately deleted in commit `065e016` ("Start of GSD process") so it can be rebuilt through GSD. The old version exists at commit `5681c3a` and may be consulted as a reference, but the frontend is built fresh.
- The E2E specs in `test/tests/*.spec.ts` encode UI expectations (selectors, flows). The new frontend must satisfy them, or they must be updated deliberately.
- Market data was built first. See `planning/MARKET_DATA_SUMMARY.md` and `planning/archive/`.
- LLM calls use the `cerebras-inference` skill (LiteLLM → OpenRouter, Cerebras provider). `OPENROUTER_API_KEY` lives in the root `.env`.

## Constraints

- **Tech stack**: Next.js (TypeScript, static export), Tailwind, Recharts only, FastAPI, uv, SQLite. PLAN.md fixes these choices.
- **Deployment**: one container, one port (8000), same-origin `/api/*`, no CORS. PLAN.md §3.
- **Runtime**: Node 22 LTS for the build stage, Python 3.12 runtime, single uvicorn worker.
- **Code style**: keep it simple and incremental, no defensive over-engineering, short named functions, `uv run`/`uv add` only, no emojis in code. These are the user's global instructions.
- **Testing**: backend pytest, frontend Vitest + RTL, E2E Playwright with `LLM_MOCK=true`.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep the existing backend and harden it | 103 passing tests; it matches PLAN.md; known concerns are targeted fixes | — Pending |
| Build the frontend fresh through GSD phases | The user chose a fresh build; the old code at `5681c3a` is reference only | — Pending |
| Exclude cloud deploy, Docker hardening, and root cleanup | The user chose PLAN.md core only | — Pending |
| Done = Docker build + working UI + passing E2E suite | Observable end-to-end proof of the core value | — Pending |
| TypeScript 7, no ESLint; Tailwind `@theme static` tokens; system font stack | Small toolchain, no third-party font origin | ✓ Good — Phase 1 typecheck/build clean, same-origin UAT passed |
| `output: 'export'` only outside dev, with a dev-only `/api` rewrite | Static export forbids rewrites; dev still needs same-origin API | ✓ Good — Phase 1 |
| Exact npm pins, committed lockfile, `npm ci` in Docker | Supply-chain control for the too-new package set | ✓ Good — Phase 1 security review |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-16 after Phase 1*
