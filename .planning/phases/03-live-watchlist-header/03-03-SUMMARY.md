---
phase: 03-live-watchlist-header
plan: 03
subsystem: ui
tags: [react, useSyncExternalStore, eventsource, vitest, intl, accessibility]

requires:
  - phase: 03-live-watchlist-header
    provides: priceStore, connectPriceStream, useConnectionStatus, usePriceVersion, test fixtures (plan 03-01)
provides:
  - ConnectionDot driven by the real stream lifecycle with role=status and hidden label
  - Header wordmark as the page's only h1
  - liveTotalValue and the Portfolio types; header total revalued at live prices
  - usePortfolio() returning portfolio, failed and refresh (Phase 4 hand-off)
  - Single-rounding formatCurrency/formatPrice with no signed zero (WR-01)
affects: [03-04, 03-05, 04-trading-portfolio]

actuals:
  tokens: 6000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Pure revaluation function takes a price lookup so the header stays a thin store reader"
    - "Hidden sr-only text is both the accessible name and the live announcement of the status dot"

key-files:
  created:
    - frontend/src/components/ConnectionDot.tsx
    - frontend/src/lib/portfolioValue.ts
    - frontend/src/lib/portfolioValue.test.ts
    - frontend/src/lib/usePortfolio.ts
  modified:
    - frontend/src/components/Header.tsx
    - frontend/src/components/Header.test.tsx
    - frontend/src/lib/format.ts
    - frontend/src/lib/format.test.ts

key-decisions:
  - "Header shows only the client live total; the API total_value is never displayed and a position's API current_price is the fallback when the store has no price"
  - "usePortfolio is called by Header only and reads once on mount; refresh() is the Phase 4 hand-off, no context provider"
  - "Intl does the only rounding; noNegativeZero suppresses values under half a cent so -0.004 never renders as -0.00"

patterns-established:
  - "Dot status tests drive the real connectPriceStream through the FakeEventSource double"

requirements-completed: [LIVE-02, LIVE-08]

duration: 7min
completed: 2026-10-16
status: complete
plan_head_before: 15b08937fa3c75cb38f2334584171669b95b2a89
plan_head_after: f089abd5b48daa11c972faf845d52b201973979e
commits: 6

coverage:
  - id: D1
    description: "Header dot follows open, CONNECTING error, CLOSED error and the recreated stream: green, yellow, red, green; yellow before the first open; announced via role=status text with no aria-label"
    requirement: LIVE-02
    verification:
      - kind: automated_ui
        ref: "frontend/src/components/Header.test.tsx#follows the stream lifecycle"
        status: pass
      - kind: automated_ui
        ref: "frontend/src/components/Header.test.tsx#starts reconnecting"
        status: pass
    human_judgment: false
  - id: D2
    description: "Wordmark is the page's only h1 with Ally in the accent color"
    requirement: LIVE-02
    verification:
      - kind: automated_ui
        ref: "frontend/src/components/Header.test.tsx#renders the wordmark as the only h1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Header shows API cash and a total of cash plus positions at live prices, falling back to API current_price, updating in place on each frame, ignoring API total_value, never flashing"
    requirement: LIVE-08
    verification:
      - kind: unit
        ref: "frontend/src/lib/portfolioValue.test.ts"
        status: pass
      - kind: automated_ui
        ref: "frontend/src/components/Header.test.tsx#revalues the total at live prices while cash stays the same"
        status: pass
      - kind: automated_ui
        ref: "frontend/src/components/Header.test.tsx#ignores the API total_value"
        status: pass
    human_judgment: false
  - id: D4
    description: "Money and price figures round once via Intl (half away from zero) with negative zero suppressed (WR-01)"
    requirement: LIVE-08
    verification:
      - kind: unit
        ref: "frontend/src/lib/format.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Figures do not wrap or overflow the 56px header at 1280px, including seven-digit values; the dot is a fixed 10px glyph"
    requirement: LIVE-08
    verification: []
    human_judgment: true
    rationale: "Layout at the 1280px minimum width is a backstop in the plan, not asserted by jsdom tests"
---

# Phase 3 Plan 03: Live Header Summary

**Header connection dot driven by the real EventSource lifecycle (role=status, hidden label), wordmark as the page h1, a total portfolio value revalued from the live price store with API-price fallback, and a single-rounding Intl formatter.**

## Performance

- **Duration:** 7 min
- **Tasks:** 3 (1 tracer, 2 TDD)
- **Files:** 4 created, 4 modified

## Accomplishments

- Tracer: `ConnectionDot` reads `useConnectionStatus()`; a test drives the real `connectPriceStream()` through open (green), CONNECTING error (yellow), CLOSED error (red), 1000 ms recreate and second open (green). The dot starts yellow, has no `aria-label`, and its `sr-only` text is the accessible name (WR-02).
- Wordmark is now the page's only `h1`.
- `liveTotalValue(portfolio, livePrice)` is cash plus each position at the live price or its API `current_price`. `Header` calls `usePortfolio()` and `usePriceVersion()` and shows only this total; the API `total_value` is ignored (test with `total_value: 99999`).
- `usePortfolio()` returns `{ portfolio, failed, refresh }`; the failure alert and `--` placeholder are unchanged.
- WR-01 fixed: `formatCurrency(1.005)` is `$1.01`, `formatCurrency(-0.005)` is `-$0.01`, `-0.004` shows `$0.00`; `formatPrice` keeps its signature.

## Task Commits

1. **Task 1 RED:** `438934c` (test) - failing dot lifecycle and h1 tests
2. **Task 1 GREEN:** `0377ef2` (feat) - ConnectionDot and h1 wordmark
3. **Task 2 RED:** `c0ba5ea` (test) - failing liveTotalValue and Header revaluation tests
4. **Task 2 GREEN:** `5e01cee` (feat) - portfolioValue, usePortfolio, live Header total
5. **Task 3 RED:** `d2dbd9e` (test) - failing single-rounding tests
6. **Task 3 GREEN:** `f089abd` (feat) - noNegativeZero replaces pre-rounding

## RED Evidence (TDD tasks)

- Task 2: `Header.test.tsx` failed on `expected '$12,345.68' to be '$12,500.50'` and `expected '$99,999.00' to be '$10,000.00'` (planned assertions on the unimplemented live revaluation). `portfolioValue.test.ts` failed to load because the module did not exist yet, so its RED is a load failure and the semantic RED comes from the Header assertions. Semantic assessment: valid.
- Task 3: `format.test.ts` failed on `expected '$1.00' to be '$1.01'` and `expected '1.00' to be '1.01'`, the planned double-rounding assertions. Semantic assessment: valid.
- Task 1 (tracer, not `tdd="true"`): three new tests failed on the missing `role="status"` and `h1`.

The `gsd_run check tdd-red-evidence` classifier was not run; evidence was inspected from the vitest output directly.

## Deviations from Plan

None - plan executed exactly as written. Header tests use two small local helpers (`makePortfolio`, `AAPL_POSITION`) as the plan asked.

## Issues Encountered

None. The Dashboard `findByTestId` flake from wave 1 did not recur.

## Verification

- `npm --prefix frontend test`: 10 files, 84 tests pass (baseline 9 files, 75 tests)
- `npm --prefix frontend run typecheck`: clean
- `npm --prefix frontend run build`: exit 0, static prerender succeeds
- Tracer feedback gate: Header and Dashboard tests re-run after the tracer commit and passed, so expansion proceeded.

## Known Stubs

None. The portfolio is read once on mount; `refresh()` is intentionally unused until Phase 4 wires it after a trade (flagged assumption in the plan). A trade made outside this tab is not reflected until then.

## Threat Flags

None. T-03-07 mitigated (status set only from open/error/readyState in `priceStream.ts`, exercised through the dot); T-03-08 mitigated (fallback to `current_price`, tested); T-03-SC: no packages added, `npm ci` only.

## Next Phase Readiness

Plan 03-04 and 03-05 can rely on a single `h1` and the `ConnectionDot`. Phase 4 can call `usePortfolio().refresh()` after a trade, but `Header` owns the only `usePortfolio()` instance, so Phase 4 must lift or share it when positions need the same data.

## Self-Check: PASSED

- Created files exist on disk: ConnectionDot.tsx, portfolioValue.ts, portfolioValue.test.ts, usePortfolio.ts.
- Commits 438934c, 0377ef2, c0ba5ea, 5e01cee, d2dbd9e, f089abd are ancestors of HEAD.
