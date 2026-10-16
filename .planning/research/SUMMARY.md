# Project Research Summary

**Project:** FinAlly (Finance Ally) - AI Trading Workstation
**Domain:** Live, Bloomberg-style trading terminal UI (Next.js static export) on an existing FastAPI backend, with an LLM chat copilot
**Researched:** 2026-10-16
**Confidence:** HIGH for stack and E2E/API contract; MEDIUM for library-behaviour details (Recharts animation/Treemap, EventSource edge cases)

## Executive Summary

FinAlly is a single-page, dark, data-dense trading terminal. It has a live watchlist with price flashes and sparklines, a main price chart, a market-order trade bar, positions, a portfolio treemap and P&L line, and a docked AI chat that can execute trades. The backend (FastAPI, SQLite, SSE price stream, LiteLLM/OpenRouter chat) already exists; the frontend is the remaining work. Experts build this as a static client-rendered app with three state domains:

- a high-frequency live price store (one `EventSource`, read via `useSyncExternalStore`)
- server state fetched over REST and refreshed on mutation
- browser-only UI state

Keeping the 2 Hz price stream out of React state is the most important architectural decision.

The stack is largely fixed by planning/PLAN.md: Next.js 16.4 (`output: 'export'`), React 19.3, Tailwind 4.3 (CSS-first theme), Recharts 3.10 only, Vitest 5 + RTL, Node 22 in the build stage, and no state, data-fetching, or UI libraries. The Playwright suite (test/tests/*.spec.ts) is effectively a detailed UI contract. It fixes exact data-testids, number-parsing rules for cash/total/prices, exactly 10 watchlist rows on a fresh DB, SVG selectors for the heatmap and P&L chart, and specific SSE reconnect behaviour. The previous frontend that satisfied it was deleted, so the contract must be a first-class input.

Key risks:
1. Components that look right but fail the E2E contract (number formatting, row counts, Recharts SVG structure).
2. SSE status/merge logic that replaces the price map or flips to "disconnected" too early.
3. A re-render storm from prices in React state.
4. Backend chat hardening where the obvious "atomic transaction" fix holds the SQLite write lock across the LLM call and causes `database is locked`.

## Key Findings

### Recommended Stack
Exact versions were verified against the npm registry and built end to end in a scratch project: the static export was served through the real FastAPI StaticFiles mount, rendered in Chromium, run under Vitest, and built in node:22-slim.

Core:
- **Next.js 16.4.2** (static export to out/): fixed by PLAN; all-client single page.
- **React / React DOM 19.3.1**: supported by Next 16 and Recharts 3.
- **TypeScript 7.0.2**: works with `next build` and `tsc --noEmit`; incompatible with typescript-eslint. See Open Decisions.
- **Tailwind CSS 4.3.3 + @tailwindcss/postcss 4.3.3** (versions must match): `@import "tailwindcss"` + `@theme` tokens; no tailwind.config.js.
- **Recharts 3.10.1**: sparklines, main chart, P&L line, Treemap heatmap (custom `content` renderer required).
- **Native EventSource + fetch + React hooks**: no SWR/React Query, no WebSocket libs, no second chart library.
- **Test:** Vitest 5.0.5, @vitejs/plugin-react 6.1.2, jsdom 30.1.3, @testing-library/react 16.3.3, @testing-library/dom 10.4.2, jest-dom 7.0.1, user-event 14.6.8. Build image: floating node:22-slim (jsdom needs >= 22.22.2).

Verified gotchas:
- Rewrites are unsupported with static export, so gate them on NODE_ENV.
- Recharts Treemap renders `<path>` by default, but the E2E suite asserts `svg rect`.
- ResponsiveContainer renders nothing in jsdom, so stub ResizeObserver.
- `next dev` writes AGENTS.md unless `agentRules: false` is set.
- `frontend/` needs its own .gitignore.
- `compress: false` is needed so the dev proxy does not buffer SSE.
- Commit package-lock.json, because the Dockerfile uses `npm ci`.

### Expected Features

Must have (table stakes):
- Live watchlist: ticker, price, daily change % (vs session `open_price`, not `change_percent`), sparkline. Rows come from `GET /api/watchlist`; prices are merged from SSE.
- Price flash (green/red, ~500 ms fade) only on real changes; respects prefers-reduced-motion.
- Row click selects: drives `main-chart[data-ticker]` and seeds `trade-ticker`.
- Add/remove ticker (uppercase; inline 400 error; duplicate add is a no-op).
- Main chart (since-page-load line, empty state).
- Connection dot with `data-status` (connected / reconnecting / disconnected).
- Header live total and cash as bare numbers (exactly `10000` on a fresh DB).
- Trade bar: ticker, quantity (fractional OK), Buy, Sell; market orders; inline `trade-error` from `{error}`; buttons disabled in flight.
- Positions table with live P&L; row removed at zero.
- Heatmap (Treemap sized by market value, colored by P&L %) with ticker text and `svg rect`.
- P&L line chart from `/api/portfolio/history`, always mounted, with `svg path.recharts-curve`.
- Chat panel open on load:
  - `chat-message` with `data-role`, plus input and send
  - `chat-loading`, absent when idle
  - `chat-action` with `data-status`
  - inline `chat-error`, with no fake assistant message
- Refresh portfolio, watchlist, and history after any chat reply with `ok` actions, and after every manual trade.
- Dark theme with the PLAN palette; shared number formatters; empty states keep testids mounted.
- Vitest + RTL tests alongside each component.

Should have (v1.x):
- Quick-prompt chips. These must not contain buy/sell/add substrings, which trigger mock actions.
- P&L live tail (client-only synthetic last point).
- $10,000 baseline and session-open reference lines.
- Chart tooltips.
- Highlight rows changed by AI actions.

Defer (v2+):
- Chat history reload (needs a new GET endpoint).
- Trade blotter and realized P&L (excluded by spec).
- Real price history and a timeframe selector.
- Layout persistence, alerts, light theme.
- Auth, multi-user, token streaming, trade confirmation dialogs, limit orders.

### Architecture Approach
The design has three state domains with three owners, plus one rule that keeps the UI fast: `Dashboard` never subscribes to live prices; only leaves do. Plain TS modules in `lib/` (no React) own the risky logic and are unit-tested in isolation:
- `priceStream.ts` owns the EventSource and maps status.
- `priceStore.ts` holds the merged price map, capped per-ticker history, and status, with subscribe/getSnapshot.
- `history.ts` provides appendFrame and downsample.
- `portfolio.ts` provides revaluePortfolio from live prices.
- `api.ts` provides one request() wrapper that throws ApiError using `body.error`.

Hooks in `hooks/` bridge lib and React. Components are presentational, in a flat `components/` folder.

Major components:
1. priceStream + priceStore: single EventSource; merge (never replace) frames; capped history; status; read via useSyncExternalStore.
2. Dashboard: composition root; owns usePortfolio, useWatchlist, useChat, selectedTicker, and the single refresh policy; starts the stream in useEffect.
3. Leaf panels: WatchlistRow/FlashingPrice/Sparkline, Header, MainChart, TradeBar, PositionsTable, Heatmap, PnlChart, ChatPanel.
4. Backend integration: same-origin /api/* REST and /api/stream/prices SSE; no CORS, no env URLs.

Refresh policy:
- Page load fetches watchlist, portfolio, and history.
- A manual trade sets the portfolio from the response and refetches history.
- Watchlist add/remove refetches the watchlist.
- A chat reply with any ok action refetches watchlist, portfolio, and history.
- A 30 s timer refetches history and portfolio.

Guard each refresh with a request id to discard stale responses.

### Critical Pitfalls
1. **Building without the E2E contract.** readNumber strips everything except `[0-9.-]`, so price/cash/total elements must contain only the number. There must be exactly 10 watchlist rows, so no sub-element testid may start with `watchlist-row-`. Put every testid in a `testIds.ts` constants module, and copy TEAM.md section 5 into the frontend phase spec first.
2. **Rows from SSE keys, or replacing the price map.** SSE includes held-but-unwatched tickers, and the reconnect test sends a one-ticker frame (AAPL 1.0, timestamp 0). Build rows from the REST watchlist, merge per ticker, never filter by timestamp, and show `--` for rows with no price.
3. **SSE status fighting EventSource.**
   - Map onopen to connected, and onerror while CONNECTING to reconnecting.
   - Treat only CLOSED as terminal, then recreate with backoff.
   - Use relative `/api/stream/prices` with no query string, because the test intercepts that glob.
   - Close on unmount.
4. **Re-render storm and unbounded buffers at 2 Hz.**
   - Use an external store with per-ticker selectors and React.memo.
   - Cap the buffers; sparklines read the tail.
   - Start buffers for all watched tickers at load.
   - Set isAnimationActive={false} on every series and the Treemap.
5. **Chat hardening holding the SQLite write lock across the LLM call.**
   - Open the transaction only after the LLM returns, with per-action SAVEPOINTs.
   - `execute_trade`'s `with conn:` commits, so nesting does not give atomicity.
   - Validation failures must not roll back sibling trades; they become failed actions.
   - Reproduce each backend fix with a failing test first.

Other pitfalls:
- Watchlist add race: reproduce with asyncio.gather; fix with INSERT ... ON CONFLICT DO NOTHING.
- LLM 502 mapping: move the choices[0] extraction inside the try, use fixed safe messages and logger.exception, and add a request timeout.
- Put the per-turn action cap in the service, not the schema.
- Treemap custom content must render `<rect>` and always emit labels.
- Key the flash on a tick counter or the raw price, not the formatted string.
- `timestamp` is in Unix seconds.
- `change_percent` is vs the previous tick.
- The static export must not touch window/EventSource at module scope.

## Implications for Roadmap

Eight phases are suggested. Backend hardening runs in parallel but must finish before the chat phase.

### Phase 1: Frontend scaffold, theme, test harness, Docker walking skeleton
**Rationale:** The static-export path and Docker build are the current blocker and the highest integration risk. The testid contract and jsdom stubs must exist before components.
**Delivers:**
- Next 16.4 + TS + Tailwind 4 theme.
- Vitest/RTL setup, with vitest.setup.ts stubbing ResizeObserver, EventSource, and scrollIntoView.
- next.config.ts: export only in prod, dev rewrite, compress: false, agentRules: false.
- frontend/.gitignore and a committed package-lock.json.
- testIds.ts and a static Dashboard shell with a header.
- docker build succeeds; `/` is served at :8000 and `/api/health` still works.

**Avoids:** Pitfalls 1, 7, 13.

### Phase 2: Backend hardening (parallel; must finish before Phase 7)
**Rationale:** The chat UI depends on the hardened 502 and failed-action contract. The changes are small, local, and testable, and do not alter route paths or success shapes.
**Delivers:**
- 502 for empty/malformed LLM output, with fixed public messages and a timeout.
- Idempotent watchlist add (ON CONFLICT DO NOTHING).
- Per-action failure capture with no lost chat rows.
- Per-turn action cap (5), recorded as failed actions.
- Open-price reset fix on remove/re-add (optional).
- A null-price decision.
- Indexes on portfolio_snapshots and chat_messages.
- The chat route DB connection is not held across the LLM await.

**Avoids:** Pitfalls 8, 9, 10, 11, 15.

### Phase 3: Live price store, connection status, watchlist, header
**Rationale:** All price-driven features depend on the single EventSource and merged store, which is hard to retrofit.
**Delivers:**
- types.ts, api.ts, priceStream.ts, priceStore.ts, and history.ts (dedupe, cap, merge).
- ConnectionDot.
- useWatchlist with add/remove.
- WatchlistRow and FlashingPrice (keyed remount, raw-price compare).
- Daily % from open_price.
- Header total and cash (exactly 10000 on a fresh DB).

**Avoids:** Pitfalls 2, 3, 4, 14, 15, 22, 23.

### Phase 4: Sparklines, selection, main chart, trade bar
**Rationale:** These depend on store history and selection state; the trade bar seeds from the selection.
**Delivers:**
- Sparkline (no axes, animation off).
- MainChart with data-ticker.
- selectedTicker in Dashboard.
- TradeBar: controlled ticker input, quantity, buy/sell, in-flight disable, trade-error.

**Avoids:** Pitfalls 4, 5, 16.

### Phase 5: Portfolio state, positions, trading
**Rationale:** The heatmap and P&L chart need positions and snapshots, and one refresh path must exist before chat reuses it.
**Delivers:**
- usePortfolio with a request-id guard.
- revaluePortfolio (pure, unit-tested).
- PositionsTable (live P&L, row removed at zero).
- A successful trade sets the portfolio from the response and refetches history.
- Empty states.

**Avoids:** Pitfalls 6, 19.

### Phase 6: Portfolio charts (heatmap, P&L)
**Rationale:** This depends on positions and history, and is the most Recharts-specific phase, so spike first.
**Delivers:**
- Heatmap: Treemap with `<rect>` custom content, a label rule, a P&L color scale clamped at ±5%, and an empty state.
- PnlChart: time axis, auto domain, $10,000 baseline, always mounted.
- Downsampling to ~300 points.
- A 30 s history refresh.

**Avoids:** Pitfalls 5, 18.

### Phase 7: Chat panel
**Rationale:** This depends on the hardened backend (Phase 2), the refresh policy (Phase 5), and the store.
**Delivers:**
- useChat: entries, loading, error; no retry; input kept on failure.
- ChatPanel: open by default, collapsible without unmounting, auto-scroll only at the bottom.
- chat-message, chat-action, chat-loading, and chat-error, with plain-text rendering.
- Refresh after ok actions.

**Avoids:** Pitfalls 12, 16, 17, 24.

### Phase 8: Full integration, E2E gate, polish
**Rationale:** The Playwright suite is the definition of done, and it depends on every panel and a pristine DB.
**Delivers:**
- Full docker build.
- `npm run test:docker` green with LLM_MOCK=true.
- Fix the UI (not the specs) for failures.
- v1.x chips and the P&L live tail if time allows.
- Bind 127.0.0.1:8000 in the start script.

**Avoids:** Pitfalls 12, 21, 25.

### Phase Ordering Rationale
- Scaffold and Docker go first, because of the static-export blocker and because the contract comes before components.
- The store (Phase 3) comes before server-state features, since consumers depend on it and it is costly to retrofit.
- Portfolio state (Phase 5) comes before charts (Phase 6).
- Backend hardening runs alongside Phases 1-6 but gates Phase 7.
- Chat is last among features, since it touches every panel's refresh.

### Research Flags
These need a short spike or deeper research during planning:
- **Phase 6:** Recharts 3 Treemap custom content, small-tile labels, and the `svg rect` / `path.recharts-curve` selectors (library confidence MEDIUM).
- **Phase 3:** The EventSource CLOSED path (non-200 response) has not been exercised; spike it against the sse-reconnect spec.
- **Phase 2:** Transaction boundaries and SAVEPOINTs with execute_trade's `with conn:`; write a failing test first.

These use standard patterns (skip research-phase):
- **Phase 1:** verified end to end during research.
- **Phase 4.**
- **Phase 5:** pure math and a fully specified refresh policy.
- **Phase 7:** a single request/response, fully specified.
- **Phase 8:** fixing the UI against the existing harness.

## Open Decisions (unresolved; not decided by this synthesis)
1. **TypeScript 7 without ESLint vs TypeScript 5.9 with ESLint.** TS 7.0.2 works with next build and tsc --noEmit, but typescript-eslint 8.71.2 refuses TS 7.
   - Option A: TS 7 with no linter (the STACK default; the repo has no linter).
   - Option B: pin typescript@~5.9.3 and add eslint + eslint-config-next 16.4.2 (its react-hooks rules are useful for the SSE effect).
2. **Chat history: session-only vs GET /api/chat.** The backend has no read endpoint for chat_messages, so the transcript resets on reload. PLAN section 8 lists no such endpoint, and the chat spec passes either way. Features and Architecture recommend session-only for v1. Choosing the endpoint adds a Phase 2 backend item.
3. **P&L history: client-side downsampling vs server-side bucketing/since parameter.** /api/portfolio/history is unbounded within 7 days (~20k rows at 30 s). Research recommends client-side downsampling (~300 points) now and deferring the server parameter. The choice decides whether a backend item enters Phase 2.
4. **Connection status on CLOSED.** The sources disagree:
   - Stack and Features: disconnected only on readyState CLOSED.
   - Architecture: disconnected after ~10 s without an open.
   - Pitfalls: CLOSED -> disconnected, then recreate.

   Recommend CLOSED-only, since it matches the spec and avoids timer flapping; confirm it in the Phase 3 spike.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm versions read on research date; full build/serve/Chromium/Vitest/node:22-slim verified. Open decision on TS 7 vs ESLint. |
| Features | HIGH | Derived from test/tests/*.spec.ts, PLAN.md, backend source. Domain conventions MEDIUM. |
| Architecture | HIGH (backend integration), MEDIUM (library behaviour) | Backend read from source; Recharts sizing/animation and EventSource retry partly verified by Stack probe. |
| Pitfalls | MEDIUM-HIGH | Project-specific pitfalls HIGH from specs and source. Recharts Treemap/animation guidance not found authoritatively; spike it. |

**Overall:** HIGH for phase structure and stack; MEDIUM for Recharts Treemap/P&L details and the SSE CLOSED path, to be closed by the Phase 3 and Phase 6 spikes.

### Gaps to Address
- Recharts Treemap rendering and labels: spike in Phase 6 against the `svg rect` and "JPM" assertions.
- EventSource non-200/CLOSED path: spike in Phase 3 with the sse-reconnect test.
- Chat atomicity: prove the transaction boundary with a failing test in Phase 2 before changing execute_trade.
- Massive free-tier staleness: surface `mode` from /api/health as a header badge in Phase 3; do not block on it.
- Open decisions 1-4: resolve during requirements/roadmap.

## Sources
- npm registry (queried 2026-10-16): versions, peers, and engines for all pinned packages; typescript-eslint 8.71.2.
- Official docs:
  - https://nextjs.org/docs/app/guides/static-exports (2026-08-09)
  - https://nextjs.org/docs/app/api-reference/config/typescript (2026-08-25)
  - https://tailwindcss.com/docs/guides/nextjs
  - https://github.com/recharts/recharts/wiki/3.0-migration-guide
- Repo files:
  - test/tests/*.spec.ts, the test helpers, and the compose file
  - planning/PLAN.md and planning/TEAM.md section 5 (via commit 5681c3a)
  - backend/app/chat/*, backend/app/services/*, backend/app/routes/*, backend/app/market/*, backend/app/main.py
  - Dockerfile, .dockerignore, .planning/codebase/CONCERNS.md
- Empirical probe from stack research (scratch project): static export served by the FastAPI mount, Chromium render, Vitest/RTL/jsdom with Recharts, node:22-slim build, dev-proxy SSE buffering test, native EventSource reconnect test.
- Secondary (MEDIUM): the previous frontend at 5681c3a (reference only); general trading-UI conventions; Recharts 3 typings on unpkg.
- Tertiary (LOW, validate): Recharts Treemap animation/perf guidance; Cerebras handling of maxItems in strict structured outputs (validate before Phase 2/7).

---
*Research completed: 2026-10-16*
*Ready for roadmap: yes, once Open Decisions 1-4 are acknowledged*
