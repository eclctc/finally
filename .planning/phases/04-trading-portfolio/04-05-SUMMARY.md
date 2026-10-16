---
phase: 04-trading-portfolio
plan: 05
subsystem: ui
tags: [react, positions-table, vitest, tailwind]
status: complete
requires:
  - phase: 04-trading-portfolio
    provides: Plan 04-01 lifted usePortfolio and trade fills via setPortfolio; Plan 04-04 livePosition
provides:
  - PositionsTable and memoized PositionRow (live revalued, sorted by ticker, sticky head, fixed columns)
  - formatSignedCurrency (explicit + on gains)
  - Positions table mounted in the Dashboard Positions panel
affects: [04-06, 04-07, 05]
tech-stack:
  added: []
  patterns:
    - "PositionRow subscribes only to its own ticker via useTickerPrice and derives P&L through livePosition; the API unrealized_pnl is never displayed"
    - "border-separate border-spacing-0 with a border-b on each cell keeps the sticky head border pinned"
key-files:
  created:
    - frontend/src/components/PositionsTable.tsx
    - frontend/src/components/PositionRow.tsx
    - frontend/src/components/PositionsTable.test.tsx
  modified:
    - frontend/src/lib/format.ts
    - frontend/src/lib/format.test.ts
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/Dashboard.test.tsx
key-decisions:
  - "Sticky on the th cells with border-separate instead of border-collapse so the head border stays pinned (plan Flagged Assumption)"
  - "All four table states (loading, error, empty, populated) were written in the tracer task, so Task 2 tests passed on first run"
requirements-completed: [PORT-01, TRADE-05]
metrics:
  duration: ~10 min
  completed: 2026-10-16
commits: 2
plan_head_before: 267f53bb5deb55fcd0e6833411d9473234b8ae17
plan_head_after: 8008b1abb685a33f25f19d1dfccab33f37144612
actuals:
  tokens: 7500
  tasks: 2
  commits: 2
---

# Phase 4 Plan 05: Positions table Summary

**Live positions table (ticker, qty, avg cost, price, unrealized P&L, P&L %) fed by the lifted portfolio: a Buy adds a row from the trade response, a full Sell removes it, and P&L revalues on every tick.**

## Accomplishments

- Tracer: Dashboard test proves `position-row-MSFT` appears after a Buy and disappears after a full Sell with no reload; build output contains the `positions-table` panel (`TRACER_OK`).
- `PositionRow` (own file for Phase 5) is a `memo` `tr` with `data-testid=position-row-{T}`; no click, hover, flash or aria-live.
- `PositionsTable` covers loading, error (`role="alert"`), empty and populated states; rows sorted by `localeCompare` and stable across ticks.
- `formatSignedCurrency` uses `signDisplay: "exceptZero"` behind the existing `noNegativeZero` guard.
- 17 new component tests plus 3 `formatSignedCurrency` tests; full suite 241 passed, typecheck and build clean.

## Task Commits

1. Task 1 (tracer): `d5100d8` feat(04-05) positions table with live revaluation
2. Task 2: `8008b1a` test(04-05) pin states, columns, sort, live revaluation and rounding colors

## Deviations from Plan

**1. [Process] Task 2 had no failing RED step.** The loading, error and empty states and the full table were already written in Task 1 (the tracer needed the whole table to be production quality), so the Task 2 tests passed on first run. No production code changed in Task 2.

**2. [Observation] One transient full-suite failure.** The first full-suite run after Task 1 reported `1 failed | 223 passed`; the failing test was not captured. Five consecutive reruns (and all later runs) passed 224/224 then 241/241. Not reproduced, so no fix was attempted. Possibly an existing timing-sensitive test; flagged for the verifier.

Otherwise the plan was executed as written.

## Known Stubs

None.

## Threat Flags

None. Tickers render as React text nodes (T-04-14, covered by a hostile-ticker test); P&L comes from `livePosition`, and a test asserts the API `unrealized_pnl` is never shown (T-04-15). No new packages (`npm ci` only).

## Self-Check: PASSED

- FOUND: frontend/src/components/PositionsTable.tsx, PositionRow.tsx, PositionsTable.test.tsx
- FOUND commits d5100d8, 8008b1a
