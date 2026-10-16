---
phase: 03-live-watchlist-header
plan: 01
subsystem: ui
tags: [react, useSyncExternalStore, eventsource, sse, vitest, nextjs-static-export]

requires:
  - phase: 01-walking-skeleton
    provides: Dashboard layout, Panel, api.request, format helpers, testIds, FakeEventSource double
  - phase: 02-backend-hardening
    provides: GET /api/watchlist and the SSE price frame
provides:
  - Module-level price store with per-ticker subscriptions, capped history, flash direction and connection status
  - Single EventSource lifecycle with CLOSED-stream recreation after 1 s
  - useSyncExternalStore hooks with server snapshots (static prerender safe)
  - Watchlist panel and memoized WatchlistRow (REST membership, live price, daily change vs open_price)
affects: [03-02, 03-03, 03-04, 03-05, 04-trading-portfolio]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "External store singleton (no React import) read only through useSyncExternalStore hooks"
    - "REST payload demoted to seedPrices: fills absent tickers, never overwrites a streamed entry"
    - "Timestamp compared for inequality only; stream is the single source of live prices"

key-files:
  created:
    - frontend/src/lib/priceStore.ts
    - frontend/src/lib/priceStream.ts
    - frontend/src/lib/usePrice.ts
    - frontend/src/components/Watchlist.tsx
    - frontend/src/components/WatchlistRow.tsx
    - frontend/src/test/fixtures.ts
    - frontend/src/lib/priceStore.test.ts
    - frontend/src/lib/priceStream.test.ts
    - frontend/src/lib/usePrice.test.tsx
  modified:
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/Dashboard.test.tsx
    - frontend/vitest.setup.ts

key-decisions:
  - "Status changes only on open and error events; creating a stream never sets status, so a non-200 loop keeps the dot red without flicker"
  - "seedPrices shares the apply path and records one history point; the stream then dedupes by timestamp"
  - "Daily change is computed from price and open_price, never from the frame's per-tick change_percent or direction"

patterns-established:
  - "Store reset in the global vitest afterEach so module state never leaks between tests"
  - "Shared test fixtures in frontend/src/test/fixtures.ts"

requirements-completed: [LIVE-01, LIVE-02, LIVE-03]

duration: 8min
completed: 2026-10-16
status: complete
plan_head_before: c5fe15696bdb354daf029b3b6185a25ac7349b7a
plan_head_after: 5bb55937843d6398897b9c216d6697431fb54e5f
commits: 2

coverage:
  - id: D1
    description: "One EventSource at /api/stream/prices feeds a per-ticker store; an SSE price reaches its watchlist row with daily change vs open_price"
    requirement: LIVE-01
    verification:
      - kind: automated_ui
        ref: "frontend/src/components/Dashboard.test.tsx#streams a live price into its watchlist row"
        status: pass
      - kind: unit
        ref: "frontend/src/lib/priceStore.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Connection status derives from open/error/readyState and a CLOSED stream is recreated after 1 s"
    requirement: LIVE-02
    verification:
      - kind: unit
        ref: "frontend/src/lib/priceStream.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Watchlist rows come from GET /api/watchlist and show -- when no price is known"
    requirement: LIVE-03
    verification:
      - kind: automated_ui
        ref: "frontend/src/components/Dashboard.test.tsx#streams a live price into its watchlist row"
        status: pass
    human_judgment: false
  - id: D4
    description: "Static export prerenders with server snapshots for every hook"
    requirement: LIVE-01
    verification:
      - kind: unit
        ref: "frontend/src/lib/usePrice.test.tsx#server-renders every hook through its server snapshot"
        status: pass
      - kind: other
        ref: "npm --prefix frontend run build (TRACER_OK)"
        status: pass
    human_judgment: false
---

# Phase 3 Plan 01: Live Price Store and Streaming Watchlist Rows Summary

**Module-level price store fed by one native EventSource, read per ticker through useSyncExternalStore, driving watchlist rows listed from GET /api/watchlist with daily change computed against the session open price.**

## Performance

- **Duration:** 8 min
- **Tasks:** 2 (1 tracer, 1 auto)
- **Files:** 9 created, 3 modified

## Accomplishments

- Tracer: a frame emitted on the one EventSource puts `190.50` and `+0.26%` into the AAPL row while MSFT keeps `--`; unmount closes the stream (readyState 2). The static export builds and prerenders the watchlist panel.
- `priceStore.ts` merges frames per ticker, skips repeated timestamps and null prices, derives flash from raw price comparison, caps history at 300, and exposes per-ticker, status and version subscriptions.
- `priceStream.ts` maps readyState to status and recreates a CLOSED stream after `RECREATE_DELAY_MS = 1000` with a single timer cleared on cleanup.
- 40 new tests pin every must_have edge: history 299/300/301, equal timestamp vs equal price, empty frame, timestamp 0 replacing a later one, float precision, idempotent merge, seed vs stream race, StrictMode, pending recreate timer on unmount, and server snapshots via `renderToString`.

## Task Commits

1. **Task 1: Tracer, live SSE price reaches its watchlist row** - `bade24c` (feat)
2. **Task 2: Lock store, stream and hook contract** - `5bb5593` (test)

## Deviations from Plan

None - plan executed exactly as written. One mechanical fix during Task 1: `notify` was first written with `Iterable.forEach`, which TypeScript 7 rejects, so it became a `for...of` loop (caught by typecheck before commit).

## Issues Encountered

- One full-suite run failed `Dashboard > streams a live price into its watchlist row` once, immediately after a test-file edit. It could not be reproduced: 8 sequential full runs, 3 runs under concurrent `next build`, a cleared vite cache, and 30 runs under 6x parallel load all passed. Likely a cold-start timeout of the default 1 s `findByTestId`; no code change was made without evidence. If it recurs, raise that timeout or investigate.
- `npm run build` type-checks test files, so test code must satisfy `FrameEntry` (an extra `direction` field in an object literal failed the build until the test used a variable).

## Verification

- `npm --prefix frontend test`: 9 files, 75 tests pass (baseline 6 files, 35 tests)
- `npm --prefix frontend run typecheck`: clean
- `npm --prefix frontend run build`: exit 0; `TRACER_OK` and `ONE_STREAM_OK` gates pass

## Known Stubs

None. `Watchlist` has no loading, failed or empty state and no add or remove controls by design; Plans 03-04 and 03-05 own them. A rejected `GET /api/watchlist` currently leaves the panel empty and raises an unhandled rejection, which Plan 03-04's failed state resolves.

## Threat Flags

None. The only new network surface is the plan's own `/api/stream/prices` same-origin stream (T-03-04 mitigated by the exact relative URL and the single `new EventSource(` gate).

## Next Phase Readiness

Plan 03-02 (flash and sparkline) can read `useTickerPrice(...).flash` and `useTickerHistory`; Plan 03-03 reads `useConnectionStatus`. The store contract is as specified in the plan's interfaces block.

## Self-Check: PASSED

- All created files exist on disk; commits `bade24c` and `5bb5593` are ancestors of HEAD.
