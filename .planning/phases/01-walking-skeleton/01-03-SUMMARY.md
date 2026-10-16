---
phase: 01-walking-skeleton
plan: 03
subsystem: ui
tags: [nextjs, react, tailwind, vitest, docker, dashboard-shell]
status: complete

requires:
  - phase: 01-walking-skeleton
    provides: "Plan 01 Next.js project, theme tokens and Dockerfile; Plan 02 testIds, formatters and request() wrapper; backend GET /api/portfolio"
provides:
  - "Header showing real cash and total value from GET /api/portfolio, bare formatted numbers, -- while loading, alert on failure"
  - "Panel component and Dashboard terminal grid with seven titled panels and wrapper testids"
  - "page.tsx rendering Dashboard"
  - "Rebuilt finally-phase1 image served by container finally-p1 on :8000 (left running)"
affects: [phase-03, phase-04, phase-05]

actuals:
  tokens: 5500
  tasks: 2
  commits: 4
plan_head_before: 464840f2f7c541fe77a746d20548f8bd65d5a717
plan_head_after: 9ffb4933a5fd6d272b79c57ff519f4c287847335

tech-stack:
  added: []
  patterns:
    - "Every data-testid set from testIds via JSX expression; no string literals"
    - "Header owns its single mount-time fetch; Dashboard stays layout-only"

key-files:
  created:
    - frontend/src/components/Header.tsx
    - frontend/src/components/Header.test.tsx
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/Dashboard.test.tsx
    - frontend/src/components/Panel.tsx
  modified:
    - frontend/src/app/page.tsx

key-decisions:
  - "Phase 1 connection dot is a static disconnected/bg-down state; LIVE-02 in Phase 3 wires it"
  - "No watchlist-row-* or main-chart testid attached anywhere (specs count and read them in later phases)"

patterns-established:
  - "Label/figure pairs: label span sibling of the testid figure span so parseNumber reads a bare number"
  - "Panel body is min-h-0 flex-1 overflow-y-auto; panels own their own scroll"

requirements-completed: [FND-02, FND-03, FND-05]

duration: 10min
completed: 2026-10-16
---

# Phase 1 Plan 3: Dashboard Shell Summary

**Dark terminal shell with a header that reads real cash and total value from SQLite via `/api/portfolio`, served by the rebuilt container at :8000.**

## Performance

- **Duration:** about 10 min
- **Tasks:** 2 (both TDD: RED then GREEN commits)
- **Files:** 6 created/modified under `frontend/src`

## Accomplishments

- `Header` fetches the relative URL `/api/portfolio` once on mount; `cash-balance` and `total-value` hold only `--` or the `formatCurrency` output, labels are sibling elements.
- `Panel` and `Dashboard` implement the Layout Contract grid: Watchlist | Chart, Trade, Heatmap, P&L, Positions | AI Chat column.
- Container check: `/api/health` returns `"status":"ok"`, `/api/portfolio` returns `"cash_balance":10000.0`, and `/` serves the shell with the header figures and wrapper testids (`watchlist`, `heatmap`, `pnl-chart`, `positions-table`, `chat-panel`, `cash-balance`, `total-value`, `connection-status`).
- Verification: full unit suite 35/35, typecheck clean, `next build` ok, GATES_OK, SUITE_OK, CONTAINER_OK.

## Task Commits

1. Task 1 RED: `e17a8de` test(01-03): failing Header tests
2. Task 1 GREEN: `f3e8877` feat(01-03): Header, minimal Dashboard, page.tsx
3. Task 2 RED: `4b610fc` test(01-03): failing Dashboard tests
4. Task 2 GREEN: `9ffb493` feat(01-03): Panel and Dashboard grid

## UI-SPEC Deltas Applied

All five deltas from `01-UI-SPEC.md` "Deviations and Reconciliations" were applied; no testid or figure content changed:

1. `Panel` title `h2`: `text-[11px] font-semibold truncate` (instead of `text-[12px] font-medium`).
2. `leading-tight` added to the wordmark and to the `total-value` figure.
3. Connection dot `aria-label` equals its `title` (`Disconnected`).
4. Header `failed` state: `.catch(() => setFailed(true))` renders `<span role="alert">Portfolio unavailable. Reload the page to try again.</span>` as the first child of the right group; figures keep `--`. One extra Header test with fetch rejecting.
5. `Panel` title strip uses `px-2` instead of `px-3`.

## Deviations from Plan

None beyond the five binding UI-SPEC deltas above. Small additions consistent with the spec: `whitespace-nowrap`/`shrink-0` on the figures (UI-SPEC overflow rows) and `overflow-y-auto` on the panel body (UI-SPEC "each panel body owns its scroll").

## Issues Encountered

None. `npm ci` was run first (fresh worktree); no package files changed.

## Known Stubs

Panels render only their title strip and an empty body by design (UI-SPEC: no placeholder copy). Later phases fill them: Watchlist/Chart (3-4), Trade/Heatmap/P&L/Positions (4), AI Chat (5). The connection dot is intentionally static `disconnected` until Phase 3.

## Threat Flags

None.

## Container State

The `finally-p1` container (image `finally-phase1`) is LEFT RUNNING on host port 8000 for the end-of-phase browser check. Stop with `docker stop finally-p1`.

## Self-Check: PASSED

- Files exist: Header.tsx, Header.test.tsx, Dashboard.tsx, Dashboard.test.tsx, Panel.tsx, page.tsx
- Commits e17a8de, f3e8877, 4b610fc, 9ffb493 are in HEAD history
