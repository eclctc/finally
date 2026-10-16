---
phase: 03-live-watchlist-header
plan: 04
subsystem: ui
tags: [react, vitest, tailwind, a11y, layout]

requires:
  - phase: 03-live-watchlist-header
    provides: priceStore (seedPrices, mergeFrame), Watchlist/WatchlistRow, test fixtures (plan 03-01)
provides:
  - useWatchlist hook owning watchlist membership, REST seeding and load failure
  - Watchlist list region with loading, load-failed (D-02), empty and populated states
  - 1280px terminal grid (320 / minmax fluid / 224 / 320) per D-01
  - Named region landmark per Panel via useId and aria-labelledby
  - color-scheme dark on html and body (D-05)
affects: [03-05]

actuals:
  tokens: 9500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Hook owns REST membership; rows never derive from stream frame keys"
    - "Fixed user-facing failure copy; the error object and response body are never rendered"

key-files:
  created:
    - frontend/src/lib/useWatchlist.ts
    - frontend/src/components/Watchlist.test.tsx
  modified:
    - frontend/src/components/Watchlist.tsx
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/Dashboard.test.tsx
    - frontend/src/components/Panel.tsx
    - frontend/src/app/globals.css

key-decisions:
  - "A failed load replaces the list with the D-02 alert (no retry button); rows from an earlier successful load are not kept"
  - "Layout is verified by class assertions in jsdom; real 206px-per-cell widths are confirmed at the plan 03-05 UAT at 1280px"

patterns-established:
  - "useWatchlist returns { tickers: string[] | null, loadFailed }; null means the first load has not settled"

requirements-completed: [LIVE-03]

duration: 7min
completed: 2026-10-16
status: complete
plan_head_before: 15b08937fa3c75cb38f2334584171669b95b2a89
plan_head_after: 4f3f7efda67900aeba744b2117f20f1b2d56ab6b
commits: 4

coverage:
  - id: D1
    description: "Watchlist lists REST tickers in order with live price and daily change vs open_price, with -- placeholders"
    requirement: LIVE-03
    verification:
      - kind: unit
        ref: "frontend/src/components/Watchlist.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loading, load-failed (fixed D-02 copy, role alert) and empty states, with no row testids"
    requirement: LIVE-03
    verification:
      - kind: unit
        ref: "frontend/src/components/Watchlist.test.tsx#Watchlist states"
        status: pass
    human_judgment: false
  - id: D3
    description: "1280px grid classes and seven named panel regions"
    verification:
      - kind: unit
        ref: "frontend/src/components/Dashboard.test.tsx#lays out the 1280px grid with fixed 320 / 224 / 320 columns"
        status: pass
      - kind: unit
        ref: "frontend/src/components/Dashboard.test.tsx#names every panel as a region landmark"
        status: pass
    human_judgment: true
    rationale: "jsdom cannot compute grid widths; the 206px-per-cell result at 1280px needs a browser look (plan 03-05 UAT)"
---

# Phase 3 Plan 04: Watchlist States and 1280px Layout Summary

**useWatchlist hook drives loading, fixed-copy load-failed, empty and populated watchlist states, and the dashboard moves to a 1280px 320/224/320 grid with named panel regions and dark native controls.**

## Performance

- **Duration:** 7 min
- **Tasks:** 2 (1 tracer, 1 auto/tdd)
- **Files:** 2 created, 5 modified

## Accomplishments

- `useWatchlist` moved the Plan 03-01 inline load out of `Watchlist.tsx`; it seeds the store, keeps response order, and sets `loadFailed` on any rejection or non-2xx. This also removes the unhandled rejection noted in 03-01.
- Watchlist list region renders, in priority order, the D-02 alert (`role="alert"`, `break-words`, `text-down`), `Loading watchlist...`, the empty state, then the `ul` of rows. The outer column `div` is kept for plan 03-05's add form.
- 15 Watchlist tests pin: loading, rejection and 500 (no body leak), empty, REST order, held-only ticker gets no row, REST price before any frame, null-price placeholders, per-tick `change_percent` ignored (`+10.00%`), one-cent adjacency, equal price shows muted `0.00%`, and the same `h-7` row for 1 and 3 tickers.
- Dashboard: root `min-w-[1280px]`, `main` `min-w-0 grid-cols-[320px_minmax(0,1fr)]`, center grid `[minmax(0,1fr)_minmax(0,1fr)_224px]`, aside `w-[320px]`. Panel `section` is labelled by its `h2` through `useId()`; `html, body` gain `color-scheme: dark`.

## Task Commits

1. **Task 1 RED: failing watchlist state tests** - `58e2f2c` (test)
2. **Task 1 GREEN: useWatchlist and list-region states** - `756a02f` (feat)
3. **Task 2 RED: failing region and layout tests** - `c82caca` (test)
4. **Task 2 GREEN: 1280px grid, Panel landmarks, color-scheme** - `4f3f7ef` (feat)

## TDD Notes

- RED (task 1): 4 of 15 tests failed on the planned assertions (missing `Loading watchlist...`, missing `role="alert"` twice, missing empty copy); the other 11 passed because 03-01 already implemented rows, order and daily change, so they are regression pins.
- RED (task 2): 2 of 7 Dashboard tests failed (no region names; root lacked `min-w-[1280px]`).
- Tracer gate: `<verify>` (Watchlist and Dashboard tests) re-run after Task 1 and passed, then expansion continued.

## Deviations from Plan

None - plan executed exactly as written. `fixtures.ts` has untyped return values, so the plan's `SseEntry` type name was replaced by `ReturnType<typeof makeWatchlistEntry>` in the test; no fixture change was needed.

## Issues Encountered

None. The Dashboard flake seen in wave 1 did not recur.

## Verification

- `npm --prefix frontend test`: 10 files, 92 tests pass (baseline 9 files, 75 tests; this plan alone adds 17)
- `npm --prefix frontend run typecheck`: clean
- `npm --prefix frontend run build`: exit 0, `LAYOUT_OK` printed
- No `1024px`, `260px` or `w-[360px]` remain in `Dashboard.tsx`

## Known Stubs

None.

## Threat Flags

None. T-03-09 mitigated: the failure path renders only the fixed D-02 sentence, pinned by the rejection and 500 tests.

## Next Phase Readiness

Plan 03-05 can call the hook's `load` after add/remove (currently private; expose it by adding `load` to the hook's return) and pin the add form above the list region inside the existing column `div`. The 206px-per-cell check at 1280px remains for the UAT.

## Self-Check: PASSED

- `useWatchlist.ts` and `Watchlist.test.tsx` exist; commits `58e2f2c`, `756a02f`, `c82caca`, `4f3f7ef` are ancestors of HEAD.
