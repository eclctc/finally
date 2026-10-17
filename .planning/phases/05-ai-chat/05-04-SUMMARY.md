---
phase: 05-ai-chat
plan: 04
subsystem: frontend
tags: [highlight, chat, react, vitest, useSyncExternalStore]
requires:
  - phase: 05-ai-chat
    provides: "applyChatActions awaiting three refresh booleans, chatEffects.removedTickers, lifted useWatchlist (plan 05-03)"
provides:
  - "aiChangeStore: module store of AI-changed rows, 1.5 s hold then 1 s fade, restart on repeat mark"
  - "useAiChange(kind, ticker) and aiHighlightClass(phase, resting) literal class lookup"
  - "aiChangeTargets(actions): ok trades to position rows, ok adds to watchlist rows"
  - "data-ai-changed on PositionRow and WatchlistRow; Dashboard marks rows only after all three refreshes resolve true"
affects: [05-06]
tech-stack:
  added: []
  patterns: ["per-row useSyncExternalStore with a primitive snapshot and a null server snapshot", "one background utility per row via a full-literal class lookup"]
key-files:
  created:
    - frontend/src/lib/aiChangeStore.ts
    - frontend/src/lib/aiChangeStore.test.ts
    - frontend/src/lib/useAiChange.ts
    - frontend/src/lib/useAiChange.test.tsx
  modified:
    - frontend/src/lib/chatEffects.ts
    - frontend/src/lib/chatEffects.test.ts
    - frontend/src/components/PositionRow.tsx
    - frontend/src/components/PositionsTable.test.tsx
    - frontend/src/components/WatchlistRow.tsx
    - frontend/src/components/Watchlist.test.tsx
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/Dashboard.test.tsx
    - frontend/vitest.setup.ts
key-decisions:
  - "No hover fill while a watchlist row is highlighted: the highlight class replaces bg-surface / hover:bg-surface/60, so a :hover variant cannot override the blue fill"
  - "Marks are set only when loadWatchlist, refresh and refreshHistory all resolve true"
requirements-completed: [CHAT-05]
status: complete
duration: 15min
completed: 2026-10-16
commits: 3
plan_head_before: 3ee8ebfd1d217bec2106f7567c5aad5ca20ff2b5
plan_head_after: a47c6817229313339bee7e26f99c8e32f0b1ef25
actuals:
  tokens: 14000
  tasks: 3
  commits: 3
---

# Phase 5 Plan 04: AI-change row highlight Summary

After an AI reply with successful actions has fully refreshed, the traded ticker's position row and an added ticker's watchlist row turn blue for 1.5 s and fade over 1 s, and nothing else is ever highlighted.

## What was built

- Task 1 (tracer, `856867d`): `aiChangeStore.ts` (phases, timers and listeners keyed `kind:ticker`; `markAiChanged` clears that key's timers, sets `hold`, schedules `fade` at 1,500 ms and removal at 2,500 ms), `useAiChange.ts` (`useSyncExternalStore` with primitive snapshot, `null` server snapshot; `aiHighlightClass` returning full literal strings), `aiChangeTargets` in `chatEffects.ts`, `data-ai-changed` on `PositionRow`, `resetAiChanges()` in `vitest.setup.ts`, and the marking line in `Dashboard.applyChatActions` after `Promise.all`. Dashboard test "an AI buy highlights the new position row" went red then green. Static export contains no `data-ai-changed`.
- Task 2 (`7057491`): store timing at 1,499/1,500/2,499/2,500 ms, restart, independent keys, listener count (hold, fade, removal) and unsubscribe, reset mid-window with no leaked timers; hook sequence and SSR null; the four class-lookup cases with a one-`bg-`-token check; the mixed `aiChangeTargets` case; PositionsTable mark, other-kind and expiry cases.
- Task 3 (`a47c681`): `WatchlistRow` splits Phase 4's two-entry lookup into a shared base plus one fill (`bg-surface` selected, `hover:bg-surface/60` idle), replaced by `aiHighlightClass(aiPhase, selected ? "surface" : "transparent")` while marked; `aria-current` untouched. Watchlist cases (add mark, other kind, selected-row single background and restore, idle-row hover fill drop and return) and Dashboard cases (add plus buy marks PYPL and the AAPL position but not watchlist AAPL, idempotent add marks existing row, failed history refresh marks nothing, failed add and ok remove mark nothing).

Verification: 368 frontend tests pass (two consecutive full runs), `tsc --noEmit` clean, `next build` succeeds, `out/index.html` has no `data-ai-changed`.

## Deviations from Plan

None - plan executed as written. TDD notes: Task 1 and Task 3 had a confirmed RED before GREEN. Task 2's tests passed on first run because the tracer already built the store and hook; a mutation check (removing the repeat-mark `clearTimeout`) made the restart test fail, confirming the cases are live.

## Known Stubs

None.

## Threat Flags

None. T-05-09 (timers cleared on repeat mark, removal and reset), T-05-10 (only ok trades and ok adds, only after three `true` refreshes) and T-05-11 (ticker used only as a Map key and React-escaped attribute) hold; no new packages (`npm ci` only).

## Open backstops (manual, UAT)

- Highlight visible but not louder than the price flash, no flicker at the end of the fade.
- Hovering a highlighted watchlist row keeps the blue fill; the hover fill returns after the window.

## Self-Check: PASSED

All created files exist; commits `856867d`, `7057491`, `a47c681` are ancestors of HEAD.
