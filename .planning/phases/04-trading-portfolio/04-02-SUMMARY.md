---
phase: 04-trading-portfolio
plan: 02
subsystem: ui
tags: [react, nextjs, watchlist, selection, vitest]
status: complete
requires:
  - phase: 04-trading-portfolio
    provides: Plan 04-01 TradeBar and Dashboard-owned portfolio source
provides:
  - Dashboard-owned selectedTicker threaded to Watchlist, MainChart and TradeBar
  - MainChart wrapper (main-chart testid, data-ticker, no-selection line, 28px caption strip)
  - Selectable WatchlistRow (click, Enter/Space, aria-current, selected style)
  - Default (first ticker) and fallback selection effect in Watchlist
  - TradeBar first-selection prefill rule
  - signClass(value, displayed) rounded-value color rule
affects: [04-03, 04-04, 04-05, 04-06, 05-ai-chat]
tech-stack:
  added: []
  patterns:
    - "One-way selection: selection writes the trade ticker; the trade ticker never writes back"
    - "hadSelection ref: the first (default) selection never clobbers typed text"
    - "Literal class lookup for selected/idle row styles (no template-built class names)"
key-files:
  created:
    - frontend/src/components/MainChart.tsx
  modified:
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/Dashboard.test.tsx
    - frontend/src/components/Watchlist.tsx
    - frontend/src/components/WatchlistRow.tsx
    - frontend/src/components/Watchlist.test.tsx
    - frontend/src/components/TradeBar.tsx
    - frontend/src/components/TradeBar.test.tsx
    - frontend/src/lib/format.ts
    - frontend/src/lib/format.test.ts
key-decisions:
  - "Default/fallback selection lives in a Watchlist effect on [tickers, selectedTicker, onSelect]; Dashboard only holds state"
  - "A selection change clears the trade message even when the first selection keeps typed text"
  - "Re-clicking the already selected row does not refill the trade ticker (accepted, flagged in the plan)"
requirements-completed: [TRADE-01, TRADE-02]
metrics:
  duration: ~15 min
  completed: 2026-10-16
commits: 3
plan_head_before: fc53b9aa54e1b40acb80d51fa3f263c82244d2a3
plan_head_after: 7880caaddb10764faf022475708354c11fa233c7
actuals:
  tokens: 9000
  tasks: 3
  commits: 3
---

# Phase 4 Plan 02: Watchlist selection into main chart and trade bar Summary

**One `selectedTicker` in Dashboard drives `main-chart[data-ticker]` and the trade ticker; rows are keyboard-selectable with `aria-current`, the first ticker is selected by default, a removed selection falls back, and typed trade text survives the default selection.**

## Accomplishments

- Task 1 (tracer): `MainChart` wrapper always mounted with `data-ticker` only when selected, caption strip with the ticker in `text-text`. `WatchlistRow` click selects, the `x` button stops propagation. `Watchlist` takes `selectedTicker`/`onSelect`. A Dashboard test drives the real modules: clicking `watchlist-row-NVDA` sets `data-ticker="NVDA"` and `trade-ticker` to `NVDA`. `renderWatchlist()` harness now wraps every Watchlist render.
- Task 2: `hadSelection` ref in `TradeBar`: first selection fills only an empty field, later ones overwrite, any selection change clears the error or fill line, no request is sent. Six new tests.
- Task 3: `signClass` in `format.ts` (WR-04 closed: +0.004% shows `0.00%` in `text-muted`). Row `tabIndex=0`, `aria-current`, Enter/Space with a `target === currentTarget` check, literal selected/idle class lookup (`bg-surface` / `hover:bg-surface/60`, ticker `text-accent` vs `text-text`). Default selection of `tickers[0]` and fallback after remove, including no selection after the last remove. 8 watchlist, 2 format and 1 Dashboard tests.

## Verification

- `npm --prefix frontend test`: 15 files, 187 tests pass (169 before the plan)
- `npm --prefix frontend run typecheck` and `run build` exit 0
- Gates `TRACER_OK` (`frontend/out/index.html` contains `data-testid="main-chart"`) and `SELECTION_SUITE_OK`
- Tracer feedback gate: automated `<verify>` re-run end-to-end after Task 1 and passed, then expanded.

## Deviations from Plan

None - plan executed exactly as written. Environment note: `npm --prefix frontend ci` was run once in the fresh worktree (no new packages).

## Known Stubs

None. The `MainChartBody` shows only the caption strip by design; Plan 04-03 adds the price, change, window text and plot.

## Threat Flags

None. T-04-06 (typed ticker survives first selection), T-04-07 (`stopPropagation` plus `currentTarget` check) and T-04-08 (selection sends no request) are implemented and each pinned by a test.

## Self-Check: PASSED

- FOUND: frontend/src/components/MainChart.tsx
- FOUND commits: 1d74f72, 444d38d, 7880caa
