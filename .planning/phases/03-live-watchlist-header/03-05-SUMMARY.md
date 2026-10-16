---
phase: 03-live-watchlist-header
plan: 05
subsystem: ui
tags: [react, nextjs, vitest, playwright, watchlist, docker]

requires:
  - phase: 03-live-watchlist-header
    provides: useWatchlist load, WatchlistRow cells (03-02, 03-04), priceStore clearTicker/seedPrices (03-01)
provides:
  - Add-ticker form above the watchlist list (uppercased, trimmed POST, inline 400 text, scroll-into-view, focus handling)
  - Per-row remove button (DELETE with encoded ticker, silent 404, store cleanup, focus to add input)
  - Phase gate evidence: rebuilt image finally-phase3 passes fresh-start, sse-reconnect and watchlist add/remove E2E on a fresh tmpfs database
affects: [04-trading-portfolio, 06-ship-e2e-gate]

plan_head_before: e4f391a06d9aa017cc4c8f42292235e428543ca0
plan_head_after: 32e189cbe1ac615c1444512b15bb35844dcfd49e

actuals:
  tokens: 14000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "One shared error slot (add and remove) rendered as a React text node with role=alert"
    - "Reload after every mutation; seedPrices fills only absent tickers so streamed prices survive"
    - "scrollTarget state cleared after one scroll so later reloads never re-scroll"

key-files:
  created: []
  modified:
    - frontend/src/lib/useWatchlist.ts
    - frontend/src/components/Watchlist.tsx
    - frontend/src/components/WatchlistRow.tsx
    - frontend/src/components/Watchlist.test.tsx

key-decisions:
  - "No client-side length or pattern check on the add input; the backend 400 is shown verbatim"
  - "Focus returns to the add input after every remove (success or failure), one line and harmless"
  - "Reload scroll test uses two sequential adds to prove the first row is not re-scrolled; the remove variant is a separate Task 2 test"

patterns-established:
  - "Mutations in useWatchlist: set pending flag, clear error, request, load() in finally/after, clear pending"

requirements-completed: [LIVE-06, LIVE-07, LIVE-01, LIVE-02, LIVE-03, LIVE-04, LIVE-05, LIVE-08]

coverage:
  - id: D1
    description: "Add a ticker from the panel: uppercased, trimmed POST, row appears and scrolls into view, 400 shown inline as text"
    requirement: LIVE-06
    verification:
      - kind: unit
        ref: "frontend/src/components/Watchlist.test.tsx#Watchlist add form"
        status: pass
      - kind: e2e
        ref: "test/tests/watchlist.spec.ts#adding and removing a ticker updates the watchlist"
        status: pass
    human_judgment: false
  - id: D2
    description: "Remove a ticker with the row x without reload or confirmation; 404 silent; store history cleared; focus to add input"
    requirement: LIVE-07
    verification:
      - kind: unit
        ref: "frontend/src/components/Watchlist.test.tsx#Watchlist remove"
        status: pass
      - kind: e2e
        ref: "test/tests/watchlist.spec.ts#adding and removing a ticker updates the watchlist"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fresh start (10 rows, $10,000, connected, moving prices) and SSE reconnect pass in a real browser against the rebuilt container"
    requirement: LIVE-08
    verification:
      - kind: e2e
        ref: "test/tests/fresh-start.spec.ts and test/tests/sse-reconnect.spec.ts against finally-p3 on 127.0.0.1:8010"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual behavior jsdom cannot judge: flash fade, sparkline fill and color, dot colors on stop/start, 1280x720 fit, reduced motion"
    verification: []
    human_judgment: true
    rationale: "CSS transitions, layout fit and the live dot cycle need a person looking at a real browser (03-05 human-check, 03-UAT)"

duration: 4min
completed: 2026-10-16
status: complete
---

# Phase 3 Plan 05: Watchlist add/remove and phase gate Summary

**Watchlist add form (uppercased, inline backend 400 text, scroll-into-view) and per-row remove button, proven in a real browser against a freshly built container on a fresh tmpfs database**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-16T20:52:56Z
- **Completed:** 2026-10-16T20:57:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- LIVE-06: the add form sits in a `shrink-0` block above the list region. Input text is uppercased as typed and trimmed on submit, `POST /api/watchlist` runs once (Add disabled while pending or empty), the list reloads, the new row scrolls into view once and focus stays in the input. A 400 shows the backend text verbatim under the input as plain text (`role="alert"`, `aria-invalid`, `aria-describedby`, `border-down`); a network failure shows `Request failed. Try again.`
- LIVE-07: each row ends with a `×` button. `remove()` sends `DELETE /api/watchlist/{encodeURIComponent(ticker)}`, clears the ticker's store entry and history, and always reloads. A 404 is silent; other errors use the shared error slot. The button is disabled while its DELETE is in flight, and focus moves to the add input. The request list is pinned to DELETE then GET only, so positions are never touched.
- Reloads keep streamed prices and history because `seedPrices` only fills absent tickers (test: AAPL stays `200.00` when the reload returns 190).
- Phase gate: full suite (138 tests), typecheck and build pass; source gates print `GATES_OK`; image `finally-phase3` built from the unchanged Dockerfile; container `finally-p3` healthy on 127.0.0.1:8010 with `--tmpfs /app/db` and `LLM_MOCK=true`; Playwright reports 3 passed (fresh-start, sse-reconnect, adding and removing).

## Task Commits

1. **Task 1: Tracer, add a ticker** - `87e325c` (test, RED), `0765723` (feat, GREEN)
2. **Task 2: Remove a ticker** - `db54899` (test, RED), `32e189c` (feat, GREEN)
3. **Task 3: Phase gate** - no commit (verification only; image and container are runtime artifacts)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified
- `frontend/src/lib/useWatchlist.ts` - adds `error`, `adding`, `removing`, `add`, `remove`, `clearError`; local `errorMessage`
- `frontend/src/components/Watchlist.tsx` - add form, error line, `scrollTarget` effect, `handleRemove`, focus handling
- `frontend/src/components/WatchlistRow.tsx` - `removing` and `onRemove` props, `×` button as the last cell
- `frontend/src/components/Watchlist.test.tsx` - 20 new tests (add form and remove) on a path/method-routed fetch stub

## TDD Gate Compliance

Task 1 is `type="tracer"` and Task 2 is `tdd="true"`; the plan itself is `type: execute`, so the plan-level gate does not apply, but both tasks followed RED then GREEN.

- RED (Task 1): `87e325c`, 11 new tests failed because `watchlist-add-input` did not exist (`getByTestId` failure, the planned assertion target); the 15 existing tests still passed.
- GREEN (Task 1): `0765723`, 26/26 pass.
- RED (Task 2): `db54899`, 9 new tests failed because `watchlist-remove-*` did not exist; 26 prior tests passed.
- GREEN (Task 2): `32e189c`, 35/35 pass; full suite 138/138.
- No REFACTOR commit was needed. Evidence was inspected from the vitest report; the `check tdd-red-evidence` classifier was not run (vitest default reporter, plan not `type: tdd`).

## Decisions Made
- No length or pattern check on the add input, per plan, so the backend validator decides and its 400 is visible.
- Focus returns to the add input after every remove, success or failure (the UI-SPEC only specifies success).
- The Task 1 "scrolls once" test uses two successive adds (remove is not built yet in Task 1); a separate Task 2 test proves a remove reload does not scroll.

## Deviations from Plan

None - plan executed exactly as written. Environment note: `test/node_modules` was missing in the fresh worktree, so `npm --prefix test ci` was run as the project notes allowed (no package files edited).

## Issues Encountered
None. The Playwright run passed on the first attempt; no spec was changed (`git diff --name-only -- test/tests` is empty).

## Human check (pending, not performed)

The Task 3 `<human-check>` needs a person in a desktop browser at http://127.0.0.1:8010 and was NOT performed by this agent. `finally-p3` is left running for it (flash and fade, sparkline fill and color, dot green then yellow on `docker stop finally-p3` and green again after `docker start finally-p3`, 1280x720 fit of 10 rows plus the add form with Chart and Heatmap at least about 200px wide, add `dis`, inline `Invalid ticker: 'TOOLONGX'`, remove DIS, optional Reduce Motion). Afterwards run `docker rm -f finally-p3`. Note `finally-p1` on port 8000 was not touched.

## Threat Flags
None beyond the plan's threat model: T-03-11 (error text rendered as a React text node, tested with an `<img onerror>` payload, `dangerouslySetInnerHTML` gate clean), T-03-12 (`encodeURIComponent`, tested with `A/B`), T-03-13 (pending guards), T-03-14 (request list pinned), T-03-15 (published only on 127.0.0.1:8010, tmpfs database, `LLM_MOCK=true`).

## Known Stubs
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Phase 3 plans are complete pending the browser UAT on `finally-p3`. Phase 4 can reuse the `useWatchlist` mutation pattern and the shared test ids (`trade-*`, `position-row-*`).

## Self-Check: PASSED

- FOUND: frontend/src/lib/useWatchlist.ts, frontend/src/components/Watchlist.tsx, frontend/src/components/WatchlistRow.tsx, frontend/src/components/Watchlist.test.tsx
- FOUND commits: 87e325c, 0765723, db54899, 32e189c
- Suite 138/138, typecheck and build clean, GATES_OK, CONTAINER_OK, Playwright 3 passed

---
*Phase: 03-live-watchlist-header*
*Completed: 2026-10-16*
