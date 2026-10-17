---
phase: 05-ai-chat
plan: 03
subsystem: frontend
tags: [watchlist, chat, react, vitest, dashboard]
requires:
  - phase: 05-ai-chat
    provides: "Dashboard.applyChatActions, chat fixtures (plan 05-01)"
  - phase: 04-trading-portfolio
    provides: "useWatchlist latest-request guard (WR-05), clearTicker cleanup pattern"
provides:
  - "useWatchlist().load(): Promise<boolean> and WatchlistState type"
  - "Watchlist takes the hook result as a prop; Dashboard owns the one useWatchlist() call"
  - "chatEffects.removedTickers(actions)"
  - "applyChatActions clears removed tickers then awaits Promise.all([loadWatchlist(), refresh(), refreshHistory()])"
affects: [05-04]
tech-stack:
  added: []
  patterns: ["hook lifted into Dashboard and passed as a prop", "load resolves a boolean and never rejects"]
key-files:
  created:
    - frontend/src/lib/chatEffects.ts
    - frontend/src/lib/chatEffects.test.ts
    - frontend/src/lib/useWatchlist.test.tsx
  modified:
    - frontend/src/lib/useWatchlist.ts
    - frontend/src/components/Watchlist.tsx
    - frontend/src/components/Watchlist.test.tsx
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/Dashboard.test.tsx
key-decisions:
  - "A superseded watchlist load resolves false so a stale reload never triggers the AI highlight in 05-04"
  - "removedTickers lives in chatEffects.ts (not chat.ts) so plans 05-02 and 05-03 share no file"
requirements-completed: [CHAT-05]
status: complete
duration: 10min
completed: 2026-10-16
commits: 2
plan_head_before: ed444e211f34b620f3fe6b25d603874a4931ac40
plan_head_after: 518affd52942da9d326e1c0759a689841735544a
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
---

# Phase 5 Plan 03: Watchlist lift and AI removals Summary

The watchlist hook now lives in `Dashboard`, so an AI watchlist add shows its row with no reload and an AI removal cleans the price store exactly like a manual remove.

## What was built

- Task 1 (tracer, `bb9398b`): `useWatchlist` returns `load` and exports `WatchlistState`; `Watchlist` takes `watchlist` as a prop instead of calling the hook; `Dashboard` calls `useWatchlist()` once and `applyChatActions` awaits `Promise.all([loadWatchlist(), refresh(), refreshHistory()])`. The `renderWatchlist()` harness calls the hook and passes it in, no existing assertion changed. New Dashboard test: AI add of PYPL shows `watchlist-row-PYPL`, with exactly one `GET /api/watchlist` on load and two in total.
- Task 2 (`518affd`): `removedTickers` in `chatEffects.ts`; `load` returns `Promise<boolean>` (true when a list is applied, false on rejection, non-2xx, or when superseded by a newer load, keeping the Phase 4 latest-request guard); `Dashboard` calls `removedTickers(actions).forEach(clearTicker)` before the reload. Tests: five `removedTickers` cases, four `load` cases (true, rejected, 500, superseded), Dashboard ok-remove (store cleared, row gone, `main-chart[data-ticker]` AAPL to MSFT) and failed-remove (store kept, no second GET).

Verification: 313 frontend tests pass (3 consecutive runs), `tsc --noEmit` clean, `next build` succeeds, `out/index.html` contains `data-testid="watchlist"` (TRACER_OK, SUITE_OK).

## Deviations from Plan

None - plan executed as written, adapted to the post-Phase-4 `useWatchlist` as the orchestrator noted: the existing guard was kept and a superseded load returns `false`. The extra "superseded load resolves false" test is an addition covering that note. TDD RED was confirmed before each GREEN (Task 1 Dashboard test, Task 2 failing imports and `undefined` loads).

## Known Stubs

None.

## Threat Flags

None. T-05-07 (ticker only used as a Map key and text) and T-05-08 (overlapping loads, accepted) hold; no new packages (`npm ci` only).

## Self-Check: PASSED

All created files exist; commits `bb9398b` and `518affd` are ancestors of HEAD.
