---
phase: 04-trading-portfolio
plan: 06
subsystem: ui
tags: [react, recharts, pnl-chart, portfolio-history, vitest]
status: complete
requires:
  - phase: 04-trading-portfolio
    provides: Plan 04-01 lifted usePortfolio with POLL_MS and setPortfolio; 04-03 ChartTooltip, formatClock and MainChart markup; 04-05 formatSignedCurrency and the Dashboard fill path
provides:
  - usePortfolioHistory (mount load, 30 s poll, last-request-wins, refresh that never rejects)
  - pnlSeries helpers (STARTING_CASH, PNL_POINTS, snapshotTime, downsample, buildPnlSeries)
  - PnlChart and PnlTooltip (states, dashed $10,000 baseline, live-tail dot, span-aware ticks)
  - formatDateClock, formatHourMinute, formatMonthDay
  - Dashboard holds history and refreshHistory(); handleFilled refreshes history after setPortfolio
affects: [04-07, 05]
tech-stack:
  added: []
  patterns:
    - "History hook mirrors usePortfolio: a request counter (latest) discards any response that is not from the latest request"
    - "The live tail is recomputed per render from liveTotalValue and Date.now(); no stored tail, no useMemo"
key-files:
  created:
    - frontend/src/lib/pnlSeries.ts
    - frontend/src/lib/pnlSeries.test.ts
    - frontend/src/lib/usePortfolioHistory.ts
    - frontend/src/lib/usePortfolioHistory.test.tsx
    - frontend/src/components/PnlChart.tsx
    - frontend/src/components/PnlChart.test.tsx
  modified:
    - frontend/src/lib/formatTime.ts
    - frontend/src/lib/formatTime.test.ts
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/Dashboard.test.tsx
    - frontend/src/test/fixtures.ts
key-decisions:
  - "snapshotTime trims the backend's six fraction digits to three with one regex so parsing is correct in every engine (assumption A2)"
  - "The tail time is max(now, lastT), so the line never runs backwards when the clock is behind the last snapshot"
  - "PnlChart renders the error and waiting states itself, keyed on the failed prop and a series shorter than 2 points"
requirements-completed: [PORT-03, PORT-04, TRADE-05]
metrics:
  duration: ~12 min
  completed: 2026-10-16
commits: 5
plan_head_before: 56b07b43211ae6f26675602ab3463c4e2abcd163
plan_head_after: bb896551447972ce399e99dc4dbd7157147b61eb
actuals:
  tokens: 6700
  tasks: 3
  commits: 5
---

# Phase 4 Plan 06: P&L chart Summary

**P&L line from `/api/portfolio/history`, downsampled to 300 points with a live tail at the header total, a $10,000 dashed baseline and a tooltip; a trade refetches the history, and it polls every 30 s with last-request-wins ordering.**

## Accomplishments

- Tracer: a Dashboard test proves that one snapshot plus the live tail draws one `path.recharts-curve` in `pnl-chart`, and that a trade causes exactly one extra `GET /api/portfolio/history` and no extra `GET /api/portfolio` (`TRACER_OK`; the export contains the loading line).
- `usePortfolioHistory` returns `{ history, failed, refresh }`; `failed` is true only while no history has loaded, and a failed later refresh keeps the last data silently.
- `pnlSeries.ts` is pure: `downsample` keeps the first and last point and strictly increasing source indices (checked at 301, 1,000 and 20,160), and `buildPnlSeries` appends the tail last.
- `PnlChart` covers loading, error (`role="alert"`, `text-down`), waiting (fewer than 2 points) and populated states. The populated chart has the dashed `Start $10,000` baseline, a `ReferenceDot` on the tail, HH:MM or `Mon D` ticks by span, a 64px Y axis and the `PnlTooltip` (`Total value`, `vs start` colored by `signClass`).
- 36 new tests (22 files, 278 tests in total, all passing); typecheck and static build clean (`PNL_SUITE_OK`).

## Task Commits

1. Task 1 (tracer): `1d7c3e7` feat(04-06) trade snapshot and live tail draw the P&L line
2. Task 2 RED: `938d7ef` test(04-06) downsample, tail, timestamp, poll and ordering cases (poll and later-started-wins failed as expected)
3. Task 2 GREEN: `a66b79c` feat(04-06) 30 s poll with last-request-wins ordering
4. Task 3 RED: `595c951` test(04-06) P&L chart states, baseline, dot, ticks and tooltip (13 failing)
5. Task 3 GREEN: `bb89655` feat(04-06) P&L chart contract

## TDD Notes

- The `pnlSeries` cases passed on first run because the tracer already carried the pure helpers; no defect was exposed, so nothing in `pnlSeries.ts` changed in Task 2.
- Task 3 GREEN needed one test-side fix: the X tick labels render in a `.recharts-xAxis-tick-labels` layer outside `.recharts-xAxis`, so the first selector found zero labels. The component was correct; the selector was corrected and both tick-format tests then passed (they would fail with the wrong formatter, so they are not vacuous).

## Deviations from Plan

None - plan executed as written. One minor structure choice: the tracer-stage `PnlChart` accepted `failed` in its prop type without using it; Task 3 wired it in.

## Known Stubs

None.

## Threat Flags

None. No new endpoints or trust-boundary surface; no packages added (`npm ci` only). T-04-17 (overlapping history GETs) is mitigated by the `latest` counter and its later-started-wins test.

## Notes for Later Plans

- Phase 5 can call `refreshHistory()` (resolves after the GET settles, never rejects) alongside `refresh()` after AI actions.
- The Playwright `portfolio-charts.spec.ts` P&L assertion is covered at unit level by the Dashboard test; the real run belongs to Plan 04-07 / the Phase 6 gate.
- Backstop items (axis labels and tooltip at the 413px minimum chart width; manual review of the four chart states) are not machine-verified here.

## Self-Check: PASSED

- Files exist: pnlSeries.ts, usePortfolioHistory.ts, PnlChart.tsx and their tests, plus the modified formatTime.ts, Dashboard.tsx and fixtures.ts.
- Commits `1d7c3e7`, `938d7ef`, `a66b79c`, `595c951`, `bb89655` are ancestors of HEAD.
