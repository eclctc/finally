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
- ✓ Chat LLM failures (no choices, bad/non-finite content, timeout 30 s) return a fixed 502, never a 500; upstream detail logged only — Phase 2
- ✓ Concurrent duplicate watchlist adds are idempotent (`ON CONFLICT DO NOTHING`) — Phase 2
- ✓ Each chat action is its own savepoint unit; unexpected failures become `failed` actions; no write lock across the LLM call — Phase 2
- ✓ Chat turn capped at 5 trades and 5 watchlist changes; overflow recorded as `failed` — Phase 2
- ✓ Session open price survives ticker remove/re-add; per-user time-ordered indexes on snapshots and chat — Phase 2
- ✓ Header: live total at live prices, cash, connection dot (green/yellow/red) following the real stream — Phase 3
- ✓ Watchlist panel: price flash (50ms hold, ~500ms fade, none under reduced motion), daily change % vs session open, 64x20 sparkline since load, add/remove with inline errors, loading/failed/empty states — Phase 3
- ✓ `EventSource` SSE client: one stream, per-ticker store, CLOSED stream recreated after 1s — Phase 3
- ✓ Layout keeps Chart and Heatmap usable: 1280px minimum width (D-01) — Phase 3
- ✓ Main chart for the selected ticker: row click or keyboard selects, first ticker by default, 1,200 timestamped points (10 min), Open line, tooltip — Phase 4
- ✓ Trade bar: ticker, quantity (fractional), buy/sell, disabled in flight, inline backend errors, fill line; typed ticker survives the default selection — Phase 4
- ✓ Header, positions and heatmap update from the trade response without a reload; one `usePortfolio()` in `Dashboard` with a 30 s poll and stale-response guard — Phase 4
- ✓ Positions table: ticker, qty, avg cost, live price, unrealized P&L, % change; row disappears when closed — Phase 4
- ✓ Portfolio heatmap (Recharts Treemap, custom `<rect>` tiles) sized by live value, colored by P&L, empty state — Phase 4
- ✓ P&L line chart from `/api/portfolio/history`: 300-point downsample, `Start $10,000` baseline, live tail, 30 s history poll — Phase 4
- ✓ Recharts for all charts — Phase 4
- ✓ AI chat panel open on load, collapsible to a 40px rail without losing the conversation, draft or a pending request; session-only transcript — Phase 5
- ✓ Chat send lifecycle: `Thinking...` line, locked composer, one request per action, Enter sends / Shift+Enter newline, quick-prompt chips (no trade verbs), inline 502 error with the text kept — Phase 5
- ✓ Inline action chips for every executed or failed trade and watchlist change, text-only rendering — Phase 5
- ✓ After a chat reply with ok actions, watchlist, portfolio and history refresh with no reload; changed rows get a blue highlight (1.5 s hold, 1 s fade) only when all three refreshes succeed — Phase 5

### Active

**Frontend (built fresh, PLAN.md §10):**
- [ ] Frontend unit tests with Vitest + React Testing Library (374 tests after Phase 5; coverage grows per phase)
- [ ] Chat robustness: a lost chat response shows a retry prompt without refreshing, so a resend can re-run executed trades (Phase 5 review WR-01, open)

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
| Per-action committed savepoints, not one transaction per chat turn | Keeps awaits (Massive lookup, LLM) outside transactions | ✓ Good — Phase 2; residual: a failing final chat-row insert leaves actions unrecorded (WR-03, open) |
| Non-finite LLM quantity rejects the whole reply (502) | Matches HARD-01 "unusable output"; reversible one-line choice | ✓ Good — Phase 2 gap closure |
| Module-level price store read via `useSyncExternalStore`; SSE is the only price source, REST only seeds unpriced tickers | Per-ticker re-renders; avoids the REST-vs-stream race in `sse-reconnect.spec.ts` | ✓ Good — Phase 3 (UAT 4/4, Playwright 3/3) |
| 1280px minimum width instead of 1024px | Chart/Heatmap cells were ~68px at 1024 | ✓ Good — Phase 3 UAT layout check |
| Header shows the client-computed live total, not the API `total_value` | The total moves with every tick | ✓ Good — Phase 3; review WR-01..WR-04 open (watchlist refresh/race robustness, change color rounding) |
| One `usePortfolio()` and one `usePortfolioHistory()` in `Dashboard`, passed as props; trades apply the POST response directly | No context needed for direct children; no extra GET after a trade; Phase 5 chat reuses `refresh()`/`refreshHistory()` | ✓ Good — Phase 4 (UAT 3/3, E2E 9/9) |
| `useWatchlist` lifted into `Dashboard`; `load()` returns `Promise<boolean>` and a superseded load returns `false` | One chat reply can reload all three sources and gate the highlight on success | ✓ Good — Phase 5; review WR-02 notes the highlight is skipped when loads overlap |
| Module-level `aiChangeStore` (hold/fade timers) read per row, marked only when every refresh succeeds | Highlight never claims a change the UI has not shown | ✓ Good — Phase 5 (UAT 5/5) |
| Chat collapse lives inside `ChatDock`'s own `aside` (`w-[320px]` / `w-10`); `useChat` sits above both views | Collapse keeps the conversation and in-flight request; `Dashboard` layout untouched | ✓ Good — Phase 5 |
| Treemap tiles via a custom `content` renderer returning `<rect>` + `<text>`, no `clipPath` | E2E reads the first `svg rect` of the heatmap; spike confirmed in jsdom and Chromium | ✓ Good — Phase 4 |
| Up/down color from the displayed (rounded) value via `signClass` | `+0.004%` displays `0.00%` and must be muted (closes Phase 3 WR-04) | ✓ Good — Phase 4 |

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
*Last updated: 2026-10-16 after Phase 5*
