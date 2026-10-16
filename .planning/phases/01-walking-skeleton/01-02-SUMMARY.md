---
phase: 01-walking-skeleton
plan: 02
subsystem: testing
tags: [vitest, react-testing-library, jsdom, recharts, testids, intl, fetch]

requires:
  - phase: 01-walking-skeleton
    provides: "Plan 01 frontend project with pinned vitest, jsdom, RTL and Recharts"
provides:
  - "npm test harness: Vitest + RTL under jsdom with ResizeObserver, EventSource and scrollIntoView stubs"
  - "Exported FakeEventSource double for later SSE tests"
  - "testIds module (single source of every E2E data-testid) with spec-parity test"
  - "Bare-number en-US formatters matching the E2E parseNumber rule"
  - "Same-origin request() fetch wrapper and ApiError"
affects: [01-03, phase-03, phase-04, phase-05, phase-06]

actuals:
  tokens: 3500
  tasks: 3
  commits: 5
plan_head_before: 4d7cc444ecdbe662c2c8fb1fad3a3bec9e7146fe
plan_head_after: 2a594c69e5017129a9f868d6d5c4b018b8fe4065

tech-stack:
  added: []
  patterns:
    - "One contract module (testIds) consumed by components, tests and a parity test over test/tests/*.spec.ts"
    - "Fixed en-US Intl formatters with cent rounding and -0 normalisation"
    - "jsdom stubs installed globally in vitest.setup.ts; tests reach the fake through globalThis"

key-files:
  created:
    - frontend/vitest.config.mts
    - frontend/vitest.setup.ts
    - frontend/src/test/harness.test.tsx
    - frontend/src/lib/testIds.ts
    - frontend/src/lib/testIds.test.ts
    - frontend/src/lib/format.ts
    - frontend/src/lib/format.test.ts
    - frontend/src/lib/api.ts
    - frontend/src/lib/api.test.ts
  modified: []

key-decisions:
  - "Spec directory in the parity test is resolved with path.resolve(__dirname, ...) because import.meta.url is not a file: URL under the jsdom environment"
  - "RED commits carry an empty skeleton module so RED fails on target assertions, not on a missing import"
  - "staticIds in the parity test is cast to string[] so the file type-checks under next build"

patterns-established:
  - "Contract-parity test: extract ids from Playwright specs by regex and assert coverage, with a minimum-count guard against vacuous passes"
  - "TDD for lib modules: test + skeleton (RED) then implementation (GREEN)"

requirements-completed: [FND-04, FND-05]

coverage:
  - id: D1
    description: "npm test runs the Vitest + RTL harness green; a component using ResizeObserver, EventSource and scrollIntoView renders a Recharts svg under jsdom"
    requirement: "FND-04"
    verification:
      - kind: unit
        ref: "frontend/src/test/harness.test.tsx (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every testid referenced by the 6 Playwright specs is covered by testIds, enforced by a parity test"
    requirement: "FND-05"
    verification:
      - kind: unit
        ref: "frontend/src/lib/testIds.test.ts (7 tests; removing the heatmap key makes it fail naming heatmap)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Formatters render bare cent-rounded numbers that the E2E parseNumber rule reads back exactly, with no signed zero"
    requirement: "FND-05"
    verification:
      - kind: unit
        ref: "frontend/src/lib/format.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "request() returns JSON on 2xx, ApiError with backend text on 400, and Request failed (404) for non-JSON bodies"
    requirement: "FND-05"
    verification:
      - kind: unit
        ref: "frontend/src/lib/api.test.ts"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-16
status: complete
---

# Phase 1 Plan 02: Test Harness, testIds Contract, Formatters and Fetch Wrapper Summary

**Vitest + RTL jsdom harness with ResizeObserver/EventSource/scrollIntoView stubs, a spec-guarded testIds module, cent-rounded bare-number formatters and a same-origin request() wrapper.**

## Performance

- **Duration:** 9 min
- **Completed:** 2026-10-16
- **Tasks:** 3
- **Files created:** 9

## Accomplishments

- `npm --prefix frontend test` runs 24 tests across 4 files, all green; typecheck and `next build` also pass with the test files present.
- The harness smoke test proves a Recharts `ResponsiveContainer` renders an svg, `FakeEventSource` records URLs and delivers `emit()` payloads, `open()/fail()/fail(true)` move `readyState` to 1/0/2, and `scrollIntoView` is stubbed.
- `testIds.ts` defines all 22 static ids and 4 per-ticker helpers. The parity test reads the 6 specs, asserts at least 6 files and 25 distinct ids, and fails naming any uncovered id (checked once by removing `heatmap`, then restored).
- `format.ts` meets the boundary, empty, precision and adjacency truths from the plan; `api.ts` passes the 200/400/non-JSON-404 cases and contains no absolute URL.

## TDD Evidence

### Task 2 (testIds)
- **RED:** commit `test(01-02): add failing testid contract and spec parity tests`. Run against an empty skeleton: 4 of 7 tests failed on the planned assertions (`expected '' to be 'trade-buy'`, `'chat-error'`, `'watchlist-row-AAPL'`, `'watchlist-row-'`). Semantic assessment: target tests executed and failed on the intended assertions, not on load or syntax errors. The parity test passed vacuously against the skeleton because every helper prefix was the empty string; it was then proven non-vacuous in GREEN by deleting `heatmap`.
- **GREEN:** commit `feat(01-02): implement E2E testid contract module`; 7/7 pass.
- **REFACTOR:** none.

### Task 3 (format, api)
- **RED:** commit `test(01-02): add failing tests for formatters and fetch wrapper`. 12 of 13 tests failed on assertions against empty skeletons (the one pass is the no-abbreviation check on an empty string). Semantic assessment: valid RED, failures are value assertions for the planned behavior.
- **GREEN:** commit `feat(01-02): implement bare-number formatters and same-origin fetch wrapper`; all pass.
- **REFACTOR:** none.

Note: `gsd_run check tdd-red-evidence` was not run (no TAP record was produced); RED was judged from the vitest failure output directly. Plan type is `execute`, not `tdd`, so no plan-level gate applies.

## Task Commits

1. Task 1: `0532196` test(01-02): add Vitest + RTL jsdom harness
2. Task 2 RED: test(01-02) failing testid contract and parity tests
3. Task 2 GREEN: feat(01-02) testid contract module
4. Task 3 RED: test(01-02) failing tests for formatters and fetch wrapper
5. Task 3 GREEN: `2a594c6` feat(01-02) formatters and fetch wrapper

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Parity test spec path under jsdom**
- **Found during:** Task 2 RED run
- **Issue:** `fileURLToPath(new URL("../../../test/tests", import.meta.url))` throws "The URL must be of scheme file" in the jsdom environment.
- **Fix:** Used `path.resolve(__dirname, "../../../test/tests")`, which is what RESEARCH.md originally suggested.
- **Files modified:** frontend/src/lib/testIds.test.ts

**2. [Rule 1 - Bug] Type predicate failed `tsc` on `testIds` values**
- **Found during:** Task 2 GREEN typecheck
- **Issue:** `filter((value): value is string => ...)` is not assignable because the literal-union element type excludes plain `string`.
- **Fix:** Filter with `typeof value === "string"` and cast to `string[]`.
- **Files modified:** frontend/src/lib/testIds.test.ts

**Total deviations:** 2 auto-fixed (both Rule 1, test-file only). **Impact:** none on the delivered contracts.

## Issues Encountered

- A plan-ledger file and one combined bash command were refused by the worktree sandbox; the plan base `4d7cc44` from the dispatch prompt was used for the measured commit count instead.
- `npm ci` printed an `allowScripts` warning for `fsevents`; no packages were added and package.json and the lockfile are unchanged.

## Known Stubs

None. The skeleton modules used in RED commits were replaced in GREEN.

## Threat Flags

None. No new network endpoints or trust boundaries; `api.ts` uses relative paths only (T-01-05 verified by grep).

## Next Phase Readiness

Plan 03 and Phases 3-5 can import `testIds`, `format` and `request` and write component tests on the harness. The jsdom stubs do not prove real-browser EventSource reconnect or ResizeObserver sizing; that stays with the Phase 3 spike and Phase 6 E2E (flagged assumption FND-04).

## Self-Check: PASSED

- All 9 created files exist; commits 0532196 and 2a594c6 are on HEAD; `git diff` of package.json and package-lock.json against the plan base is empty; `frontend/tsconfig.json` untouched.
