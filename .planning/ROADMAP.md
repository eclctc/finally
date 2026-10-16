# Roadmap: FinAlly — AI Trading Workstation

## Overview

The backend (market data, SSE, portfolio, watchlist, chat, SQLite) already exists and is tested. This roadmap builds the frontend fresh as vertical slices on top of it and hardens the backend chat and watchlist paths. It starts with a walking skeleton that builds and serves from the Docker container, which is the current blocker. Live prices and the watchlist come next, then trading and portfolio views, then the AI chat panel. It ends with the definition of done: one start script launches a working app and the full Playwright E2E suite passes. Backend hardening does not depend on the frontend phases and can run alongside them, but it must finish before the chat phase.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Walking Skeleton** - Next.js static export with dark theme, test harness and testid contract, built and served by the Docker container (completed 2026-10-16)
- [ ] **Phase 2: Backend Hardening** - Chat and watchlist APIs fail cleanly with 502s, idempotent adds, per-action failures and action caps
- [ ] **Phase 3: Live Watchlist & Header** - One SSE price store drives the watchlist rows, flashes, sparklines, connection dot and live header totals
- [ ] **Phase 4: Trading & Portfolio** - Ticker selection, main chart, trade bar, positions table, heatmap and P&L chart
- [ ] **Phase 5: AI Chat** - Docked chat panel with inline action results, error handling and a refresh after AI actions
- [ ] **Phase 6: Ship & E2E Gate** - The start script launches a working app and the full Playwright suite passes with LLM_MOCK=true

## Phase Details

### Phase 1: Walking Skeleton

**Goal:** As a student, I want to run the container and see the dark FinAlly shell at localhost:8000, so that the app ships end to end.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06
**Success Criteria** (what must be TRUE):
  1. `docker build` succeeds with the existing Dockerfile, and the running container serves a dark-themed dashboard shell with a header at `http://localhost:8000/` while `/api/health` still responds.
  2. `npm run build` in `frontend/` produces a static export in `out/`, and the lockfile and `frontend/.gitignore` are committed.
  3. `npm test` runs the Vitest + RTL harness green, and a component that uses `ResizeObserver`, `EventSource` or `scrollIntoView` renders under jsdom.
  4. `next dev` serves the shell with `/api/*` proxied to the backend on `:8000`, and SSE frames from `/api/stream/prices` arrive unbuffered.
  5. The theme colors (`#0d1117`/`#1a1a2e`, muted borders, `#ecad0a`, `#209dd7`, `#753991`) are usable as Tailwind tokens, and every E2E testid and number formatter comes from one shared module.

**Plans**: 4/4 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Package legitimacy check, then tracer: Next 16 static export with theme tokens built by the existing Dockerfile and served at :8000

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Vitest + RTL harness with ResizeObserver/EventSource/scrollIntoView stubs; testIds module with spec parity; bare-number formatters and fetch wrapper
- [x] 01-04-PLAN.md — Dev loop: next dev proxies /api to :8000 with a 40 s unbuffered SSE check; README dev and build commands (wave 2, alongside 01-02)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — Header reads real cash/total from /api/portfolio; terminal layout panels; rebuilt container serves the real-data shell

**UI hint**: yes

### Phase 2: Backend Hardening

**Goal:** As a trader, I want to get clean errors and consistent chat actions, so that the AI copilot is reliable.
**Mode:** mvp
**Depends on**: Nothing (independent of Phases 1, 3 and 4; must complete before Phase 5)
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04, HARD-05, HARD-06, HARD-07, HARD-08, INT-04
**Success Criteria** (what must be TRUE):
  1. When the LLM returns no choices, empty content or unparseable content, or times out, `POST /api/chat` returns 502 with a fixed public `{"error"}` message and never a 500. The missing-API-key message stays actionable, and the full upstream error appears only in the server log.
  2. Firing concurrent adds of the same ticker never returns 500, and the duplicate is treated as already watched.
  3. In a chat turn, an action that fails unexpectedly, or any trade or watchlist change past the cap of 5 each, appears as a `failed` action with a reason. The other actions still execute, the stored chat message matches exactly what was executed, and the DB write lock is not held across the LLM call.
  4. Removing a ticker and adding it back keeps its original session open price, so its daily change % does not reset.
  5. The backend pytest suite passes, with a new test that reproduces each fix, and the snapshot and chat history queries are backed by per-user, time-ordered indexes.

**Plans**: TBD
**UI hint**: no

Research flag: prove the transaction boundary with a failing test first. `execute_trade`'s `with conn:` commits, so nesting does not give atomicity; use per-action SAVEPOINTs opened only after the LLM returns. Enforce the action cap in the service, not the schema.

### Phase 3: Live Watchlist & Header

**Goal:** As a trader, I want to watch live prices stream into my watchlist, so that I can follow the market at a glance.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: LIVE-01, LIVE-02, LIVE-03, LIVE-04, LIVE-05, LIVE-06, LIVE-07, LIVE-08
**Success Criteria** (what must be TRUE):
  1. On a fresh load, the user sees exactly the 10 default watchlist tickers. Each row shows the ticker, a live price and the daily change % against the session open. A row with no price yet shows a placeholder.
  2. Each price flashes green on an uptick and red on a downtick and fades over about 500ms. Each row's sparkline fills in progressively from page load.
  3. A stream frame that carries only some tickers updates only those rows, and the other rows keep their last price. Held tickers that are not watched never appear as watchlist rows.
  4. The header connection dot is green when connected and yellow while reconnecting. It turns red only when the stream is closed, and it returns to green once the stream is recreated. The header also shows the cash balance (`10000` on a fresh DB) and a live total portfolio value.
  5. The user can add a ticker (input is uppercased, and an invalid symbol shows the 400 error inline) and remove a ticker, and the watchlist updates without a reload.

**Plans**: TBD
**UI hint**: yes

Research flag: spike the `EventSource` CLOSED path (non-200 response) against `test/tests/sse-reconnect.spec.ts` before building the connection status logic.

### Phase 4: Trading & Portfolio

**Goal:** As a trader, I want to chart, buy and sell tickers and see my portfolio update, so that I can manage my positions.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: TRADE-01, TRADE-02, TRADE-03, TRADE-04, TRADE-05, PORT-01, PORT-02, PORT-03, PORT-04
**Success Criteria** (what must be TRUE):
  1. Clicking a watchlist row shows that ticker's price since page load in the main chart, with tooltips and `data-ticker` set, and fills the trade bar's ticker field.
  2. The user can buy or sell a quantity, including a fractional one, from the trade bar, and the buttons are disabled while the request is in flight. A rejected trade (insufficient cash or shares, or an unknown ticker) shows the backend error inline.
  3. After a successful trade, the cash balance, the positions table and the P&L chart update without a reload. The positions table shows ticker, quantity, average cost, live price, unrealized P&L and % change, and a row disappears when its position closes.
  4. The heatmap shows each position as a labeled rectangle sized by market value and colored green or red by P&L, and it shows an empty state when there are no positions.
  5. The P&L chart plots total value over time (downsampled to about 300 points) with tooltips, a $10,000 baseline and a live tail point. History and portfolio refresh every 30 seconds.

**Plans**: TBD
**UI hint**: yes

Research flag: spike the Recharts 3 Treemap custom `content` renderer first. It must render `<rect>` (the default renders `<path>`) and always emit ticker labels, to satisfy the `svg rect` and `path.recharts-curve` selectors in `test/tests/portfolio-charts.spec.ts`.

### Phase 5: AI Chat

**Goal:** As a trader, I want to ask the AI to analyze and trade for me, so that I can act through conversation.
**Mode:** mvp
**Depends on**: Phase 2, Phase 4
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06
**Success Criteria** (what must be TRUE):
  1. The chat panel is open on load. The user can type and send a message and scroll the conversation, and collapsing and reopening the panel keeps the conversation.
  2. A loading indicator shows while the user waits for the reply and is gone from the DOM when idle.
  3. Each trade and watchlist change the AI attempts shows inline under its reply with its status and reason, for both executed and failed actions.
  4. After a reply with successful actions, the watchlist, positions, cash and P&L chart refresh without a reload, and the rows the AI changed are briefly highlighted.
  5. A chat error (502) shows inline in the panel and the user's typed input is kept. Quick-prompt chips offer starter questions that contain no mock-trigger keywords (buy, sell, add).

**Plans**: TBD
**UI hint**: yes

### Phase 6: Ship & E2E Gate

**Goal:** As a student, I want to launch FinAlly with one script and see every E2E test pass, so that I know it all works.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: INT-01, INT-02, INT-03
**Success Criteria** (what must be TRUE):
  1. Running `scripts/start_mac.sh` builds the image, launches the container and opens the browser to a working app at `http://localhost:8000`.
  2. The full Playwright suite in `test/` passes against the container with `LLM_MOCK=true`, covering fresh start, watchlist, trading, portfolio charts, chat and SSE reconnect. Failures are fixed in the app, not by weakening the specs.
  3. `npm test` passes, with Vitest + RTL coverage of the price store and merge logic, flash triggering, watchlist add/remove, portfolio revaluation math and chat rendering and loading state.

**Plans**: TBD
**UI hint**: no

Note: unit tests are written alongside each component in Phases 3 to 5. This phase confirms the INT-01 coverage set is complete.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6. Phase 2 has no frontend dependency and may run in parallel with Phases 1, 3 and 4, but it must complete before Phase 5.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Walking Skeleton | 4/4 | Complete    | 2026-10-16 |
| 2. Backend Hardening | 0/TBD | Not started | - |
| 3. Live Watchlist & Header | 0/TBD | Not started | - |
| 4. Trading & Portfolio | 0/TBD | Not started | - |
| 5. AI Chat | 0/TBD | Not started | - |
| 6. Ship & E2E Gate | 0/TBD | Not started | - |
