---
phase: 03-live-watchlist-header
plan: 02
subsystem: ui
tags: [react, recharts, tailwind, css-transition, vitest, fake-timers]

requires:
  - phase: 03-live-watchlist-header
    provides: priceStore (entry.flash, capped history), usePrice hooks, WatchlistRow, test fixtures
provides:
  - FlashingPrice cell that tints green or red for 50 ms on a real move and fades over 500 ms by CSS transition
  - 64x20 Recharts Sparkline colored by net direction, empty box under 2 points
  - WatchlistRow cell order ticker, price, change, sparkline
affects: [03-04, 03-05]

actuals:
  tokens: 3000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Flash direction is read only from the store's raw-price entry.flash, never from the frame direction"
    - "Full literal Tailwind class strings in module constants (FLASH_CLASS, IDLE_CLASS); no template-built class names"
    - "Fixed-size Recharts LineChart (no ResponsiveContainer) inside a fixed-size wrapper div"

key-files:
  created:
    - frontend/src/components/FlashingPrice.tsx
    - frontend/src/components/FlashingPrice.test.tsx
    - frontend/src/components/Sparkline.tsx
    - frontend/src/components/Sparkline.test.tsx
  modified:
    - frontend/src/components/WatchlistRow.tsx

key-decisions:
  - "Sparkline renders a fixed width/height LineChart; the jsdom assumption A4 held, so no ResponsiveContainer fallback was needed"
  - "No-focus-stop test asserts no tabindex other than -1, because Recharts layer groups carry tabindex=-1 (not a tab stop)"

patterns-established:
  - "Probe components render a leaf (FlashingPrice, Sparkline) against the real store, so leaf tests do not depend on WatchlistRow props"

requirements-completed: [LIVE-04, LIVE-05]

duration: 6min
completed: 2026-10-16
status: complete
plan_head_before: 15b08937fa3c75cb38f2334584171669b95b2a89
plan_head_after: 62da4dec82147b777f550883a2526b1a3d66bd8b
commits: 4

coverage:
  - id: D1
    description: "Price cell flashes up or down only on a real move, holds 50 ms, then fades via CSS transition; reduced motion paints nothing"
    requirement: LIVE-04
    verification:
      - kind: unit
        ref: "frontend/src/components/FlashingPrice.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each row shows a 64x20 sparkline of the capped since-load history, colored by net move, empty box under 2 points"
    requirement: LIVE-05
    verification:
      - kind: unit
        ref: "frontend/src/components/Sparkline.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 50 ms flash is actually visible in Chromium, Firefox and Safari and the 500 ms fade looks right"
    requirement: LIVE-04
    verification: []
    human_judgment: true
    rationale: "Paint timing across browsers cannot be asserted under jsdom; checked visually at the Plan 03-05 UAT (03-RESEARCH A2)"
---

# Phase 3 Plan 02: Price Flash and Row Sparkline Summary

**Watchlist price cell flashing green or red for 50 ms on real raw-price moves then fading over 500 ms by CSS transition, plus a fixed 64x20 Recharts sparkline per row colored by net move from the capped store history.**

## Performance

- **Duration:** 6 min
- **Tasks:** 2 (1 tracer, 1 TDD auto)
- **Files:** 4 created, 1 modified

## Accomplishments

- `FlashingPrice` reads `entry.flash` (computed in the store from raw prices) and keeps one 50 ms timer per cell, restarted or cleared on every new entry. Repeat frames, equal prices and first values never flash, even when the frame `direction` says `up`. The text stays `text-text`; flash classes carry `motion-reduce:bg-transparent` and the idle class `motion-reduce:transition-none`.
- `Sparkline` is a 64x20 `LineChart` with zero margin, `accessibilityLayer={false}`, hidden `YAxis` over `dataMin..dataMax`, and a 1.5px undotted, unanimated line. Stroke is `var(--color-up|down|muted)` by last vs first point. Under 2 points it renders the same empty `h-5 w-16` box, so the 28px row height never changes.
- `WatchlistRow` now composes ticker, `FlashingPrice`, change, `Sparkline`.
- 17 new tests (10 flash, 7 sparkline); full suite 11 files, 92 tests pass; typecheck and `next build` pass.

## RED / GREEN Evidence

- Task 1 RED: `FlashingPrice.test.tsx` against a stub that renders the bare price: 6 of 10 failed on the planned assertions (`data-flash` and class checks); the 4 no-flash cases passed against the stub by design. Importing a missing module was first rejected as INVALID_RED, so a minimal stub was committed with the test.
- Task 2 RED: `Sparkline.test.tsx` against an empty-div stub: 6 of 7 failed on class, stroke and line assertions.
- GREEN: both files fully pass after the implementations.

## Task Commits

1. **Task 1 RED** - `63c89d1` (test)
2. **Task 1 GREEN: tracer, flash cell wired into the row** - `00feb61` (feat)
3. **Task 2 RED** - `a48fd57` (test)
4. **Task 2 GREEN: sparkline wired into the row** - `62da4de` (feat)

Tracer gate: the tracer `<verify>` carried only automated checks (default end-of-phase mode), so it was re-run end to end (FlashingPrice and Dashboard tests, `FLASH_GATES_OK`); it passed and expansion continued.

## Decisions Made

- Fixed-size `LineChart` renders under jsdom (Assumption A4 confirmed), so there is no `ResponsiveContainer`.
- `FLASH_HOLD_MS = 50` as planned; the Firefox/Safari paint risk (A2) stays a visual check for the 03-05 UAT.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] "No tabindex" test assertion was too strict**
- **Found during:** Task 2 GREEN
- **Issue:** The behavior said no element in the sparkline has a `tabindex` attribute. Recharts 3 puts `tabindex="-1"` on its internal zIndex layer `g` elements even with `accessibilityLayer={false}`. A `-1` is programmatically focusable only, not a keyboard tab stop, so the plan's intent (no focus stop) holds. Evidence: the rendered markup was dumped and every tabindex was `-1`.
- **Fix:** The test selects `[tabindex]:not([tabindex="-1"])` and expects none.
- **Files modified:** `frontend/src/components/Sparkline.test.tsx`
- **Committed in:** `62da4de`

**2. [Rule 3 - Blocking] Stub component added to the RED commits**
- **Found during:** Task 1 and Task 2 RED
- **Issue:** A test importing a nonexistent module fails at load (not a valid RED).
- **Fix:** Committed a minimal stub next to each test so the target tests execute and fail on assertions.
- **Files modified:** `FlashingPrice.tsx`, `Sparkline.tsx` (stubs, replaced in GREEN)
- **Committed in:** `63c89d1`, `a48fd57`

---

**Total deviations:** 2 auto-fixed (1 bug in a test assertion, 1 blocking RED-validity measure)
**Impact on plan:** None on shipped behavior; no scope creep.

## Issues Encountered

None. The Dashboard `findByTestId` flake noted in Wave 1 did not recur.

## Known Stubs

None. The RED-phase stubs were replaced in GREEN.

## Threat Flags

None. No new network surface, endpoints or packages; T-03-05 mitigated (one timer per cell, cleared on each new entry and on unmount).

## Next Phase Readiness

Plan 03-05 adds the remove control to `WatchlistRow` (keep cell order) and owns the visual check of the 50 ms flash in Firefox and Safari; if it does not paint, raise `FLASH_HOLD_MS` to 100.

## Self-Check: PASSED

- Created files exist on disk; commits `63c89d1`, `00feb61`, `a48fd57`, `62da4de` are ancestors of HEAD.
- Acceptance greps pass: `FLASH_GATES_OK`, `ROW_SUITE_OK`.
