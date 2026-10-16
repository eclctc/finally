# Phase 3: Live Watchlist & Header - Research

**Researched:** 2026-10-16
**Domain:** Browser-side live data: native `EventSource` SSE client, external price store with React 19 `useSyncExternalStore`, CSS-transition price flash, Recharts sparklines, watchlist CRUD over REST. Frontend only; the backend is complete and is not modified in this phase.
**Confidence:** HIGH (backend contract read from source and probed live; `EventSource` CLOSED vs CONNECTING proven empirically in Chromium 156 and against the WHATWG spec; flash technique proven in Chromium). MEDIUM for Firefox/Safari behavior (not tested).

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase (the user chose "Continue without context"). There are no locked decisions, discretion areas or deferred ideas from discuss-phase. Planning constraints come from REQUIREMENTS.md (LIVE-01..LIVE-08), the ROADMAP Phase 3 success criteria, PLAN.md, the Phase 1 UI contract `01-UI-SPEC.md` (status: approved, "Shared Interaction Patterns" are binding for Phases 3 to 5), and the project decisions in STATE.md (TypeScript 7, no ESLint, Recharts only, no new chart libs, chat history session-only).

### Locked Decisions
None from CONTEXT.md. Project-level locks that bind this phase: Next.js static export, Tailwind 4 `@theme static` tokens, Recharts only, TypeScript 7 with no ESLint, native `EventSource` at the relative URL `/api/stream/prices`.

### Claude's Discretion
Everything not fixed by the above (store shape, file layout, flash mechanism, hook boundaries) is open. This document makes a prescriptive recommendation for each.

### Deferred Ideas (OUT OF SCOPE)
Row selection / main chart / trade bar (TRADE-01, TRADE-02: Phase 4), positions table, heatmap, P&L chart (Phase 4), chat (Phase 5), Playwright full-suite gate (Phase 6), cap on watchlist size (DATA-V2-03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIVE-01 | One native `EventSource` to `/api/stream/prices`; frames merged per ticker, never replacing; stream out of top-level React state | Module-level price store + `useSyncExternalStore` with per-ticker subscriptions (Architecture Pattern 1, 2). Frame shape verified (Code Examples). |
| LIVE-02 | Dot green/yellow/red via `data-status`; red only when `EventSource` is CLOSED; closed stream recreated | Empirical spike table (section "EventSource Spike"): non-200, non-`text/event-stream` and 204 give `readyState` 2 (CLOSED, no auto-retry); network errors and end-of-stream give 0 (CONNECTING, auto-retry). Pattern 3 lifecycle. |
| LIVE-03 | Watchlist rows from `GET /api/watchlist`; ticker, live price, daily change % vs `open_price`; placeholder when no price | Rows from REST, never from SSE keys (SSE carries held-but-unwatched tickers). Seed store from the REST payload. |
| LIVE-04 | Flash green/red on uptick/downtick, fade ~500ms via CSS transition | Client-computed direction (frame `direction` is sticky), transition technique proven in Chromium with a minimum hold (Pattern 4). |
| LIVE-05 | Sparkline per row from capped per-ticker history filled by SSE since page load | History ring buffer in the store (cap 300), Recharts `LineChart` with fixed size (Pattern 5). |
| LIVE-06 | Add ticker; input uppercased; 400 error shown inline | `request()` already surfaces `{"error"}` text via `ApiError`; do not cap input length client-side. |
| LIVE-07 | Remove a ticker | `DELETE /api/watchlist/{ticker}` returns JSON `{ticker}`; 404 if not watched; refetch afterwards. |
| LIVE-08 | Header shows live total (cash + positions at live prices) and cash | `GET /api/portfolio` once for cash and positions; total recomputed from the store (Pattern 6). |
</phase_requirements>

## Summary

Phase 3 is a pure frontend phase on a finished backend. The backend contract is simple and was verified three ways (source read, live `curl` against the running container on :8000, and the E2E specs): `GET /api/stream/prices` emits `retry: 1000`, then one `data:` line holding a JSON object keyed by ticker whenever the price-cache version changes, plus a `: keepalive` comment every 15 s. The object holds the union of watchlist and held tickers, not just the watchlist, and it is resent in full every time, so every entry (including tickers that did not tick) carries its last tick's `direction`. That single fact drives most design decisions: watchlist rows must come from `GET /api/watchlist`, and flash direction must be computed on the client by comparing the new price with the stored one.

The research flag (EventSource CLOSED path) is resolved by evidence, not inference. In Chromium 156 I ran ten scenarios through Playwright route interception. Any HTTP status other than 200 (500, 404, 204) or a non-`text/event-stream` content type fires `error` with `readyState === 2` (CLOSED) and the browser never retries. Every network-level failure (connection refused, reset, generic abort) and every clean end-of-stream fires `error` with `readyState === 0` (CONNECTING) and the browser retries on the `retry:` interval. This matches the WHATWG HTML text exactly. The `sse-reconnect.spec.ts` scenario (200 + one event + end, then `connectionrefused` on retries, then pass-through) only ever produces CONNECTING, so it asserts `reconnecting` then `connected` and never exercises CLOSED. The CLOSED path is a real-world case (backend 5xx, proxy HTML page) that the client must handle by recreating the `EventSource` itself after a short delay.

No new npm packages are needed. Everything required (React 19.3.1, Recharts 3.10.1, Tailwind 4.3.3, Vitest 5.0.5, RTL) is already pinned in `frontend/package.json`. The baseline is green (35 Vitest tests, `tsc --noEmit` clean).

**Primary recommendation:** Build one module-level price store (`priceStore.ts`: per-ticker immutable entries, capped history, status) fed by one `EventSource` manager (`priceStream.ts`) that maps `readyState` straight to `data-status` and recreates the stream after 1 s only when `readyState === CLOSED`. Rows subscribe per ticker with `useSyncExternalStore`; compute flash direction client-side; get row membership only from `GET /api/watchlist`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Price generation and session open | API / Backend (price cache) | — | `PriceCache.update` sets `open_price` once per backend lifetime; the client only reads. |
| Streaming prices | API / Backend (SSE route) | Browser (EventSource client) | One-way push; the browser owns reconnect and, for CLOSED, recreation. |
| Watchlist membership, ticker validation | API / Backend | Database (`watchlist` table) | `^[A-Z]{1,5}$` and "can be priced" rules live in `services/watchlist.py`; the client just shows the 400 text. |
| Price store, merge, history, flash direction | Browser / Client | — | Pure client state; backend has no history endpoint (sparklines are "since page load"). |
| Daily change % | Browser / Client | — | Computed as `(price - open_price) / open_price` from SSE fields; `change_percent` is per tick and must not be used. |
| Live total portfolio value | Browser / Client | API / Backend (`/api/portfolio` for cash and quantities) | Backend value is a snapshot at request time; the client revalues positions at live prices. |
| Connection status | Browser / Client | — | Derived only from `EventSource` events and `readyState`. |
| Static UI delivery | CDN / Static (Next export served by FastAPI) | — | No SSR; client components are still prerendered once at build, so hooks must be prerender safe. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | `useSyncExternalStore` for the external price store | Already pinned in `frontend/package.json`. [VERIFIED: frontend/package.json] |
| recharts | 3.10.1 | Sparklines (`LineChart`/`Line`/`YAxis`) | PLAN.md mandates Recharts only; installed version confirmed in `node_modules/recharts/package.json`. [VERIFIED: frontend/package.json, node_modules/recharts/package.json] |
| tailwindcss | 4.3.3 | Flash classes via `@theme static` tokens (`bg-up/25`, `bg-down/25`) | Tokens `--color-up`, `--color-down`, `--color-accent` already defined in `globals.css`. [VERIFIED: frontend/src/app/globals.css] |
| vitest + @testing-library/react | 5.0.5 / 16.3.3 | Unit and component tests | Existing harness, `FakeEventSource` double in `vitest.setup.ts`. [VERIFIED: frontend/package.json, vitest.setup.ts] |

### Supporting
None. Native `EventSource`, `fetch` (via existing `request<T>()` in `src/lib/api.ts`), and the existing `format.ts` formatters cover everything.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Module singleton store | React context provider holding a store instance | Context isolates tests but adds a provider and a file. A singleton plus `reset()` in the test setup is simpler and matches "stream out of top-level React state". |
| `useSyncExternalStore` | zustand / jotai | New dependency for ~60 lines of store code; project constraint is a small dependency surface. |
| CSS transition flash | `Element.animate()` (Web Animations) | No timers and no state, but jsdom has no `animate`, and LIVE-04 says "CSS transition". Not chosen. |
| `@microsoft/fetch-event-source` | native `EventSource` | Would give status-code handling but violates "native `EventSource`" (PLAN.md section 10). Not chosen. |

**Installation:** none. `npm ci` in `frontend/` already provides everything.

**Version verification:** `npm --prefix frontend test` ran green (6 files, 35 tests) and `npm --prefix frontend run typecheck` exited clean in this session; installed Recharts is 3.10.1. No new package is added, so there is nothing further to verify against a registry.

## Package Legitimacy Audit

No external packages are installed by this phase. The audit table is empty by design.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

If a plan adds a dependency, it must go through the package legitimacy gate first. The recommendation here is not to.

## Architecture Patterns

### System Architecture Diagram

```
 Browser (static Next export, one page)
 ──────────────────────────────────────────────────────────────────────────
  Dashboard (useEffect, mount) ──► connectPriceStream()        [priceStream.ts]
                                      │ new EventSource("/api/stream/prices")
                                      │   onopen    ─► store.setStatus("connected")
                                      │   onmessage ─► store.mergeFrame(JSON.parse(data))
                                      │   onerror   ─► store.setStatus(fromReadyState)
                                      │        └─ readyState == CLOSED ─► setTimeout(recreate, 1000)
                                      ▼
                              ┌────────────────────┐   per-ticker listeners
                              │  priceStore.ts     │──────────────┐
                              │  prices: Map       │              │
                              │  history: Map<=300 │   status     │
                              │  status            │──────┐       │
                              └────────────────────┘      │       │
                                      ▲ seed (price != null)│       │
 GET /api/watchlist ─► useWatchlist ──┘                    ▼       ▼
   rows = tickers (REST order)                    ConnectionDot  WatchlistRow(ticker)
   add:    POST /api/watchlist   ─► refetch        (Header)       ├ FlashingPrice  (watchlist-price-T)
   remove: DELETE /api/watchlist/T ─► refetch                    ├ daily change % = (price-open)/open
                                                                  ├ Sparkline (history, up/down colour)
 GET /api/portfolio ─► usePortfolio ─► Header                     └ remove button (watchlist-remove-T)
   cash, positions ──► liveTotal = cash + Σ qty × storePrice(T)  ──► total-value, cash-balance

 FastAPI (unchanged)
   cache.version changes ─► SSE frame {TICKER: {ticker, price, previous_price, open_price,
                            timestamp, change, change_percent, direction}, ...}  (watchlist ∪ held)
```

### Recommended Project Structure
```
frontend/src/
├── lib/
│   ├── priceStore.ts        # pure store: entries, history, status, subscribe, mergeFrame, reset
│   ├── priceStream.ts       # EventSource lifecycle: connect(), statusFromReadyState(), recreate on CLOSED
│   ├── usePrice.ts          # useTickerPrice(ticker), useTickerHistory(ticker), useConnectionStatus(), usePriceVersion()
│   ├── portfolioValue.ts    # liveTotalValue(portfolio, getPrice)  (pure, unit tested)
│   ├── api.ts               # existing request<T>() (reuse; add small typed wrappers if wanted)
│   └── format.ts            # existing (fix WR-01 here)
├── hooks or lib/useWatchlist.ts   # fetch rows, add(), remove(), error state
├── components/
│   ├── Watchlist.tsx        # Panel + add form + list (replaces the empty Watchlist panel in Dashboard)
│   ├── WatchlistRow.tsx     # one row; memoized; subscribes to its own ticker only
│   ├── FlashingPrice.tsx    # the watchlist-price-T element + flash state
│   ├── Sparkline.tsx        # Recharts LineChart, fixed 64x20
│   ├── ConnectionDot.tsx    # data-status, colour, accessible name
│   └── Header.tsx           # uses ConnectionDot + live total
└── test/fixtures.ts         # frame and portfolio builders for tests
```
Follows the project convention: short modules, named functions, `@/` alias imports, ids only via `testIds`.

### Pattern 1: External price store, merge never replaces (LIVE-01)
**What:** A module singleton holds `Map<ticker, PriceEntry>` and `Map<ticker, number[]>` history. `mergeFrame(frame)` visits only the tickers in the frame. An entry is "new" only if its `timestamp` differs from the stored one (the backend resends the whole map on any change, so most entries in a frame are repeats). A new entry replaces that ticker's immutable object, appends to its capped history, and notifies only that ticker's listeners. Unrelated rows are untouched, which satisfies success criterion 3.
**When to use:** All price reads (rows, header, later the main chart and heatmap).
**Rules from the React docs** [CITED: react.dev/reference/react/useSyncExternalStore]: `getSnapshot` must return the same value while the store is unchanged (compare by `Object.is`), so return the stored immutable entry itself; `subscribe` must be a stable function (declare it outside the component or `useCallback`); `getServerSnapshot` is required for components rendered on the server, otherwise "rendering the component on the server will throw an error". Next static export prerenders client components at build time, so pass a `getServerSnapshot` that returns the empty value.
**Never compare timestamps for ordering** (see `.planning/research/PITFALLS.md` Pitfall 2): the E2E fake frame has `"timestamp": 0`, then the real stream arrives. Use only inequality ("is this a different tick than the one I hold?").

### Pattern 2: Rows come from REST, prices from the store (LIVE-03)
**What:** `useWatchlist` fetches `GET /api/watchlist` (`{"tickers": [...]}`), renders one row per entry in the returned order, and seeds the store from the same payload (each entry already has the same fields as an SSE entry; unpriced entries have `null` price fields and must be skipped). After add or remove, refetch the list.
**Why:** The SSE map is the union of watchlist and held tickers, in cache order (observed order was AAPL, AMZN, GOOGL, JPM, ... not insertion order). Deriving rows from SSE keys would show held-but-unwatched tickers and would keep a removed ticker alive. REST order is `ORDER BY added_at, rowid`, i.e. "in the order they were added". [VERIFIED: backend/app/db/repository.py:24-29]
**Placeholder:** A row whose store entry is missing renders `--` in `watchlist-price-T` and `--` for change %.

### Pattern 3: Connection manager with explicit CLOSED recreation (LIVE-02)
**What:** One function `connectPriceStream()` creates the `EventSource`, assigns `onopen`/`onmessage`/`onerror` (the test double supports property handlers only), maps `readyState` to status, and when `readyState === EventSource.CLOSED` schedules a fresh `new EventSource(...)` after `RECREATE_DELAY_MS = 1000`. It returns a cleanup that clears the timer and closes the current source. Call it from one `useEffect` in `Dashboard` (`useEffect(() => connectPriceStream(), [])`).
**Status mapping** (`readyState` 0/1/2): OPEN -> `connected`, CONNECTING -> `reconnecting`, CLOSED -> `disconnected`. Initial status before the first `open` is `reconnecting` (yellow), because the stream is CONNECTING. Set `connected` on `onopen`, not on the first message.
**Why recreation is required:** per the spec, "Once the user agent has failed the connection, it does _not_ attempt to reconnect." [CITED: html.spec.whatwg.org/multipage/server-sent-events.html]
**StrictMode:** Next dev double-runs effects. Cleanup must close the source and clear the pending recreate timer, or two live streams result.
**Do not** append a query string or use an absolute URL; the spec intercepts the glob `**/api/stream/prices` (PITFALLS.md Pitfall 3).

### Pattern 4: Flash via transition, direction computed client-side (LIVE-04)
**What:** The store computes `flash: "up" | "down" | null` when merging: `up` if the new price is greater than the stored price, `down` if less, `null` if equal or if there was no previous price (first value, including the first value after seeding). `FlashingPrice` renders the `watchlist-price-T` element with a class from a fixed lookup map. On each new entry with a non-null `flash`, an effect sets the flash state, then clears it after a short hold; the cleared state carries `transition-colors duration-500 ease-out` and `bg-transparent`, the flashing state carries `transition-none` and `bg-up/25` / `bg-down/25`.
**Proven in Chromium 156 (spike):** with the flash class applied `transition: none` and then swapped to `background: transparent; transition: background-color 500ms ease-out`, the computed background was `rgba(47, 191, 113, 0.25)` at t=0, `0.173` at ~100 ms, `0.08` at ~250 ms, `0.016` at ~400 ms, and `rgba(0, 0, 0, 0)` at ~600 ms. If the class is swapped back in the same task (hold 0 ms), nothing is ever painted (all five samples were transparent). A hold of 16, 50 and 100 ms all worked. Use a hold of about 50 ms (`FLASH_HOLD_MS`).
**Details:** Use full literal class strings in a lookup (`{ up: "bg-up/25 transition-none", down: "bg-down/25 transition-none" }`); Tailwind cannot detect `bg-${dir}/25`. Respect `prefers-reduced-motion` via `motion-reduce:transition-none motion-reduce:bg-transparent` and show the change by text color instead (UI-SPEC "Price flash"). One timeout per row, cleared in the effect cleanup.
**Why not the frame's `direction`:** it is `up` for every ticker whose last tick was up, on every resend. [VERIFIED: backend/app/market/stream.py:24-25 resends `cache.all()` in full; models.py `to_dict` includes `direction`]

### Pattern 5: Sparkline (LIVE-05)
**What:** `<LineChart width={64} height={20} data={points} accessibilityLayer={false}>` with `<YAxis hide domain={["dataMin","dataMax"]} />` and `<Line dataKey="price" dot={false} isAnimationActive={false} stroke=... />`. Stroke is `var(--color-up)` when the last point is at or above the first, else `var(--color-down)` ("net direction since load", UI-SPEC). Fixed `width`/`height` avoids `ResponsiveContainer` (which needs `ResizeObserver`; the jsdom setup stubs it at 800x400).
**Recharts 3 note:** the keyboard accessibility layer is active unless `accessibilityLayer === false` [VERIFIED: node_modules/recharts/es6/state/keyboardEventsMiddleware.js:35 `currentState.rootProps.accessibilityLayer !== false`]. Ten sparklines would add ten focus stops; pass `accessibilityLayer={false}`.
**History cap:** `HISTORY_LIMIT = 300` points per ticker (~2.5 min at the 500 ms simulator tick). Produce a new array per append (`[...old.slice(-(HISTORY_LIMIT-1)), price]`) so the snapshot is immutable. Phase 4's main chart should read the same buffer, so record history for every ticker in a frame (including held ones), not only watched.
**Cadence:** history appends once per new tick (timestamp changed), not once per frame, so the Massive poller (15 s) does not fabricate points.

### Pattern 6: Live header total (LIVE-08)
**What:** `usePortfolio` calls `GET /api/portfolio` once on mount (fields below). Header computes `liveTotal = cash_balance + Σ quantity × (store price for ticker ?? position.current_price)`; with no positions this equals cash, so `fresh-start.spec` sees 10000 in both `cash-balance` and `total-value`. Header re-renders on each store version change via one `useSyncExternalStore` on a global version counter (cheap; one component). Held tickers are always in the stream because the backend tracks `watchlist ∪ held`. [VERIFIED: backend/app/services/watchlist.py `tracked_tickers`]
**Phase 4 hand-off:** TRADE-05 needs a `refresh()` on the same hook; expose it now (one line), do not wire anything else.

### Anti-Patterns to Avoid
- **Whole map in `useState`/Context:** re-renders everything at 2 Hz (PITFALLS.md Pitfall 4). This is also forbidden by LIVE-01. The old frontend at `5681c3a` did exactly this (`setPrices(frame)` in `usePriceStream`); do not copy it.
- **Rows from SSE keys:** shows held-but-unwatched tickers (success criterion 3).
- **Flash from frame `direction` or `change_percent`:** sticky or per-tick values cause flashes on non-changes.
- **Mapping every `onerror` to `disconnected`:** breaks `sse-reconnect.spec.ts` (the dot must stay `reconnecting` while attempts fail).
- **Watchdog "no message for N seconds -> disconnected":** the server is silent when the cache is unchanged and keepalives are SSE comments that `EventSource` never surfaces. Derive status from events and `readyState` only.
- **`maxLength={5}` on the add input:** the old frontend did this; it prevents the user from ever triggering the 400 that LIVE-06 requires to show inline.
- **Dynamic Tailwind class strings:** not generated at build.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reconnect with backoff for network drops | A custom retry/timer loop around `fetch` streams | Native `EventSource` auto-reconnect (honors `retry: 1000`) | Spec-defined; verified in Chromium to retry every `retry` ms and keep `readyState` 0. |
| Subscribing components to non-React state | Custom `useEffect` + `useState` mirror | `useSyncExternalStore` | Tear-free, handles StrictMode and concurrent rendering. |
| Number/percent/currency text | Local `toFixed` formatting | Existing `formatPrice`, `formatPercent`, `formatCurrency` in `src/lib/format.ts` | The E2E `parseNumber` rule depends on bare numbers; formatters already enforce it. |
| Error text extraction from failed REST calls | New fetch wrapper | Existing `request<T>()` / `ApiError` in `src/lib/api.ts` | Already maps `{"error": "..."}` to `ApiError.message` (tested). |
| Test EventSource | A second fake | Existing `FakeEventSource` in `vitest.setup.ts` (`open()`, `emit()`, `fail(closed?)`, `close()`) | Already installed on `globalThis.EventSource`. |
| Sparkline drawing | Hand-made SVG polyline | Recharts `LineChart` (PLAN.md: Recharts for sparklines) | Project constraint. |

**Key insight:** the only genuinely custom logic is the ~60-line store and the ~25-line connection manager. Everything else is existing project code or the platform.

## Common Pitfalls

### Pitfall 1: Sticky `direction` in resent frames
**What goes wrong:** Every SSE frame carries all tickers. A ticker that did not move in this frame still has `"direction": "up"` from its last tick. Flashing on `direction` flashes every row on every frame.
**Why it happens:** `price_events` yields `{ticker: update.to_dict() for ticker, update in cache.all().items()}` whenever `cache.version` changes. [VERIFIED: backend/app/market/stream.py:24-25]
**How to avoid:** Store compares new price to stored price; skip entirely if `timestamp` is unchanged.
**Warning signs:** All 10 prices flash together; flash on reconnect with no price change.

### Pitfall 2: `getServerSnapshot` omitted
**What goes wrong:** `next build` (static export prerender) throws when a component using `useSyncExternalStore` renders on the server without a server snapshot.
**How to avoid:** Pass `() => undefined` (or the empty snapshot) as the third argument in every hook. Create the `EventSource` only inside `useEffect`, never during render.
**Warning signs:** `npm --prefix frontend run build` fails with a missing `getServerSnapshot` error even though Vitest passes. Always run the build as a phase gate.

### Pitfall 3: Status flicker or stuck status around reconnect
**What goes wrong:** In the stub scenario Chromium delivers `open`, `message`, then `error` (readyState 0) within the same millisecond. Setting `connected` from the message, or deriving status from a "last message time", leaves a wrong status.
**How to avoid:** `open` -> connected; `error` -> `statusFromReadyState(source.readyState)`; nothing else touches status.

### Pitfall 4: Orphan streams and timers
**What goes wrong:** StrictMode double mount, or unmount while a recreate timer is pending, leaves two live connections or a connection after unmount.
**How to avoid:** Cleanup function closes the current source and clears the timer; recreation reassigns the "current source" variable that the cleanup closes.

### Pitfall 5: Flash class swapped in the same task
**What goes wrong:** Setting then clearing the flash without a hold produces no visible flash (spike: 0 ms hold gave all-transparent samples).
**How to avoid:** `FLASH_HOLD_MS` of about 50 and verify visually in the browser (Manual UAT).

### Pitfall 6: Existing Header tests stub a portfolio without `positions`
**What goes wrong:** `Header.test.tsx` stubs `{cash_balance, total_value}` only. Summing `portfolio.positions` throws `undefined is not iterable`.
**How to avoid:** Update the stubs to the real shape (`positions: []`), or have the live-total helper accept the typed `Portfolio` and update every stub. Also replace the test "starts disconnected because Phase 1 opens no price stream"; it is now false by design.

### Pitfall 7: Singleton store leaks between tests
**What goes wrong:** A module-level store keeps prices and history across tests; the setup only resets `FakeEventSource.instances`.
**How to avoid:** Add `priceStore.reset()` to the global `afterEach` in `vitest.setup.ts` (or call it in each test file's `beforeEach`).

### Pitfall 8: Fake timers with RTL
**What goes wrong:** `waitFor` and `findBy*` poll with timers; under `vi.useFakeTimers()` they hang.
**How to avoid:** For flash and recreate-delay tests, use `vi.useFakeTimers()` plus `act(() => vi.advanceTimersByTime(...))` and synchronous assertions; keep async fetch-driven tests on real timers.

### Pitfall 9: Wrong baseline for daily change
**What goes wrong:** `change_percent` is vs the previous tick (noise around zero).
**How to avoid:** `dailyChange = (price - open_price) / open_price` as a fraction into `formatPercent`. [VERIFIED: format.ts "Input is a fraction: 0.0123 means 1.23%"; UI-SPEC "Daily change % is computed from `open_price`, never from `change_percent`"]

### Pitfall 10: Path interpolation and re-add edge cases
**What goes wrong:** `DELETE /api/watchlist/${ticker}` with a raw string; removing an already-removed ticker returns 404 and the UI shows a stale row.
**How to avoid:** `encodeURIComponent(ticker)`; always refetch the list in a `finally`-style path so the UI converges even on 404. On remove, also clear that ticker's store entry and history so a re-add does not draw a sparkline across a gap.

### Pitfall 11: Verifying against the stale container
**What goes wrong:** The container `finally-p1` on :8000 is the Phase 1 image (backend before Phase 2 hardening). `docker ps` shows it bound to 8000. Dev against it can disagree with the Phase 2 backend.
**How to avoid:** For manual and E2E checks, run the Phase 2 backend (`cd backend && uv run uvicorn app.main:app --port 8000` after stopping `finally-p1`) or rebuild the image under a new name (`finally-phase3`) and use a fresh volume.

## Code Examples

Backend frame shape (verified by reading `to_dict` and by `curl` against :8000 this session). Each ticker key maps to:

```json
{"ticker": "AAPL", "price": 214.61, "previous_price": 214.47, "open_price": 190.0,
 "timestamp": 1792174878.9990396, "change": 0.14, "change_percent": 0.0653, "direction": "up"}
```
Source: `PriceUpdate.to_dict` returns `asdict(self) | {"change": ..., "change_percent": ..., "direction": ...}` over the fields `ticker`, `price`, `previous_price`, `open_price`, `timestamp`. [VERIFIED: backend/app/market/models.py:5-38] `timestamp` is Unix seconds. The stream path is the router prefix `/api/stream` plus `@router.get("/prices")`, so `/api/stream/prices`. [VERIFIED: backend/app/market/router.py:6-12] `RETRY_MILLISECONDS = 1000`, `KEEPALIVE_SECONDS = 15.0`, `STREAM_INTERVAL_SECONDS = 0.5`. [VERIFIED: backend/app/market/stream.py:7-9]

`GET /api/watchlist` returns `{"tickers": [ <entry>, ... ]}`; an unpriced entry is `{"ticker": T}` plus `price`, `previous_price`, `open_price`, `change`, `change_percent`, `direction`, `timestamp` all `null` (`PRICE_FIELDS`, `dict.fromkeys`). [VERIFIED: backend/app/services/watchlist.py:8,49-53 and routes/watchlist.py:15-18]

`GET /api/portfolio` returns `cash_balance`, `total_value`, `positions_value`, `unrealized_pnl`, `positions`; each position has `ticker`, `quantity`, `avg_cost`, `current_price`, `market_value`, `unrealized_pnl`, `pnl_percent`. [VERIFIED: backend/app/services/portfolio.py:75-103; live curl returned `{"cash_balance":10000.0,"total_value":10000.0,"positions_value":0,"unrealized_pnl":0,"positions":[]}`]

Error shapes: invalid add -> 400 `{"error":"Invalid ticker: 'toolongx'"}`; remove of an unwatched ticker -> 404 `{"error":"ZZZ is not on the watchlist"}`. [VERIFIED: live curl this session; services/watchlist.py]

### Store (sketch; names are suggestions)
```typescript
// src/lib/priceStore.ts
export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";
export const HISTORY_LIMIT = 300;

export interface PriceEntry {
  price: number;
  openPrice: number;
  timestamp: number;
  flash: "up" | "down" | null;   // computed here, not taken from the frame
}

export interface FrameEntry { ticker: string; price: number | null; open_price: number | null; timestamp: number | null }
type Frame = Record<string, FrameEntry>;

const entries = new Map<string, PriceEntry>();
const histories = new Map<string, number[]>();
const listeners = new Map<string, Set<() => void>>();   // per ticker
let status: ConnectionStatus = "reconnecting";
let version = 0;

export function mergeFrame(frame: Frame): void {
  for (const [ticker, next] of Object.entries(frame)) {
    if (next.price === null) continue;                       // unpriced REST entry
    const current = entries.get(ticker);
    if (current?.timestamp === next.timestamp) continue;     // repeat in a full-map frame
    const flash = current === undefined || next.price === current.price ? null
      : next.price > current.price ? "up" : "down";
    entries.set(ticker, { price: next.price, openPrice: next.open_price!, timestamp: next.timestamp!, flash });
    histories.set(ticker, [...(histories.get(ticker) ?? []).slice(-(HISTORY_LIMIT - 1)), next.price]);
    notify(ticker);
  }
  version += 1; notifyVersion();
}
```
Note: seeding from `GET /api/watchlist` calls the same `mergeFrame` with the watchlist entries keyed by ticker; entries with `price === null` are skipped, so a placeholder row stays `--`.

### Hook with server snapshot
```typescript
// src/lib/usePrice.ts
import { useSyncExternalStore } from "react";
export function useTickerPrice(ticker: string): PriceEntry | undefined {
  return useSyncExternalStore(
    (callback) => subscribeTicker(ticker, callback),   // see note below on stability
    () => getEntry(ticker),
    () => undefined,
  );
}
```
Note: `subscribe` is a new function when `ticker` changes; that is fine (re-subscribe on ticker change) but wrap in `useCallback([ticker])` so it does not resubscribe on every render. [CITED: react.dev, "React will resubscribe to your store if you pass a different `subscribe` function between re-renders"]

### Connection manager
```typescript
// src/lib/priceStream.ts
const STREAM_URL = "/api/stream/prices";   // exact; the E2E route glob is **/api/stream/prices
const RECREATE_DELAY_MS = 1000;            // matches the server's retry: 1000

export function statusFromReadyState(readyState: number): ConnectionStatus {
  if (readyState === EventSource.OPEN) return "connected";
  return readyState === EventSource.CLOSED ? "disconnected" : "reconnecting";
}

export function connectPriceStream(): () => void {
  let source: EventSource | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function open() {
    source = new EventSource(STREAM_URL);
    source.onopen = () => setStatus("connected");
    source.onmessage = (event) => mergeFrame(JSON.parse(event.data));
    source.onerror = () => {
      setStatus(statusFromReadyState(source!.readyState));
      if (source!.readyState === EventSource.CLOSED) timer = setTimeout(open, RECREATE_DELAY_MS);
    };
  }
  open();
  return () => { clearTimeout(timer); source?.close(); };
}
```
The `onerror` double in `vitest.setup.ts` calls `this.onerror?.()` with no event argument, so the handler must not read its argument. [VERIFIED: frontend/vitest.setup.ts `fail(closed = false)` sets `readyState` then `this.onerror?.()`]

### Flash element
```tsx
// src/components/FlashingPrice.tsx  (testid element holds only the bare number)
const FLASH_CLASS = { up: "bg-up/25 transition-none", down: "bg-down/25 transition-none" } as const;
const IDLE_CLASS = "bg-transparent transition-colors duration-500 ease-out motion-reduce:transition-none";
const FLASH_HOLD_MS = 50;
// effect: if (entry?.flash) { setFlash(entry.flash); const t = setTimeout(() => setFlash(null), FLASH_HOLD_MS); return () => clearTimeout(t); }
```

## EventSource Spike (research flag resolution)

**Method:** a local HTTP server served a blank page; Playwright (`test/node_modules`, Chromium 156.0.8078.4) intercepted `**/stream` with `route.fulfill`/`route.abort` and recorded `onopen/onmessage/onerror` plus `readyState` at each event. The spike scripts live in the scratchpad (not committed). Scenario G reproduces the exact mechanism of `test/tests/sse-reconnect.spec.ts`.

| # | Server behavior | Events observed (`readyState` at each) | Final state | Browser retries? |
|---|-----------------|----------------------------------------|-------------|------------------|
| A | 200 `text/event-stream`, one event, body ends (`retry: 200`) | open(1), message(1), error(0), repeated every ~205 ms | CONNECTING | Yes, on the `retry` interval |
| B | 500 `application/json` | error(2) once | CLOSED | No |
| C | 200 `text/html` | error(2) once | CLOSED | No |
| D | `abort("connectionrefused")` on every attempt | error(0) | CONNECTING | Yes |
| E | 204 | error(2) once | CLOSED | No |
| F | 404 | error(2) once | CLOSED | No |
| G | Spec scenario: first = 200 + one event + end; then `connectionrefused` each retry | open(1), message(1), error(0), then error(0) every ~205 ms | CONNECTING (stays) | Yes |
| H | First = 200 + one event; reconnect answered with 500 | open, message, error(0), then error(2) | CLOSED | No |
| I | `abort("failed")` | error(0) | CONNECTING | Yes |
| J | `abort("connectionreset")` | error(0) | CONNECTING | Yes |

**Conclusions (empirical, Chromium only):**
1. CLOSED (2) occurs when the response is received but is not `200` with `Content-Type: text/event-stream` (including 204), on the initial request or on any reconnect attempt. The browser then never retries.
2. CONNECTING (0) occurs for all network-level failures and for a normal end-of-stream; the browser retries after the reconnection time (the `retry:` value).
3. The `sse-reconnect.spec.ts` flow (G) never reaches CLOSED. It asserts: price shows `1` -> dot `data-status="reconnecting"` (persisting while attempts are refused) -> after pass-through the dot is `connected` and the price exceeds 100 and then changes. The mapping `error + readyState 0 -> reconnecting`, `open -> connected` satisfies it exactly.
4. CLOSED matters in real use: backend returns 5xx (restart in progress), a proxy returns an HTML error page, or `next dev` cannot reach :8000. The client must call `new EventSource(...)` again; there is no browser-side recovery.

**Spec text (WHATWG HTML, SSE section) backing the evidence** [CITED: html.spec.whatwg.org/multipage/server-sent-events.html]:
- "If res is an aborted network error, then fail the connection." / "Otherwise, if res is a network error, then reestablish the connection, unless the user agent knows that to be futile, in which case the user agent may fail the connection." / "Otherwise, if res's status is not 200, or if res's `Content-Type` is not `text/event-stream`, then fail the connection." / "if res is not a network error, then reestablish the connection" (end of body).
- Fail the connection: "sets the `readyState` attribute to `CLOSED` and fires an event named `error`"; "Once the user agent has failed the connection, it does _not_ attempt to reconnect."
- `close()`: "must abort any instances of the fetch algorithm started for this `EventSource` object, and must set the `readyState` attribute to `CLOSED`."
- The spec leaves the "unless the user agent knows that to be futile" clause to the browser; Firefox and Safari were not tested here, so the recreate-on-CLOSED logic is also the safety net if another engine fails a network error.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `setPrices(frame)` in a top-level hook (old frontend at `5681c3a`) | External store + `useSyncExternalStore`, per-ticker subscribe | React 18+ | No 2 Hz whole-tree render; satisfies LIVE-01. |
| `@keyframes` flash restarted by `key` remount | Class swap with `transition-colors` | This project's UI-SPEC | Matches LIVE-04 "CSS transition"; needs the hold to paint. |
| Recharts 2 default no keyboard layer | Recharts 3 `accessibilityLayer` on by default | Recharts 3 | Disable on decorative sparklines. |

**Deprecated/outdated:**
- `maxLength={5}` and `uppercase` CSS only on the old add input: do not copy; uppercase the value in JS so the posted body is uppercase (backend also normalizes, but UI-SPEC says "Ticker inputs uppercase as the user types").

## Phase 1 findings: which does Phase 3 naturally touch

| Finding | Source | Phase 3 touch? | Recommendation |
|---------|--------|----------------|----------------|
| WR-02: dot `aria-label` on a generic `span` | 01-REVIEW.md, 01-UI-REVIEW.md fix 3 | Yes: Phase 3 rewrites the dot | Give the `connection-status` element `role="status"` and a visually hidden text node with the state name (also keep `title`). The testid element may contain text; E2E reads only `data-status`. Add a page `h1` (make the wordmark the `h1`). |
| `color-scheme: dark` missing | 01-UI-REVIEW.md fix 2, IN-04 | Yes: first phase with a text input and scrollable list | Add `color-scheme: dark;` to the `html` rule in `globals.css` (UI-SPEC "Global" says to do so in the first phase that renders form controls or scrollable regions). |
| WR-01: `cents()` rounding differs from Intl | 01-REVIEW.md | Yes: header live total and watchlist prices go through `formatCurrency`/`formatPrice` | Fix as suggested (drop the pre-round, only suppress negative zero) and update the two `format.test.ts` cases that lock the old behavior. Small, and a client-computed total will otherwise differ from the backend by a cent. |
| WR-03: testid parity test can pass vacuously | 01-REVIEW.md | Marginal (no new ids; `watchlist-*` ids first get used) | Optional 1-line fix: reject empty prefixes in `isCovered`. Fold in if a plan touches `testIds.test.ts`; otherwise leave. |
| Chart/Heatmap collapse to ~68px at 1024px | 01-UI-REVIEW.md fix 1 | Layout decision affects the watchlist column width | Decide in `/gsd-ui-phase 3`. The Phase 3 row needs roughly 320px (ticker 56 + price 72 + change 64 + sparkline 64 + remove 24 + gaps/padding); the column is `minmax(300px,340px)`, which fits only at 340. Do not narrow the watchlist; raise `min-w` or narrow chat instead. |
| IN-01: `request` throws `SyntaxError` on a 2xx with an empty body | 01-REVIEW.md | No: `DELETE /api/watchlist/{ticker}` returns JSON `{"ticker": ...}` | Verified by `routes/watchlist.py:remove_ticker` returning `{"ticker": normalize_ticker(ticker)}`; nothing to add. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `next dev` returns a non-200 response (so `readyState` 2) when the backend on :8000 is down, rather than hanging or resetting the socket | Pattern 3 (dev behavior only) | Dev-only: the dot would show `reconnecting` instead of `disconnected`; both paths recover. Not testable without stopping the backend. |
| A2 | A ~50 ms flash hold paints in Firefox and Safari as in Chromium | Pattern 4 | Flash may be invisible in other engines; raise hold to ~100 ms (also worked in Chromium). |
| A3 | Initial dot state before the first `open` should be `reconnecting` (yellow) rather than `disconnected` (red) | Pattern 3 | Cosmetic; `fresh-start.spec` only asserts `connected` eventually. UI-SPEC maps yellow to "reconnecting"; confirm in `/gsd-ui-phase 3`. |
| A4 | Recharts 3.10.1 `LineChart` renders with fixed numeric `width`/`height` and no `ResponsiveContainer` (old frontend did this; `BaseChartProps` types accept `number | Percent`) | Pattern 5 | Type-checked in the first plan's `tsc` run; fallback is `ResponsiveContainer` inside a fixed 64x20 box (jsdom `ResizeObserver` stub already gives 800x400). |
| A5 | History cap of 300 and `RECREATE_DELAY_MS` of 1000 are good defaults | Patterns 3, 5 | Tuning only. |
| A6 | A watchlist-load failure needs visible copy (no copy exists for it in the UI-SPEC reserved list) | Open Questions | If omitted, a failed `GET /api/watchlist` leaves an empty, unexplained panel. |

## Open Questions

1. **Layout at the 1024px minimum width**
   - What we know: Chart/Heatmap cells collapse to ~68px at 1024 (01-UI-REVIEW.md); the watchlist column is `minmax(300px,340px)` and the row needs about 320px.
   - What's unclear: raise `min-w-[1024px]`, or narrow the chat column below 1280.
   - Recommendation: resolve in `/gsd-ui-phase 3` (the STATE.md next step), implement as a Dashboard class change in Phase 3.

2. **Copy for a failed `GET /api/watchlist`**
   - What we know: UI-SPEC reserves `Watchlist is empty` / `Enter a ticker above and press Add.` and the header's `Portfolio unavailable. Reload the page to try again.`
   - What's unclear: nothing is specified for a failed watchlist load.
   - Recommendation: mirror the header pattern: `Watchlist unavailable. Reload the page to try again.` in `text-down`, `role="alert"`; confirm in the UI phase.

3. **Where portfolio state lives**
   - What we know: Header currently fetches inside itself; Phase 4 needs refresh after trades and shares the data with the positions table.
   - Recommendation: a `usePortfolio()` hook now, called by Header; Phase 4 lifts the call to Dashboard when a second consumer appears. Do not build a provider yet.

4. **Row selection plumbing**
   - TRADE-01/02 are Phase 4. Phase 3 should render rows without click behavior or `selected` styling. Phase 4 adds `selectedTicker` in Dashboard and the accent ticker style (UI-SPEC item 3 of the accent list).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, `next build`, Playwright | yes | v26.9.0 (local; Dockerfile build stage uses Node 22) | none needed |
| npm + `frontend/node_modules` | all frontend checks | yes | installed; 35 tests pass | `npm --prefix frontend ci` |
| uv / Python | backend for manual and E2E runs | yes | uv 0.12.3 | — |
| Docker | image build, container for E2E | yes | 29.8.2 (desktop-linux) | run backend with uvicorn directly |
| Playwright + Chromium | in-phase run of `sse-reconnect`, `fresh-start`, `watchlist` (first test) | yes | `test/node_modules`, cached browsers `chromium-1243`/`1248`; Chromium 156.0.8078.4 launched in this session | — |
| Free port 8000 | container/backend | NO (occupied) | `finally-p1` (Phase 1 image, stale backend) is bound to 8000 | `docker rm -f finally-p1` first, or run the new container on 8010 (`BASE_URL=http://localhost:8010`) |
| Port 3100 | `next dev -p 3100` | yes (free) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** port 8000 is taken by the stale Phase 1 container; use a rebuilt image under a new name and a fresh volume (the `fresh-start` test needs an empty database).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.5 + React Testing Library 16.3.3 + jest-dom 7.0.1, jsdom 30.1.3 |
| Config file | `frontend/vitest.config.mts`, `frontend/vitest.setup.ts` (stubs `ResizeObserver` 800x400, `EventSource` -> `FakeEventSource`, `scrollIntoView`) |
| Quick run command | `npm --prefix frontend test -- src/lib/priceStore.test.ts` (single file; runtime under 1 s baseline) |
| Full suite command | `npm --prefix frontend test && npm --prefix frontend run typecheck && npm --prefix frontend run build` |
| Browser check (in phase) | `cd test && BASE_URL=http://localhost:8010 npx playwright test sse-reconnect.spec.ts fresh-start.spec.ts watchlist.spec.ts -g "adding and removing"` against a freshly built container on a fresh volume |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIVE-01 | Frame with only AAPL updates AAPL and leaves the other rows' prices; repeat timestamp is ignored; one `EventSource` at exactly `/api/stream/prices`; cleanup closes it | unit | `npm --prefix frontend test -- src/lib/priceStore.test.ts src/lib/priceStream.test.ts` | Wave 0 |
| LIVE-02 | `open` -> connected; `fail()` -> reconnecting; `fail(true)` -> disconnected then a second `FakeEventSource` after 1 s (fake timers) then `open` -> connected; unmount closes and cancels the timer | unit + component | `npm --prefix frontend test -- src/lib/priceStream.test.ts src/components/Header.test.tsx` | Wave 0 (Header test exists, must change) |
| LIVE-03 | Rows equal the `GET /api/watchlist` list in order; held-only ticker in a frame creates no row; no-price row shows `--`; change % uses `open_price` | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx` | Wave 0 |
| LIVE-04 | Up tick -> up class on `watchlist-price-T`, down tick -> down class; equal price, first value and repeated frame -> no class; class cleared after hold (fake timers) | component | `npm --prefix frontend test -- src/components/FlashingPrice.test.tsx` | Wave 0 |
| LIVE-05 | History grows per new tick and caps at 300; sparkline renders an `svg` path; stroke up/down by net direction | unit + component | `npm --prefix frontend test -- src/lib/priceStore.test.ts src/components/Sparkline.test.tsx` | Wave 0 |
| LIVE-06 | Typing `dis` posts `{"ticker":"DIS"}`; 400 text shown inline; input kept on error; button disabled while pending; list refetched on success | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx` | Wave 0 |
| LIVE-07 | Remove issues `DELETE /api/watchlist/AAPL` (encoded), row disappears after refetch, store history cleared; 404 still converges | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx` | Wave 0 |
| LIVE-08 | `liveTotalValue` = cash + Σ qty × live price, falls back to `current_price`; header shows cash `$10,000.00` on empty portfolio and updates when a frame arrives | unit + component | `npm --prefix frontend test -- src/lib/portfolioValue.test.ts src/components/Header.test.tsx` | Wave 0 |
| LIVE-02 (real browser) | Dot reconnecting then connected through the stub/refuse/pass-through flow | e2e (run in-phase against a built container) | `cd test && BASE_URL=http://localhost:8010 npx playwright test sse-reconnect.spec.ts` | exists (spec) |
| LIVE-01/03/08 (real browser) | 10 default rows, cash and total 10000, connected dot, AAPL price moving | e2e (fresh DB) | `cd test && BASE_URL=http://localhost:8010 npx playwright test fresh-start.spec.ts` | exists (spec) |
| LIVE-06/07 (real browser) | Add DIS then remove DIS | e2e | `cd test && BASE_URL=http://localhost:8010 npx playwright test watchlist.spec.ts -g "adding and removing"` | exists (spec; the second test needs `main-chart`, Phase 4) |
| LIVE-04 visual | Fade looks like ~500 ms green/red | manual UAT | browser at the container URL | manual only (CSS transitions do not run in jsdom) |

### Sampling Rate
- **Per task commit:** the single-file Vitest command for the touched module.
- **Per wave merge:** `npm --prefix frontend test && npm --prefix frontend run typecheck`.
- **Phase gate:** full suite plus `npm --prefix frontend run build` (catches the `getServerSnapshot` prerender failure), then the three Playwright specs above against the rebuilt container, then the manual flash/dot check.

### Wave 0 Gaps
- [ ] `frontend/src/lib/priceStore.test.ts` - merge, no-replace, repeat-timestamp skip, flash direction, history cap, reset (LIVE-01, LIVE-04, LIVE-05)
- [ ] `frontend/src/lib/priceStream.test.ts` - status mapping and CLOSED recreation using the existing `FakeEventSource` (LIVE-01, LIVE-02)
- [ ] `frontend/src/lib/portfolioValue.test.ts` (LIVE-08)
- [ ] `frontend/src/components/{Watchlist,FlashingPrice,Sparkline}.test.tsx` (LIVE-03..LIVE-07)
- [ ] `frontend/src/test/fixtures.ts` - `makeFrame()`, `makePortfolio()` builders
- [ ] `frontend/vitest.setup.ts` - add `priceStore.reset()` to the global `afterEach`
- [ ] Update `Header.test.tsx`: stubs gain `positions: []`; replace the "starts disconnected" test; add status mapping assertions on `data-status`
- [ ] Update `Dashboard.test.tsx` only if the watchlist panel structure changes its heading or testid assertions (the current four tests should stay valid; the fetch stub never resolves)
- Framework install: none.

## Security Domain

`security_enforcement` is on (ASVS L1, block on high). The surface is small: same-origin, no auth, no secrets in the client.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | single-user, no login (project decision) |
| V3 Session Management | no | no sessions |
| V4 Access Control | no | single-user |
| V5 Input Validation / Output Encoding | yes | Backend remains the validator (`^[A-Z]{1,5}$`, priceability); client only uppercases. Render every server- or user-derived string (ticker, `ApiError.message`) as a React text node; never `dangerouslySetInnerHTML`. `encodeURIComponent` on path segments. |
| V6 Cryptography | no | none used |
| V8 Data Protection | no | no secrets or PII in the frontend |
| V12/V13 API & Web Service | yes | Same-origin relative URLs only; parse SSE data with `JSON.parse` of a same-origin stream; no `eval`. |
| V14 Configuration | partial | No new headers or env; static export unchanged. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reflected text from the 400 body (`Invalid ticker: '<input>'` echoes user input) | Tampering / XSS | Render via JSX text only; no HTML injection path. Add a test that an error containing `<img onerror=...>` renders as literal text. |
| Path injection through the ticker in `DELETE /api/watchlist/{ticker}` | Tampering | `encodeURIComponent(ticker)`; ticker values come from the server list, but encode anyway. |
| `data-testid`/`aria-label` built from ticker strings | Tampering | Attributes are escaped by React; tickers originate from a backend that enforces `^[A-Z]{1,5}$`. |
| Unbounded client memory from stream history | Denial of Service | `HISTORY_LIMIT = 300` per ticker; history cleared on remove. |
| Reconnect storm if the server keeps answering non-200 | Denial of Service | Fixed `RECREATE_DELAY_MS` (1 s) instead of a tight loop; one timer, cleared on cleanup. |
| Duplicate/in-flight add or remove submissions | Tampering / integrity | Disable the Add button while the request is pending; backend add is idempotent (Phase 2). |
| Malformed or hostile SSE frame crashing the store | Denial of Service | Same-origin trusted channel; no defensive parsing beyond skipping `price === null` entries (user rule: do not program defensively). Flag as accepted risk, severity low. |
| Stale or wrong figures read as truth | Integrity | Total uses live store price, falls back to the API `current_price`; no silent zero. |

## Project Constraints (from CLAUDE.md)

- Be simple and incremental; small steps, validate each. No over-engineering, no defensive programming; use exception handling only when needed.
- Use latest APIs. Python: `uv run`/`uv add` only (backend untouched in this phase).
- Favor clear names and short modules/functions; docstring-style comments, sparse inline comments; no emojis in code or logging.
- Frontend: Next.js static export, Tailwind 4 tokens, Recharts only, TypeScript 7 with no ESLint, Vitest + RTL. All `data-testid` values come from `frontend/src/lib/testIds.ts`, never string literals. Numeric testid elements hold only the formatted number.
- Run frontend checks with `npm --prefix frontend test|run typecheck|run build`; backend with `cd backend && uv run pytest`. `next dev` uses `-p 3100` locally (port 3000 is busy). Use `/usr/bin/grep` for GNU flags.
- GSD workflow enforcement: file changes go through a GSD command (`/gsd-execute-phase` for planned work).
- UI-SPEC (approved) binds: 28px rows, `px-2` padding, two weights (400/600), four sizes, accent reserved list, copy strings, `bg-up/25`/`bg-down/25` flash, `aria-label="Remove AAPL"` on the remove button, `Add` bare-verb CTA, no `font-medium`.

## Sources

### Primary (HIGH confidence)
- Backend source read this session: `backend/app/market/{stream,router,cache,models}.py`, `backend/app/routes/{watchlist,portfolio}.py`, `backend/app/services/{watchlist,portfolio}.py`, `backend/app/db/repository.py` (list_watchlist).
- Live probes against the running container on :8000: `GET /api/stream/prices`, `GET /api/watchlist`, `GET /api/portfolio`, `POST /api/watchlist` (400), `DELETE /api/watchlist/ZZZ` (404).
- E2E specs: `test/tests/{sse-reconnect,fresh-start,watchlist,trading,helpers}.spec/ts`, `test/playwright.config.ts`.
- Frontend source: `frontend/src/**`, `vitest.setup.ts`, `package.json`, `tsconfig.json`, `next.config.ts`.
- Empirical Chromium 156.0.8078.4 spikes (EventSource readyState matrix; CSS transition flash).
- WHATWG HTML Living Standard, Server-sent events: https://html.spec.whatwg.org/multipage/server-sent-events.html
- React docs, `useSyncExternalStore`: https://react.dev/reference/react/useSyncExternalStore
- `node_modules/recharts/es6/state/keyboardEventsMiddleware.js:35` (accessibility layer default).

### Secondary (MEDIUM confidence)
- Project research `.planning/research/PITFALLS.md` (Pitfalls 2, 3, 4, 13, 14, 15) cross-checked against the code and the spike. Pitfall 14's keyframe-by-`key` suggestion was not adopted; the UI-SPEC and LIVE-04 say transition.
- Old frontend at commit `5681c3a` (`WatchlistRow`, `Sparkline`, `ConnectionDot`) as prior art only.

### Tertiary (LOW confidence)
- None relied on. Assumptions A1-A6 above are unverified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages; versions read from `package.json` and `node_modules`.
- Architecture: HIGH - backend contract read and probed; store pattern follows the React docs.
- EventSource CLOSED vs CONNECTING: HIGH for Chromium (measured) and the spec; MEDIUM for Firefox/Safari (not run).
- Flash technique: HIGH in Chromium; MEDIUM elsewhere (A2).
- Pitfalls: HIGH - each tied to code or a measurement.

**Research date:** 2026-10-16
**Valid until:** 2026-11-15 (stable stack; re-check only if Next, React or Recharts pins change)
