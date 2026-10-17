---
phase: 05-ai-chat
fixed_at: 2026-10-16T20:50:00Z
review_path: .planning/phases/05-ai-chat/05-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-10-16T20:50:00Z
**Source review:** `.planning/phases/05-ai-chat/05-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

**Verification:** all gates ran in the main checkout (no worktree; the orchestrator asked for the absolute `npm --prefix /Users/brett/Projects/finally/frontend` gates, and a worktree has no `node_modules`). After the last commit: `npm --prefix frontend test` 374 passed (30 files), `run typecheck` clean, `run build` succeeded. Info findings IN-01..IN-04 are out of scope and untouched.

## Fixed Issues

### WR-01: A lost chat response leaves the UI stale, and Send then replays the message (possible duplicate trades)

**Files modified:** `frontend/src/lib/useChat.ts`, `frontend/src/components/ChatDock.tsx`, `frontend/src/components/ChatTranscript.tsx`, `frontend/src/components/Dashboard.tsx`, `frontend/src/components/ChatDock.test.tsx`, `frontend/src/components/Dashboard.test.tsx`
**Commit:** c69d84f
**Applied fix:** Mirrors Phase 4 WR-04 (`TradeBar` `onUnconfirmed`). `useChat` takes a required second argument `onUnconfirmed`; `ChatDock` takes a required `onUnconfirmed` prop. A failure that is not an `ApiError` (fetch rejection, unparseable 2xx body) sets `ChatAttempt.unconfirmed = true`, shows "Could not confirm the request." and the follow-up "Data refreshed. Check your positions and watchlist before sending again.", and calls `onUnconfirmed`. `Dashboard` passes `refreshAll`, which reloads the watchlist, portfolio and history. It marks no AI highlight, because the applied actions are unknown. A real 502 (`ApiError`) is unchanged: server error text, "Your message was kept. Press Send to try again.", draft kept, no refresh. The draft is still kept for a lost response, so the user can resend after checking. No retry or idempotency key was added.
Tests (written first and seen failing before the change): the ChatDock network-failure test now asserts the new copy, the draft kept, and exactly one `onUnconfirmed`; the 502 test asserts `onUnconfirmed` is not called; a new Dashboard test sends a chat whose POST rejects and asserts watchlist, portfolio and history are each fetched twice, the new position row appears, and no row is highlighted.
Note: this is a behaviour change, so a quick human look at the copy is worthwhile. Logic is covered by the tests above.

### WR-02: A superseded watchlist load is reported as failure, which silently drops the AI highlight

**Files modified:** `frontend/src/lib/useWatchlist.ts`, `frontend/src/lib/useWatchlist.test.tsx`
**Commit:** a8beba4
**Applied fix:** A superseded `load()` now resolves `true`. Evidence for the choice: `usePortfolio.refresh` and `usePortfolioHistory.refresh` both return `true` after a successful response even when a newer request owns the state, and return `false` only on failure. The watchlist was the odd one out. The newer load still applies the fresh list (the existing test still asserts `tickers` stays `["FRESH"]`), so the AI highlight is valid. A superseded load that fails still returns `false`, as in the other two hooks. The JSDoc and the test name/assertion ("resolves true for a load superseded...") were updated; the test failed before the change.

### WR-03: The chip `disabled` guard is unreachable, and its test greps the source file instead of testing behavior

**Files modified:** `frontend/src/components/ChatChips.tsx`, `frontend/src/components/ChatDock.test.tsx`
**Commit:** 0b97f4f
**Applied fix:** Removed the dead `disabled={chat.pending}` prop and the `disabled:opacity-50` class (chips render only when `messages` is empty and there is no attempt, so `pending` is always false there). Deleted the `readFileSync` source-grep test and its two now-unused imports. Double-send protection stays in `useChat`'s `inFlight` ref, covered by the existing "sends one request for two synchronous submits" test. Chosen over a behavioural test because there is no reachable state to test.

---

_Fixed: 2026-10-16T20:50:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
