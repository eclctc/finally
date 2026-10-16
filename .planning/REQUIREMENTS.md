# Requirements: FinAlly — AI Trading Workstation

**Defined:** 2026-10-16
**Core Value:** A user runs one Docker command, opens `http://localhost:8000`, and sees prices streaming, can trade, and can talk to an AI that trades for them, all in one dense, dark, live-updating terminal UI.

The backend already exists. See PROJECT.md "Validated" for the existing capabilities. The v1 requirements below cover the fresh frontend, the backend hardening, and the integration. The E2E suite in `test/tests/*.spec.ts` defines the exact UI contract (data-testids, number formats, SVG selectors). Requirements refer to it rather than restating each selector.

## v1 Requirements

### Foundation (scaffold, build, harness)

- [ ] **FND-01**: `frontend/` is a Next.js 16 + TypeScript 7 + Tailwind 4 project. `npm run build` produces a static export in `out/`. Lockfile and `.gitignore` are committed.
- [ ] **FND-02**: `docker build` succeeds with the existing multi-stage Dockerfile. The container serves the UI at `http://localhost:8000/`, and `/api/health` still responds.
- [ ] **FND-03**: The dark terminal theme is defined as Tailwind tokens: backgrounds `#0d1117`/`#1a1a2e`, muted borders, accent yellow `#ecad0a`, blue `#209dd7`, purple `#753991` for submit buttons.
- [ ] **FND-04**: The Vitest + React Testing Library harness runs with `npm test`. Its jsdom setup stubs `ResizeObserver`, `EventSource` and `scrollIntoView`.
- [ ] **FND-05**: All E2E data-testids live in a single constants module. Shared number formatters render bare numbers where the E2E suite parses them (cash, total value, prices).
- [ ] **FND-06**: Local dev works. `next dev` proxies `/api/*` to `:8000` without buffering SSE, and export mode is used only for production builds.

### Backend Hardening

- [ ] **HARD-01**: `POST /api/chat` returns 502 `{"error": ...}`, not 500, when the LLM returns no choices, empty content or unparseable content.
- [ ] **HARD-02**: The 502 error body uses a fixed public message and the full upstream error is logged server-side. The actionable missing-API-key message is kept.
- [ ] **HARD-03**: The LLM call has a request timeout. When it times out, the user gets a 502.
- [ ] **HARD-04**: Concurrent adds of the same ticker never return 500. A duplicate is treated as already watched.
- [ ] **HARD-05**: In a chat turn, an unexpected failure in one action is recorded as a `failed` action. It does not abort the turn. Every executed action is reflected in the stored chat message, and the DB write lock is not held across the LLM call.
- [ ] **HARD-06**: Each chat turn is capped at 5 trades and 5 watchlist changes. Items over the cap are recorded as `failed` actions with a reason, and the reply is not rejected.
- [ ] **HARD-07**: Removing and then re-adding a ticker keeps its original session open price, so its daily change % is not reset.
- [ ] **HARD-08**: Indexes exist on `portfolio_snapshots` and `chat_messages` for their per-user, time-ordered queries.

### Live Market Data UI

- [ ] **LIVE-01**: The frontend opens one native `EventSource` to `/api/stream/prices`. Each frame is merged into a price store per ticker and never replaces it. The stream stays out of top-level React state.
- [ ] **LIVE-02**: The header connection dot shows green for connected, yellow for reconnecting and red for disconnected, through `data-status`. Disconnected is shown only when the `EventSource` is CLOSED, and a closed stream is recreated.
- [ ] **LIVE-03**: The watchlist panel lists the tickers from `GET /api/watchlist`. Each row shows ticker, live price and daily change % against the session `open_price`. A row with no price yet still renders with a placeholder.
- [ ] **LIVE-04**: The price briefly flashes green on an uptick and red on a downtick, fading over about 500ms through a CSS transition.
- [ ] **LIVE-05**: Each watchlist row has a sparkline built from a capped per-ticker history that the SSE stream fills from page load.
- [ ] **LIVE-06**: The user can add a ticker from the watchlist panel. Input is uppercased, and a 400 error shows inline.
- [ ] **LIVE-07**: The user can remove a ticker from the watchlist panel.
- [ ] **LIVE-08**: The header shows the live total portfolio value (cash plus positions revalued at live prices) and the cash balance.

### Charts & Trading

- [ ] **TRADE-01**: Clicking a watchlist row selects that ticker. The main chart shows its price over time since page load, with tooltips, and exposes the selected ticker through `data-ticker`.
- [ ] **TRADE-02**: Selecting a ticker fills the trade bar's ticker field.
- [ ] **TRADE-03**: The user can buy or sell a quantity, including fractional amounts, from the trade bar. The buttons are disabled while the request is in flight.
- [ ] **TRADE-04**: A rejected trade shows the backend `{"error"}` text inline in the trade bar, for example insufficient cash or shares, or an unknown ticker.
- [ ] **TRADE-05**: After a successful trade, the cash balance, positions and P&L history update without a page reload.

### Portfolio Views

- [ ] **PORT-01**: The positions table shows ticker, quantity, average cost, live current price, unrealized P&L and % change. A row disappears when its position closes.
- [ ] **PORT-02**: The portfolio heatmap is a Recharts Treemap. Each position is a labeled `<rect>` sized by market value and colored green or red by P&L. An empty state shows when there are no positions.
- [ ] **PORT-03**: The P&L line chart plots total value from `/api/portfolio/history`. It downsamples to about 300 points on the client, has tooltips, and has a $10,000 baseline.
- [ ] **PORT-04**: The P&L chart shows a live tail point for the current total value. History and portfolio refresh every 30 seconds.

### AI Chat

- [ ] **CHAT-01**: A docked, collapsible chat panel is open on load. It has a message input, a send button and a scrolling conversation for the session.
- [ ] **CHAT-02**: A loading indicator shows while waiting for the LLM and is removed from the DOM when idle.
- [ ] **CHAT-03**: Executed and failed trades and watchlist changes show inline under the assistant reply, each with its status and reason.
- [ ] **CHAT-04**: A chat error (502) shows inline in the panel and the user's input is not lost.
- [ ] **CHAT-05**: After a reply with successful actions, the watchlist, portfolio and P&L history refresh, and the rows the AI changed are briefly highlighted.
- [ ] **CHAT-06**: Quick-prompt chips offer starter questions. They don't contain mock-trigger keywords such as buy, sell or add.

### Integration & Quality

- [ ] **INT-01**: The frontend has Vitest + RTL tests for the price store and merge logic, flash triggering, watchlist add/remove, portfolio revaluation math and chat rendering and loading state.
- [ ] **INT-02**: `scripts/start_mac.sh` builds and launches a working app at `http://localhost:8000` and opens the browser.
- [ ] **INT-03**: The full Playwright E2E suite in `test/` passes against the container with `LLM_MOCK=true`. It covers fresh start, watchlist, trading, portfolio charts, chat and SSE reconnect.
- [ ] **INT-04**: The backend pytest suite passes, including new tests that reproduce each hardening fix.

## v2 Requirements

### Chat
- **CHAT-V2-01**: Chat history restored on reload via a `GET /api/chat` endpoint

### Data
- **DATA-V2-01**: Server-side bucketing or a `since` parameter for `/api/portfolio/history`
- **DATA-V2-02**: Real historical price data and a timeframe selector for the main chart
- **DATA-V2-03**: Cap on watchlist size

### Portfolio
- **PORT-V2-01**: Realized P&L and trade blotter

## Out of Scope

| Feature | Reason |
|---------|--------|
| Authentication / multi-user | The spec calls for no login. The schema already has `user_id` for later. |
| Limit orders, order book, fees | The spec says market orders only, with instant fill. |
| Trade confirmation dialogs | Auto-execution is a deliberate demo choice in the spec. |
| Chat token streaming | Cerebras is fast enough, so a loading indicator is enough. |
| Additional chart libraries | The spec says Recharts only. |
| ESLint | The user chose TypeScript 7. typescript-eslint doesn't support it yet. |
| Cloud deploy (Terraform/App Runner) | Stretch goal. The user excluded it. |
| Docker hardening (non-root, pinned images) | The user excluded it. |
| Root repo cleanup (stray root pyproject) | The user excluded it. |
| Light theme, layout persistence, alerts | Not in the spec. A dark terminal is the identity. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Pending |
| FND-02 | Phase 1 | Pending |
| FND-03 | Phase 1 | Pending |
| FND-04 | Phase 1 | Pending |
| FND-05 | Phase 1 | Pending |
| FND-06 | Phase 1 | Pending |
| HARD-01 | Phase 2 | Pending |
| HARD-02 | Phase 2 | Pending |
| HARD-03 | Phase 2 | Pending |
| HARD-04 | Phase 2 | Pending |
| HARD-05 | Phase 2 | Pending |
| HARD-06 | Phase 2 | Pending |
| HARD-07 | Phase 2 | Pending |
| HARD-08 | Phase 2 | Pending |
| LIVE-01 | Phase 3 | Pending |
| LIVE-02 | Phase 3 | Pending |
| LIVE-03 | Phase 3 | Pending |
| LIVE-04 | Phase 3 | Pending |
| LIVE-05 | Phase 3 | Pending |
| LIVE-06 | Phase 3 | Pending |
| LIVE-07 | Phase 3 | Pending |
| LIVE-08 | Phase 3 | Pending |
| TRADE-01 | Phase 4 | Pending |
| TRADE-02 | Phase 4 | Pending |
| TRADE-03 | Phase 4 | Pending |
| TRADE-04 | Phase 4 | Pending |
| TRADE-05 | Phase 4 | Pending |
| PORT-01 | Phase 4 | Pending |
| PORT-02 | Phase 4 | Pending |
| PORT-03 | Phase 4 | Pending |
| PORT-04 | Phase 4 | Pending |
| CHAT-01 | Phase 5 | Pending |
| CHAT-02 | Phase 5 | Pending |
| CHAT-03 | Phase 5 | Pending |
| CHAT-04 | Phase 5 | Pending |
| CHAT-05 | Phase 5 | Pending |
| CHAT-06 | Phase 5 | Pending |
| INT-01 | Phase 6 | Pending |
| INT-02 | Phase 6 | Pending |
| INT-03 | Phase 6 | Pending |
| INT-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0

---
*Requirements defined: 2026-10-16*
*Last updated: 2026-10-16 after roadmap creation*
