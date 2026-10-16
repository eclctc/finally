# Architecture Research

**Domain:** Live AI trading workstation UI (Next.js static export) on an existing FastAPI backend
**Researched:** 2026-10-16
**Confidence:** HIGH for backend integration points (read from source: routes, chat service, SSE stream, E2E specs). MEDIUM for library behavior (Recharts 3 sizing and animation, EventSource retry semantics). Those come from prior knowledge and the deleted frontend at `5681c3a`, and were not re-verified against live docs this session.

Scope note: backend internals are not re-researched (see `.planning/codebase/ARCHITECTURE.md`). This file covers the frontend architecture, how it plugs into the existing API surface, and where the five backend hardening items land in existing modules.

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│ Browser: one client-rendered page (Next.js static export, no routing)   │
│                                                                        │
│  Dashboard (composition root; owns SERVER STATE + UI STATE only)        │
│  ┌───────────┐ ┌───────────┐ ┌──────────┐ ┌────────┐ ┌─────────────┐  │
│  │ Header    │ │ Watchlist │ │MainChart │ │TradeBar│ │ ChatPanel   │  │
│  │ (live $)  │ │ rows+spark│ │          │ │        │ │             │  │
│  └─────┬─────┘ └─────┬─────┘ └────┬─────┘ └───┬────┘ └──────┬──────┘  │
│        │  ┌──────────┴───┐  ┌─────┴────┐ ┌────┴─────────┐    │         │
│        │  │ Heatmap      │  │PnlChart  │ │PositionsTable│    │         │
│        │  └──────┬───────┘  └────┬─────┘ └──────┬───────┘    │         │
│        ▼         ▼               │              ▼            │         │
│  ┌──────────────────────────┐    │     ┌────────────────────┐│         │
│  │ priceStore (LIVE STATE)  │    │     │ server-state hooks ││         │
│  │ prices, history, status  │    │     │ portfolio/watchlist││         │
│  │ useSyncExternalStore     │    │     │ /snapshots/chat    │◄┘         │
│  └────────────▲─────────────┘    │     └─────────▲──────────┘           │
│               │ frames           │               │ fetch                │
│  ┌────────────┴─────────────┐    │     ┌─────────┴──────────┐           │
│  │ priceStream (EventSource)│    └────►│ api.ts (fetch)     │           │
│  └────────────▲─────────────┘          └─────────▲──────────┘           │
└───────────────┼────────────────────────────────┼──────────────────────┘
                │ GET /api/stream/prices (SSE)   │ GET/POST/DELETE /api/*
┌───────────────┴────────────────────────────────┴──────────────────────┐
│ FastAPI :8000 (same origin; StaticFiles mounted at "/" AFTER routers)  │
└────────────────────────────────────────────────────────────────────────┘
```

The load-bearing idea is three state domains with three different update rates and owners:

| Domain | Rate | Source of truth | Owner in frontend |
|--------|------|-----------------|-------------------|
| Live market (prices, per-ticker history, connection status) | ~2 Hz | SSE frames | `priceStore` (external store), read by leaf components via `useSyncExternalStore` |
| Server state (portfolio, watchlist membership, P&L snapshots) | On mutation + 30 s | REST | Hooks called in `Dashboard`, passed down as props |
| UI state (selected ticker, chat open/closed, chat transcript) | On user action | Browser only | `Dashboard` `useState`, `useChat` |

Rule that keeps this fast: `Dashboard` never subscribes to live prices. Only leaves do (rows, header total, positions, heatmap, charts). Otherwise every 500 ms frame re-renders the whole tree and restarts chart work.

### Component Responsibilities

| Component | Responsibility | Talks to |
|-----------|----------------|----------|
| `priceStream.ts` (plain TS) | Owns the `EventSource`; parses frames; reports status; manual reconnect when the browser gives up (`readyState === CLOSED`) | `priceStore` only |
| `priceStore.ts` (plain TS) | Holds `prices` (ticker to latest `PriceUpdate`), `history` (ticker to capped point array), `status`; `subscribe`/`getSnapshot`/`applyFrame`/`setStatus`/`reset` | Read by hooks; written by `priceStream` |
| `api.ts` | One `request()` wrapper; throws `ApiError(message)` using `body.error` for any non-2xx; typed functions per endpoint | Backend |
| `portfolio.ts` (pure) | `revaluePortfolio(portfolio, prices)`: recomputes `current_price`, `market_value`, `unrealized_pnl`, `pnl_percent`, totals from live prices | Header, PositionsTable, Heatmap |
| `history.ts` (pure) | `appendFrame(history, frame, cap)` and `downsample(snapshots, maxPoints)` | `priceStore`, `PnlChart` |
| `Dashboard` | Composition root. Owns `usePortfolio`, `useWatchlist`, `useChat`, `selectedTicker`. Starts the SSE connection in an effect and passes server state and callbacks down | All panels |
| `Header` | Total value (live), cash, connection dot | `useLivePortfolio`, `useConnectionStatus` |
| `Watchlist` + `WatchlistRow` | Rows come from the REST watchlist list. Price, flash, daily %, and sparkline come from the store. Add input, remove button, row select | `usePrice(ticker)`, `usePriceHistory(ticker)` |
| `FlashingPrice` | Price text plus 500 ms green/red flash | none (props only) |
| `Sparkline` | Recharts `LineChart` over last N points, no axes, animation off | none (props only) |
| `MainChart` | Recharts chart of the selected ticker's history; `data-ticker` attribute | `usePriceHistory` |
| `TradeBar` | Ticker and quantity inputs, buy/sell, inline `trade-error`; ticker field seeded from selection | `onTrade` callback from Dashboard |
| `PositionsTable` | Live-revalued positions; row click selects ticker | `useLivePortfolio` |
| `Heatmap` | Recharts `Treemap`, size = market value, color = P&L % | `useLivePortfolio` |
| `PnlChart` | Recharts `LineChart` over snapshots | `snapshots` prop |
| `ChatPanel` | Transcript, input, loading, inline actions and errors; collapsible | `useChat` |

## Recommended Project Structure

```
frontend/
├── next.config.ts            # output:'export'; dev-only /api rewrite to :8000; compress:false
├── vitest.config.mts, vitest.setup.ts
└── src/
    ├── app/
    │   ├── layout.tsx        # fonts, dark body
    │   ├── page.tsx          # 'use client'-free shell that renders <Dashboard/>
    │   └── globals.css       # Tailwind theme tokens + flash keyframes
    ├── lib/                  # NO React imports: unit-testable in isolation
    │   ├── types.ts          # PriceUpdate, Portfolio, Position, Snapshot, ChatAction, ChatReply
    │   ├── api.ts
    │   ├── priceStream.ts
    │   ├── priceStore.ts
    │   ├── history.ts
    │   ├── portfolio.ts
    │   └── format.ts         # money, percent
    ├── hooks/
    │   ├── usePriceStore.ts  # usePrice, usePrices, usePriceHistory, useConnectionStatus
    │   ├── usePortfolio.ts   # portfolio + snapshots + refresh (stale-response guard)
    │   ├── useWatchlist.ts   # entries + add/remove + refresh
    │   ├── useLivePortfolio.ts # revalue(portfolio, usePrices())
    │   └── useChat.ts
    └── components/           # one file per component in the table above, plus Panel.tsx, chartTheme.ts
```

### Structure Rationale

- **`lib/` has no React.** The stream, store, history math, and revaluation are the logic most likely to be wrong. Plain TS functions are tested by Vitest with no DOM.
- **`hooks/` is the only layer that touches both `lib/` and React.** Components stay presentational and are tested with props or a primed store.
- **Flat `components/`** because there is one page. No route groups, no `app/` nesting beyond `page.tsx`.
- The deleted frontend at `5681c3a` used this same split (hooks per concern, `Dashboard` as composition root). Reuse the shape as reference, not the code.

## Architectural Patterns

### Pattern 1: External store for the SSE feed

**What:** A module-level store with `subscribe`/`getSnapshot`, read through `useSyncExternalStore` with per-ticker selectors.
**When to use:** High-frequency data with many independent readers (10 rows, header, positions, charts).
**Trade-offs:** About 60 lines of code. Avoids a state library and avoids Context re-rendering every consumer on each frame. Snapshots must be immutable: replace the changed ticker's object and array references, never mutate in place.

```typescript
// lib/priceStore.ts (shape)
export const priceStore = {
  state: { prices: {}, history: {}, status: "reconnecting" } as StoreState,
  listeners: new Set<() => void>(),
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  getSnapshot() { return this.state; },
  applyFrame(frame: PriceFrame) {
    this.state = {
      ...this.state,
      prices: { ...this.state.prices, ...frame },           // MERGE, never replace
      history: appendFrame(this.state.history, frame, HISTORY_CAP),
    };
    this.listeners.forEach((fn) => fn());
  },
};
// hooks/usePriceStore.ts
export const usePrice = (t: string) =>
  useSyncExternalStore(priceStore.subscribe, () => priceStore.getSnapshot().prices[t], () => undefined);
```

Merge, not replace, is required by `test/tests/sse-reconnect.spec.ts`, whose stub frame contains only AAPL. It also means prices survive a reconnect gap.

### Pattern 2: Capped per-ticker history, appended per frame

**What:** `history[ticker]` is an array of `{t, price}`. `appendFrame` appends only when `update.timestamp` is newer than the last point (a reconnect resends the same data), copies on write, and trims to `HISTORY_CAP` (suggest 600, about 5 minutes at 2 Hz). Sparklines render `slice(-120)`. `MainChart` renders the whole buffer.
**When to use:** The spec says sparklines are "accumulated on the frontend from the SSE stream since page load", so the buffer is client-only and lost on reload by design.
**Trade-offs:** Copy-on-write of at most 600 points times 10 tickers at 2 Hz is trivial. The buffer is keyed by whatever tickers appear in frames, including held-but-unwatched tickers. That is fine, because a ticker shown on the chart always has a buffer once a frame has arrived.

### Pattern 3: Server state is authoritative; client revalues with live prices

**What:** `GET /api/portfolio` returns positions with `current_price` fixed at request time. Do not poll it for display. `revaluePortfolio(portfolio, prices)` recomputes `market_value`, `unrealized_pnl`, `pnl_percent`, `total_value` on every price frame. Cash comes from the server only.
**When to use:** Header total, positions table, heatmap.
**Trade-offs:** The header total can differ from the server's by sub-cent rounding. The snapshot P&L chart uses server values, so the last chart point and the header can differ slightly. That is acceptable. Do not try to reconcile them.

### Pattern 4: One refresh policy for all mutations

| Trigger | Action |
|---------|--------|
| Page load | Fetch watchlist, portfolio, history in parallel |
| Manual trade success | `setPortfolio(response.portfolio)` directly (the response already carries it); refetch history (a snapshot was just recorded) |
| Watchlist add/remove | Refetch `GET /api/watchlist` (add/remove responses carry only the ticker). Portfolio untouched |
| Chat reply with any action where `status === "ok"` | Refetch watchlist, portfolio, history. Skip when all actions failed or there are none |
| 30 s timer | Refetch history (matches the backend snapshot cadence) and portfolio |

Guard every `refresh` with a monotonically increasing request id and discard stale responses, otherwise a slow 30 s poll can overwrite a newer post-trade result.

### Pattern 5: Stateless flash via keyed remount

**What:** Render the price in a `<span key={update.timestamp} className={flashClass(update.direction)}>`. The SSE payload already supplies `direction` (`up`/`down`/`flat`). A CSS keyframe animation of 500 ms fades the background. The key change restarts the animation. No timers, no previous-value refs.
**Trade-offs:** Put `data-testid="watchlist-price-AAPL"` on the stable wrapper, not the keyed span. Playwright locators re-resolve, but a stable wrapper avoids flakiness.

### Pattern 6: Chat as a reducer-style hook with a refresh callback

**What:** `useChat(onActions)` holds `entries`, `loading`, `error`. `send(message)`: append the user entry, set loading, `await api.chat`, append the assistant entry with `actions`, call `onActions(actions)` only if any action is `ok`. On `ApiError` (502 or network), show the error inline in the panel and leave the transcript as is. Block sending while `loading`.
**Note:** The backend stores nothing on a 502, so the user message in the UI will not exist in history on reload. Keep it visible with an error marker rather than deleting it.

## Data Flow

### Request Flow (manual trade)

```
TradeBar buy click
   ↓ onTrade(ticker, qty, side)
Dashboard.trade → api.trade → POST /api/portfolio/trade
   ↓ 200 {trade, portfolio}            ↓ 400 {error}
setPortfolio(portfolio) + refresh history   TradeBar shows trade-error (ApiError.message)
   ↓
Header / PositionsTable / Heatmap re-render from revalue(portfolio, livePrices)
```

### State Management

```
SSE frame ─► priceStream ─► priceStore.applyFrame ─► (subscribers) Watchlist rows, Header,
                                                       Positions, Heatmap, MainChart
REST ─► api.ts ─► usePortfolio/useWatchlist (Dashboard) ─► props ─► panels
User input ─► Dashboard useState (selectedTicker) ─► Watchlist highlight, MainChart, TradeBar seed
```

### Key Data Flows

1. **Price tick:** `price_events` sends the full ticker map only when `cache.version` changes. The map includes held-but-unwatched tickers. Therefore watchlist rows MUST be driven by `GET /api/watchlist` membership, never by `Object.keys(prices)`. Prices fill in as frames arrive (before the first frame, show a placeholder).
2. **Watchlist add:** `POST /api/watchlist` then refetch the list. The new ticker has no price until the source includes it in a later frame. Row shows a placeholder, then fills. Disable the add button while pending (also hides the duplicate-add race from the user, though the backend fix is still needed).
3. **Chat turn:** `POST /api/chat` returns `{message, actions[]}` in one JSON response (no streaming). Each action is `{type: "trade"|"watchlist", ticker, status: "ok"|"failed", error?, ...}`. Render one `chat-action` element per action with `data-status`. Then apply the refresh policy above.
4. **Connection status:** `connecting`/`reconnecting` (yellow) until first `onopen`; `connected` (green) on open; `reconnecting` on `onerror`; `disconnected` (red) only after roughly 10 s with no successful open while retries continue. `test/tests/sse-reconnect.spec.ts` expects `reconnecting` (not `disconnected`) shortly after a drop, so do not flip to red quickly.

## E2E Contract: test IDs the UI must expose

Derived from `test/tests/*.spec.ts`. These are requirements, not preferences. Either satisfy them or change the specs deliberately.

| Area | `data-testid` | Notes |
|------|---------------|-------|
| Header | `cash-balance`, `total-value` | Text parsed with `readNumber` (strips all but digits, `.`, `-`). Do not put other numbers (such as a P&L percent) inside these elements |
| Header | `connection-status` with `data-status` = `connected` / `reconnecting` / `disconnected` | |
| Watchlist | `watchlist` (container), `watchlist-row-{T}`, `watchlist-price-{T}`, `watchlist-add-input`, `watchlist-add-button`, `watchlist-remove-{T}` | Exactly 10 `watchlist-row-*` on a fresh DB; row click selects |
| Main chart | `main-chart` with `data-ticker` | Row click sets it; `trade-ticker` input also takes the value |
| Trade bar | `trade-ticker`, `trade-quantity`, `trade-buy`, `trade-sell`, `trade-error` | `trade-error` visible on a 400 |
| Positions | `positions-table`, `position-row-{T}` | Row removed when position hits zero |
| Charts | `heatmap` (contains ticker text and an `svg rect`), `pnl-chart` (contains `svg path.recharts-curve`) | Pnl must be a Recharts `Line`/`Area` curve |
| Chat | `chat-panel` (visible on load), `chat-input`, `chat-send`, `chat-message` with `data-role`, `chat-action` with `data-status`, `chat-loading` (absent when idle) | Mock keywords are substring-based ("buy", "sell", "add") |

## Backend Hardening: where each item lands

All five are small, local changes in existing modules. None changes a route path or a success response shape, so they can be built and tested (pytest) independently of the frontend. Items 1, 4 and 5 do define the contract `useChat` depends on, so they must land before the chat UI phase.

| Item | Module | Minimal change | Frontend contract effect |
|------|--------|----------------|--------------------------|
| Chat 502 for empty or malformed LLM responses | `backend/app/chat/llm.py` | Move `response.choices[0].message.content` inside the `try` (or guard empty `choices`) so `IndexError` becomes `LLMError` | Every LLM failure is a 502 with `{error: string}` |
| 502 body must not leak upstream detail | `backend/app/chat/llm.py`, `backend/app/chat/router.py` | `logger.exception` the real error; raise `LLMError` with a fixed public message; router returns the message from the exception, which is now safe | `ChatPanel` can display `error` verbatim |
| Watchlist add race | `backend/app/db/repository.py` (`insert_watchlist_row`), `backend/app/services/watchlist.py` | Use `INSERT ... ON CONFLICT DO NOTHING` (or catch `sqlite3.IntegrityError`) and treat as already watched; optionally re-check `is_watched` after the `await source.add_ticker` | Add is idempotent; the UI never sees a 500 |
| Chat turn consistency | `backend/app/chat/service.py` | Per-action `apply_*` also catches unexpected errors (`sqlite3.Error`, with `logger.exception`) and returns `{status: "failed", error: "Internal error"}`. The chat rows are then always written with an `actions` list that matches what actually executed. Full single-transaction atomicity would need `execute_trade` to stop committing (`with conn:`), which is a larger refactor than the invariant requires | Failed actions render with `data-status="failed"` |
| Per-turn action caps | `backend/app/chat/service.py` (constant `MAX_ACTIONS_PER_TURN`, e.g. 5 per kind) | Do NOT cap via `ChatReply` schema validation: an over-long reply would become a 502 and lose the whole turn. Truncate in `handle_chat_message` and append one `failed` action per dropped item (`error: "Skipped: limit of 5 trades per turn"`) | Reuses the existing action shape. No new action type, no frontend special case |

A related change worth bundling: the chat route holds an open SQLite connection across the LLM `await` (`chat/router.py`). Not required, but the 502 edit touches the same function.

## Anti-Patterns

### Anti-Pattern 1: Prices in React Context or top-level `useState`

**What people do:** `const [prices, setPrices] = useState({})` in `Dashboard`, pass down by props or Context.
**Why it's wrong:** Every frame re-renders the entire tree, including three Recharts charts, at 2 Hz. Recharts re-animates or re-lays out each time.
**Do this instead:** External store with per-ticker selectors (Pattern 1). Pass `isAnimationActive={false}` to every Recharts series and to `Treemap`.

### Anti-Pattern 2: Driving the watchlist from SSE keys

**What people do:** `Object.values(prices).map(row)`.
**Why it's wrong:** The stream carries every tracked ticker, including positions in tickers that were removed from the watchlist. Removed tickers would reappear, and removal would not update the UI.
**Do this instead:** REST watchlist membership defines rows; the store supplies prices.

### Anti-Pattern 3: Replacing the price map on each frame

**What people do:** `setPrices(frame)`.
**Why it's wrong:** The reconnect E2E stub sends a one-ticker frame; replacing wipes every other price. Also any partial frame (for example a Massive tick that updated fewer tickers) blanks rows.
**Do this instead:** Merge frames into the existing map.

### Anti-Pattern 4: Creating `EventSource` at module load or during render

**What people do:** `const es = new EventSource(...)` at the top of a module.
**Why it's wrong:** `next build` prerenders the page in Node, where `EventSource` is undefined, so the static export fails. React StrictMode in dev also mounts effects twice, producing duplicate connections.
**Do this instead:** Open the stream in a `useEffect` in `Dashboard` and return a cleanup that closes it. Mark the `Dashboard` module `"use client"`.

### Anti-Pattern 5: Relying on `onerror` alone for reconnection

**What people do:** Trust `EventSource` auto-retry for everything.
**Why it's wrong:** Per the HTML spec, a network drop makes the browser retry (`readyState` CONNECTING), but an HTTP error status or non-`text/event-stream` content type closes it permanently (`CLOSED`) with no retry (MEDIUM confidence; from spec knowledge, not re-verified).
**Do this instead:** In `onerror`, set status `reconnecting`; if `readyState === EventSource.CLOSED`, close and recreate after a backoff (1 s, capped at 5 s). The backend already sends `retry: 1000`.

### Anti-Pattern 6: Hiding a failed chat call by retrying or deleting

**What people do:** Auto-retry on 502 or silently drop the user message.
**Why it's wrong:** PLAN.md section 9 says no retry, nothing stored, error shown inline.
**Do this instead:** Show the backend's `error` inline; leave the input usable.

## Scaling Considerations

Single user, single worker by design. Concerns that matter to the frontend:

| Concern | Now | If it grows |
|---------|-----|-------------|
| SSE payload | Full ticker map every tick (about 10 to 15 tickers) | Fine to roughly 50 tickers. The backend's missing watchlist cap (CONCERNS.md) is the only unbounded input. Cap at 50 if chat adds many |
| `GET /api/portfolio/history` | Unbounded within 7 days (about 20 k rows at one snapshot per 30 s) | Fresh DBs are small. Refetching every 30 s becomes heavy after days of uptime. First fix: client `downsample(snapshots, ~300)` before rendering. Second: add server-side bucketing or a `since` parameter. Flag as a deferred backend item |
| Render cost | 10 rows at 2 Hz | Fine with selectors and animation off |
| Browser memory | 600 points times N tickers | Negligible |

## Build Order (each step verifiable end to end)

Dependencies: scaffold and Docker first (it is the current blocker and de-risks the static-export path), then the price store (everything live depends on it), then server-state features, then charts, then chat (needs hardening). Backend hardening is independent of UI work and can run in parallel, but must finish before the chat phase.

| # | Step | Builds | Verify |
|---|------|--------|--------|
| 1 | Scaffold and serve | Next + TS + Tailwind theme + Vitest + RTL setup; `output:'export'`; static `Dashboard` stub with the Header shell; dev-only `/api` rewrite with `compress: false` so SSE is not buffered | `npm run build` produces `out/`; `docker build .` succeeds; `scripts/start_mac.sh` serves HTML at `:8000`; `GET /api/health` still works (static mount does not shadow routers) |
| 2 | Live price store and connection status | `types.ts`, `api.ts`, `priceStream.ts`, `priceStore.ts`, `history.ts`, `ConnectionDot`; start stream from Dashboard effect | Vitest on `appendFrame` (dedupe, cap, merge); `sse-reconnect.spec.ts` status transitions |
| 3 | Watchlist with live prices | `useWatchlist`, `Watchlist`, `WatchlistRow`, `FlashingPrice`, daily % vs `open_price`, add/remove | `fresh-start.spec.ts` (rows, price changes), `watchlist.spec.ts` add/remove test; Vitest for flash class from `direction` |
| 4 | Sparkline, selection, main chart | `Sparkline`, `MainChart`, `selectedTicker` in Dashboard | `watchlist.spec.ts` select test (`data-ticker`, `trade-ticker` value); sparklines visibly fill over time |
| 5 | Portfolio, header totals, trading | `usePortfolio`, `revaluePortfolio`, Header cash and total, `TradeBar`, `PositionsTable` | `trading.spec.ts` (all four tests); `fresh-start.spec.ts` $10,000 assertions; Vitest on `revaluePortfolio` |
| 6 | Charts from portfolio data | `Heatmap` (Treemap with custom `content`), `PnlChart`, `downsample`, 30 s history refresh | `portfolio-charts.spec.ts` |
| 7 | Backend hardening (can start earlier, in parallel) | The five items in the hardening table | `uv run pytest` with new tests: empty `choices` gives 502, concurrent duplicate add gives 200, mid-turn unexpected failure yields a stored row with matching `actions`, over-cap turn yields skipped actions, 502 body is the fixed string |
| 8 | Chat panel | `useChat`, `ChatPanel`, `ChatMessage`, `ChatActionItem`, collapse | `chat.spec.ts`; Vitest for loading and error states |
| 9 | Full integration | Full Docker build, `docker-compose.test.yml` Playwright run with `LLM_MOCK=true`, visual polish pass | Entire `test/` suite green against the container |

Ordering rationale: step 2 before 3 because rows and flash consume the store. Step 5 before 6 because the heatmap needs positions. Step 7 before 8 because `ChatPanel`'s error and failed-action rendering targets the hardened contract. Vitest coverage lands with each step, not at the end.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| FastAPI REST | Same-origin `fetch('/api/...')`, no CORS | Error body is always `{error: string}` for 400/404/502/503. `RequestValidationError` yields `"field: message"` text. `api.ts` should surface `error` and fall back to `HTTP <status>` |
| FastAPI SSE | `new EventSource('/api/stream/prices')` | Frame is `{TICKER: {ticker, price, previous_price, open_price, timestamp (Unix seconds), change, change_percent, direction}}`. `: keepalive` comments every 15 s are ignored by `EventSource` |
| Static serving | `STATIC_DIR` mount at `/` with `html=True`, registered after all routers | Single `index.html`; no client routes. API paths win because routers register first |
| `next dev` | Dev-only rewrite `/api/:path*` to `http://localhost:8000` | Rewrites are not allowed with `output:'export'`, so gate on `NODE_ENV` (the deleted `next.config.ts` did this). `compress: false` was set there, likely because compression buffered SSE through the dev proxy |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `priceStream` to `priceStore` | Direct function calls (`applyFrame`, `setStatus`) | Store has no knowledge of `EventSource`, so tests feed frames directly |
| `priceStore` to components | `useSyncExternalStore` selectors | Only leaves subscribe |
| `Dashboard` to panels | Props and callbacks (`onSelect`, `onTrade`, `onAdd`, `onRemove`) | One level deep; no Context needed for server state |
| `useChat` to `Dashboard` | `onActions` callback | Dashboard owns the refresh policy; chat does not import portfolio hooks |
| `TradeBar` to `selectedTicker` | Seed once per selection change; field then edits locally | Typing a ticker must not change the chart selection |

## Testing Notes

- **Vitest and Recharts:** `ResponsiveContainer` measures 0 by 0 in jsdom. Mock `ResizeObserver` in `vitest.setup.ts` or pass fixed `width`/`height` in chart tests. Assert on props or data passed, not pixels.
- **Store tests** call `priceStore.applyFrame` directly and `reset()` in `afterEach`.
- **Playwright** is the real check for the heatmap and P&L SVG (it needs real layout).

## Open Decisions for the Roadmap

1. **Chat history on reload.** No endpoint returns stored `chat_messages`, so the transcript resets on reload. PLAN.md section 8 lists no such endpoint and `chat.spec.ts` works either way (it counts before and after). Recommend: accept for v1.
2. **Watchlist cap and history downsampling** (see Scaling). Recommend deferring both to a hardening follow-up, but implement client-side `downsample` now since it is cheap.
3. **Pricing when `current_price` falls back to `avg_cost`** (CONCERNS.md: silent zero P&L when no cached price). The frontend revaluation prefers the live price, so this only shows before the first SSE frame. No UI work needed.

## Sources

- `/Users/brett/Projects/finally/.planning/codebase/ARCHITECTURE.md`, `CONCERNS.md`, `PROJECT.md`, `planning/PLAN.md` (sections 6, 8, 9, 10)
- Backend source read directly: `backend/app/chat/{router,service,llm,schemas,mock}.py`, `backend/app/services/{portfolio,watchlist}.py`, `backend/app/routes/{portfolio,watchlist,error_handlers}.py`, `backend/app/market/{stream,router,models}.py`, `backend/app/main.py`, `Dockerfile`
- E2E specs: `test/tests/*.spec.ts` (test-ID contract above)
- Reference only: deleted frontend at commit `5681c3a` (`next.config.ts`, `package.json`, `Dashboard.tsx`, `usePriceStream.ts`, `usePortfolio.ts`, `useChat.ts`). It used Next 16.4.1, React 19.3.0, Recharts ^3.10.1, Vitest 5; version validity is for the STACK researcher to confirm
- Library behavior (EventSource retry semantics, Recharts `ResponsiveContainer`/`isAnimationActive`/`Treemap content`, `useSyncExternalStore`): prior knowledge, MEDIUM confidence, not re-fetched this session

---
*Architecture research for: FinAlly frontend on existing FastAPI backend*
*Researched: 2026-10-16*
