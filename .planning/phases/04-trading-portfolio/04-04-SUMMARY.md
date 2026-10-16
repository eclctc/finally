---
phase: 04-trading-portfolio
plan: 04
subsystem: ui
tags: [react, recharts, treemap, heatmap, vitest]
status: complete
requires:
  - phase: 04-trading-portfolio
    provides: Plan 04-01 Dashboard-owned usePortfolio (portfolio, failed) and fixtures
provides:
  - Heatmap component (Recharts Treemap with a custom rect tile renderer) and tileFill
  - livePosition(position, livePrice) per-position live revaluation
  - Heatmap mounted in the Dashboard Heatmap panel
affects: [04-05, 04-06, 04-07]
tech-stack:
  added: []
  patterns:
    - "Treemap content renderer returns an empty g for depth 0 and a g with title, rect and a nested svg of labels for leaves (no clip-path)"
    - "Tiles re-derive from the live store price through usePriceVersion"
key-files:
  created:
    - frontend/src/components/Heatmap.tsx
    - frontend/src/components/Heatmap.test.tsx
  modified:
    - frontend/src/lib/portfolioValue.ts
    - frontend/src/lib/portfolioValue.test.ts
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/Dashboard.test.tsx
key-decisions:
  - "Nested svg (not clipPath) clips tile labels so no defs rect can become the first svg rect"
  - "Treemap data sorted by ticker with localeCompare for stable tile order between ticks"
  - "No avg_cost === 0 guard in livePosition (backend fills at a positive cached price)"
requirements-completed: [PORT-02]
metrics:
  duration: ~12 min
  completed: 2026-10-16
commits: 2
plan_head_before: 2b1a3ecc309d1745873937fd476def687d590169
plan_head_after: 91f7ce1180cb0469438a625d7bfecb58936412e7
actuals:
  tokens: 6500
  tasks: 2
  commits: 2
---

# Phase 4 Plan 04: Portfolio heatmap Summary

**Recharts Treemap heatmap of labeled rect tiles sized by live market value and colored green or red by P&L, with loading, error and empty states, mounted in the Dashboard.**

## Spike result

Run against the installed Recharts 3.10.1 as committed tests in `Heatmap.test.tsx` (first, through a real Heatmap), and in `Dashboard.test.tsx`. All pass; no wrapper fallback was needed.

| Gate item | Result |
|---|---|
| (1) Extra data fields (`pnlFraction`, `marketValue`) reach the leaf renderer: JPM fill contains `--color-up`, AAPL contains `--color-down`, JPM title contains `$2,100.00` | PASS |
| (2) First `svg rect` is a tile rect with width above 0, its parent `g` holds a ticker `title` | PASS |
| (3) Root (`depth === 0`) suppressed: no 800x400 rect, one tile rect per position | PASS |
| (4) Tickers present as `<text>` content (container text has JPM and AAPL); no clipPath/defs in the container | PASS |

Observed first rect (JPM 10 @ 200 -> 210, AAPL 5 @ 200 -> 190, 800x400 stub): `<rect x="0" y="0" width="249" height="400" style="fill: color-mix(in srgb, var(--color-down) 40%, var(--color-line));" stroke="var(--color-surface)" stroke-width="1">` (the AAPL tile, first by ticker sort).

## Accomplishments

- Task 1 (tracer): `livePosition` in `portfolioValue.ts`; `Heatmap.tsx` with `tileFill`, local `renderTile`, ticker-sorted live data and the Treemap well; mounted via `<Heatmap portfolio={portfolio} failed={failed} />` in the Heatmap panel. Dashboard test: a held JPM position shows `JPM` in the `heatmap` panel with a first `svg rect` of positive width.
- Task 2: error (`role="alert"`, `text-down`), empty (`py-12 text-center text-muted`, no Treemap/svg) and loading states; `role="img"` well with the position-count `aria-label`. Tests for the 64x40 percent-label threshold, exact tooltip `JPM  $2,100.00  +5.00%`, no handlers, live revaluation to `$2,200.00  +10.00%`, sort order, one-tile full-well, the four `tileFill` cases and two `livePosition` cases.

## Verification

- `npm --prefix frontend test`: 16 files, 208 tests pass (187 before the plan)
- `npm --prefix frontend run typecheck` and `run build` exit 0
- No `clipPath` in `Heatmap.tsx` (TRACER_OK conditions met; the tracer gate was re-run end-to-end after Task 1 and passed before expanding)

## Deviations from Plan

None - plan executed exactly as written. Environment note: `npm --prefix frontend ci` was run once in the fresh worktree (no new packages). The two plan verify chains using `&&` and `!` were run as separate commands because the sandbox refuses compound commands; each part passed. RED and GREEN for Task 2 were committed together (tests were run and seen failing first: error, empty and aria-label cases).

## Known Stubs

None.

## Threat Flags

None. T-04-12 (ticker rendered as React text nodes in `title`/`text`, no raw-HTML prop) and T-04-13 (percent printed on large tiles, full tooltip on every tile) are implemented. Label clipping in a real browser is a UAT backstop (not observable in jsdom).

## Self-Check: PASSED

- FOUND: frontend/src/components/Heatmap.tsx, frontend/src/components/Heatmap.test.tsx
- FOUND commits: bd7e484, 91f7ce1
