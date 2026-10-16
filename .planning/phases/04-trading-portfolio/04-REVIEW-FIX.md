---
phase: 04-trading-portfolio
fixed_at: 2026-10-16T20:00:00Z
review_path: /Users/brett/Projects/finally/.planning/phases/04-trading-portfolio/04-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-10-16T20:00:00Z
**Source review:** `.planning/phases/04-trading-portfolio/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01..WR-05; fix_scope critical_warning, no critical findings)
- Fixed: 5
- Skipped: 0

Edits and commits were made directly on branch `finally-gsd` (no worktree, per the caller). Verification ran in the main checkout: `npm --prefix frontend test` x3 (22 files, 281 tests, all passed), `run typecheck` clean, `run build` succeeded. A final 14-process concurrent run of the full suite had 0 failures.

## Fixed Issues

### WR-01: Dashboard test "selects the first watchlist ticker on a fresh load" races an effect-synced render (reproduced flake)

**Files modified:** `frontend/src/components/TradeBar.tsx`, `frontend/src/components/Dashboard.test.tsx`
**Commit:** ffc40ac (shared with WR-03, one root cause)
**Applied fix:** `TradeBar` now adjusts the ticker state during render (`seenSelection` state) instead of in a `useEffect`, so the input is updated in the same commit as the chart's `data-ticker`. The test also uses `waitFor` for the input value.

Evidence (concurrent `vitest run Watchlist.test.tsx Dashboard.test.tsx`):
- Before: 8/12, 19/20 and 17/20 runs failed; the Dashboard test failed in 43 of 52 runs.
- Component fix alone (test change temporarily stashed): 0/20 failed. The fix removes the one-render lag rather than hiding it in the test.
- After both changes: 0/60 failed (in the WR-02 runs below).

### WR-03: `TradeBar` selection sync reads and writes a mutable ref inside a state updater

**Files modified:** `frontend/src/components/TradeBar.tsx`
**Commit:** ffc40ac
**Applied fix:** The `hadSelection` ref is gone. "First selection" is derived from `seenSelection === null`, so the typed-text-survives-first-selection rule no longer depends on when React evaluates an updater. The existing TradeBar selection tests still pass. One small behavioural difference: if the selection returns to `null` (watchlist emptied) and then to a ticker, that counts as a first selection again and keeps typed text, as the review snippet specifies.

### WR-02: Store-driven Watchlist and Dashboard tests assert synchronously after `act` on timing they do not control

**Files modified:** `frontend/src/components/Watchlist.test.tsx`, `frontend/src/components/Dashboard.test.tsx`
**Commit:** 5cd2102
**Applied fix:** `streamTick` in `Watchlist.test.tsx` is now async and flushes pending effects (`await act(async () => {})`) before merging the frame, so freshly committed rows have subscribed to the price store. All call sites await it. The explicit `act(mergeFrame ...)` test and the Dashboard stream test flush the same way. No sleeps or retries were added.

Evidence: before, 4 failures in 40 concurrent runs (the placeholder `--` was seen instead of the streamed price, in `leaves other rows unchanged`, `shows 0.00% in text-muted` and `computes (price - open) / open`). After, 0 failures in 60 concurrent runs (3 x 20 processes).

The 50 ms flash-lifetime race named in the review (`orders the row cells...`) did not reproduce in any run before or after. The assertion follows the tick synchronously, so the flash timer cannot fire between them. I left it unchanged rather than add fake timers for a failure I could not prove.

### WR-04: A failed trade request tells the user to "Try again" without checking whether it filled

**Files modified:** `frontend/src/components/TradeBar.tsx`, `frontend/src/components/Dashboard.tsx`, `frontend/src/components/TradeBar.test.tsx`
**Commit:** 2272d25
**Applied fix:** `TradeBar` takes a new required `onUnconfirmed` prop. When the request fails with anything other than an `ApiError` (fetch rejection, unparseable 2xx body), it calls `onUnconfirmed` and shows "Could not confirm the order. Portfolio refreshed; check Positions before retrying." `Dashboard` passes `usePortfolio().refresh`. `ApiError` (server rejection) behaves as before. No retries or idempotency keys. Tests: the fetch-rejection test now asserts the new message and one `onUnconfirmed` call; a new test asserts a server 400 does not refresh. The shared `NETWORK_ERROR` copy in `api.ts` is unchanged (the watchlist still uses it).

### WR-05: One failed watchlist reload replaces an already loaded list with "Reload the page"; reloads are unordered

**Files modified:** `frontend/src/lib/useWatchlist.ts`, `frontend/src/components/Watchlist.test.tsx`
**Commit:** 1db198c
**Applied fix:** All inside the hook. `load` has a `latestLoad` ref generation guard (a superseded response is ignored, and so is its failure). The hook returns `loadFailed: loadFailed && tickers === null`, so a failed reload never hides a loaded list. The public shape and the Watchlist component are unchanged. Two new tests (a failed reload after an add keeps the list; an older reload resolving late is ignored) fail without the fix (checked by stashing the hook change) and pass with it.

Interaction with Phase 5 plan 05-03 (lifts `useWatchlist` into `Dashboard`, exposes `load`, makes it return `Promise<boolean>`): compatible. The guard is inside `load`'s body and its `useCallback(..., [])` identity is unchanged. When 05-03 adds the boolean return, note that a superseded load now returns early (before `setTickers`). It should return `false`, or its own success, as 05-03 intends. 05-04 uses this value to skip the highlight, and a superseded load did not apply its result. 05-03 may also read `loadFailed` as before; it is now "failed and never loaded".

## Skipped Issues

None.

## Notes

- Info findings (IN-01..IN-08) were out of scope (`fix_scope: critical_warning`) and are untouched.
- Nothing under `test/tests/`, `.planning/` (other than this file) or `backend/` was modified. This file is not committed, per instructions.

---

_Fixed: 2026-10-16T20:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
