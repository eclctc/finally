---
phase: 04-trading-portfolio
plan: 03
subsystem: ui
tags: [react, nextjs, recharts, price-store, vitest]
status: complete
requires:
  - phase: 04-trading-portfolio
    provides: Plan 04-02 MainChart wrapper, selectedTicker, signClass
provides:
  - priceStore keeps 1,200 timestamped { t, price } points per ticker (PricePoint, EMPTY_SERIES, getSeries)
  - useTickerSeries hook; useTickerHistory derived (number[] props unchanged)
  - MainChart price line, caption, axes, dashed Open line, PriceTooltip
  - ChartTooltip shared frame and formatClock (reused by Plan 04-06)
  - Sparkline limited to its last 300 points (SPARKLINE_POINTS)
affects: [04-04, 04-06, 05-ai-chat]
tech-stack:
  added: []
  patterns:
    - "Store holds raw prices; t = timestamp * 1000; rounding only at render"
    - "Tooltip as a plain exported component, unit-tested without hover"
key-files:
  created:
    - frontend/src/components/ChartTooltip.tsx
    - frontend/src/components/MainChart.test.tsx
    - frontend/src/lib/formatTime.ts
    - frontend/src/lib/formatTime.test.ts
  modified:
    - frontend/src/lib/priceStore.ts
    - frontend/src/lib/priceStore.test.ts
    - frontend/src/lib/usePrice.ts
    - frontend/src/lib/usePrice.test.tsx
    - frontend/src/components/MainChart.tsx
    - frontend/src/components/Sparkline.tsx
    - frontend/src/components/Sparkline.test.tsx
    - frontend/src/components/Watchlist.test.tsx
key-decisions:
  - "SPARKLINE_POINTS lives in Sparkline.tsx (its only reader), not the store"
  - "Time formatters live in formatTime.ts, not format.ts"
  - "Caption is its own component reading useTickerPrice, so the plot only re-renders from the series subscription"
requirements-completed: [TRADE-01]
metrics:
  duration: ~20 min
  completed: 2026-10-16
commits: 3
plan_head_before: 2b1a3ecc309d1745873937fd476def687d590169
plan_head_after: daefd38a2292e09a4d1ed5817504d15595c41383
actuals:
  tokens: 9000
  tasks: 3
  commits: 3
---

# Phase 4 Plan 03: Main chart with 10-minute timestamped history Summary

**The price store now keeps 1,200 timestamped points per ticker (10 minutes), the main chart draws the selected ticker's line with time and price axes, a dashed Open line, a caption and a tooltip, and sparklines still show only their last 300 points.**

## Accomplishments

- Task 1 (tracer): `priceStore` stores `{ t: timestamp * 1000, price }` capped at `HISTORY_LIMIT = 1200`; `getSeries`/`EMPTY_SERIES` replace the old number history and constant. `useTickerSeries` added, `useTickerHistory` derived with `useMemo` so `WatchlistRow` and `Sparkline` props are unchanged. `MainChart` shows `Waiting for price data.` under 2 points, then one `path.recharts-curve`. Store, hook and Watchlist tests moved to the series shape in the same commit (1,199 / 1,200 / 1,201 boundary, `* 1000` precision, seed timestamp).
- Task 2: `Sparkline` slices to `SPARKLINE_POINTS = 300` before drawing, coloring and the `>= 2` check (IN-04 closed). 400-point cases fail without the slice.
- Task 3: `formatClock` (`hourCycle: "h23"`), `ChartTooltip`, caption (price, change vs session open via `signClass`, `Since page load` / `Last 10 min`), `CartesianGrid`, formatted axes, `ReferenceLine` `Open` (dashed, `extendDomain`, `insideTopLeft`), `Tooltip` with exported `PriceTooltip`.

## Verification

- `npm --prefix frontend test`: 17 files, 202 tests pass (187 before the plan)
- `npm --prefix frontend run typecheck` and `run build` exit 0 (prerender intact; every `useSyncExternalStore` has a server snapshot)
- Tracer gate: no source file names the removed `getHistory`/`EMPTY_HISTORY` (grep exit 1), full suite, typecheck and build green after Task 1, then expanded.

## Deviations from Plan

None - plan executed exactly as written. Environment notes:
- `npm --prefix frontend ci` was run once in the fresh worktree (no new packages).
- One mid-run slip: a single `npm test/typecheck/build` triple was run with a relative `--prefix` from the shared checkout directory instead of the worktree. It only ran existing, unmodified code (no source edits there); `build` may have refreshed gitignored output (`frontend/out`, `frontend/.next`) in the shared checkout. All real verification above was re-run inside the worktree.

## Known Stubs

None.

## Backstops (manual, not automated)

- Axis tick labels and tooltip do not collide with the line or clip at the 413px minimum chart width (jsdom cannot drive hover or real layout).
- Main chart no-selection, waiting and populated states reviewed visually in a browser.

## Threat Flags

None. T-04-10 is mitigated by the `HISTORY_LIMIT = 1200` cap (pinned by the 1,199/1,200/1,201 test); T-04-11 accepted (all text rendered as React/Recharts text nodes); T-04-SC: no new packages.

## Self-Check: PASSED

- FOUND: frontend/src/components/ChartTooltip.tsx, frontend/src/components/MainChart.test.tsx, frontend/src/lib/formatTime.ts, frontend/src/lib/formatTime.test.ts
- FOUND commits: 9f81d22, c4b6a3f, daefd38
