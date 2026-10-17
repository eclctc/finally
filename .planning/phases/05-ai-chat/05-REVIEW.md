---
phase: 05-ai-chat
reviewed: 2026-10-16T20:30:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - frontend/src/components/ChatBubble.test.tsx
  - frontend/src/components/ChatBubble.tsx
  - frontend/src/components/ChatChips.tsx
  - frontend/src/components/ChatComposer.tsx
  - frontend/src/components/ChatDock.test.tsx
  - frontend/src/components/ChatDock.tsx
  - frontend/src/components/ChatRail.tsx
  - frontend/src/components/ChatTranscript.tsx
  - frontend/src/components/Dashboard.test.tsx
  - frontend/src/components/Dashboard.tsx
  - frontend/src/components/Panel.test.tsx
  - frontend/src/components/Panel.tsx
  - frontend/src/components/PositionRow.tsx
  - frontend/src/components/PositionsTable.test.tsx
  - frontend/src/components/Watchlist.test.tsx
  - frontend/src/components/Watchlist.tsx
  - frontend/src/components/WatchlistRow.tsx
  - frontend/src/lib/aiChangeStore.test.ts
  - frontend/src/lib/aiChangeStore.ts
  - frontend/src/lib/chat.test.ts
  - frontend/src/lib/chat.ts
  - frontend/src/lib/chatEffects.test.ts
  - frontend/src/lib/chatEffects.ts
  - frontend/src/lib/testIds.ts
  - frontend/src/lib/useAiChange.test.tsx
  - frontend/src/lib/useAiChange.ts
  - frontend/src/lib/useChat.ts
  - frontend/src/lib/useWatchlist.test.tsx
  - frontend/src/lib/useWatchlist.ts
  - frontend/src/test/fixtures.ts
  - frontend/vitest.setup.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-16T20:30:00Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

Reviewed the Phase 5 AI Chat frontend: chat components, `useChat`, the `aiChangeStore` highlight pipeline, the `useWatchlist` lift into `Dashboard`, and their tests. I cross-checked the `ChatAction` and `ChatReply` types against `backend/app/chat/service.py` (action shape, `status`, `price`, `error`) and against `usePortfolio`, `usePortfolioHistory` and `api.ts`. The wire contract matches. All model and server text renders as plain text nodes, so there is no XSS path, and the hostile-text test confirms it. The highlight store's timer logic (restart on repeat mark, cleanup) is correct.

No blockers. Three warnings are about behavior or test reliability that can mislead. I also ran a mutation check: with the `refreshed.every(Boolean)` guard removed from `Dashboard.applyChatActions` in a scratch copy, the "marks nothing when the history refresh fails" test fails as it should, so that test is not vacuous.

## Warnings

### WR-01: A lost chat response leaves the UI stale, and Send then replays the message (possible duplicate trades)

**File:** `frontend/src/lib/useChat.ts:40-43`
**Issue:** The `catch` branch treats every failure the same way: it shows the error, keeps the text, and does not refresh anything. A 502 is safe, because the backend executes and stores nothing. A network drop, a proxy timeout, or a `response.json()` failure on a 200 is different. Those arrive as non-`ApiError` failures, and the server may already have executed the trades and watchlist changes (`handle_chat_message` runs the actions before the response is written). In that case:
- The portfolio, history and watchlist stay stale until the next 30 s poll. Phase 4 WR-04 fixed exactly this for manual trades with `onUnconfirmed={refresh}`.
- The error copy tells the user "Your message was kept. Press Send to try again.", so a retry sends "buy 10 AAPL" again and executes it twice.

**Fix:** For failures that are not an `ApiError` (HTTP status known), call a refresh callback, and word the follow-up so it doesn't invite a blind retry. Sketch:
```ts
} catch (err) {
  setAttempt({ text, error: errorMessage(err) });
  if (!(err instanceof ApiError)) onUnconfirmed?.();   // Dashboard passes a refresh of watchlist, portfolio and history
  return;
}
```
For the unconfirmed case, change the follow-up text to something like "The request did not confirm. Check your positions before retrying."

### WR-02: A superseded watchlist load is reported as failure, which silently drops the AI highlight

**File:** `frontend/src/lib/useWatchlist.ts:25` and `frontend/src/components/Dashboard.tsx:45-47`
**Issue:** `load()` now returns `false` both when the request fails and when a newer load started and replaced it. `Dashboard.applyChatActions` skips every highlight unless all three refreshes return `true`. If a newer load overlaps the chat reload, for example a manual add or remove (each runs `await load()`), the chat load returns `false` even though the freshest list was applied. The AI-changed rows are then never marked. `usePortfolio.refresh` and `usePortfolioHistory.refresh` return `true` when superseded, so the three sources use different semantics under one `Promise<boolean>` contract. The JSDoc on `load` documents the divergence but does not make it correct.
**Fix:** Make superseded count as success, which is consistent with the other two hooks. The newer load carries the fresh data, so the highlight is still valid:
```ts
if (latestLoad.current !== mine) return true;   // a newer load owns the state
```
Update `useWatchlist.test.tsx` ("resolves false for a load superseded...") and the JSDoc to match.

### WR-03: The chip `disabled` guard is unreachable, and its test greps the source file instead of testing behavior

**File:** `frontend/src/components/ChatChips.tsx:18` and `frontend/src/components/ChatDock.test.tsx:320-324`
**Issue:** `ChatChips` renders only when `messages.length === 0 && attempt === null` (`ChatTranscript.tsx:26`). `chat.pending` requires `attempt !== null`, so `chat.pending` is always `false` whenever a chip is on screen. `disabled={chat.pending}` and `disabled:opacity-50` are dead code. The test "the chip source disables chips while a reply is pending" does not exercise anything. It reads `ChatChips.tsx` with `readFileSync` and asserts that two strings are present, so it passes while verifying nothing about behavior and would break on any harmless refactor of the file.
**Fix:** Delete the `disabled` prop and the `disabled:opacity-50` class from the chips, and delete the source-grep test. The double-send protection that matters lives in `useChat`'s `inFlight` ref and is already covered by "sends one request for two synchronous submits".

## Info

### IN-01: A chip click overwrites an unsent draft and the success path then clears it

**File:** `frontend/src/components/ChatChips.tsx:19-21` and `frontend/src/lib/useChat.ts:52`
**Issue:** The empty-state chips stay visible while the user types, because `messages` and `attempt` are still empty. Clicking a chip replaces the typed draft with the chip text, and after the reply `setDraft("")` clears it, so the typed text is lost. A chip click does not need to write into the draft at all.
**Fix:** Drop `chat.setDraft(prompt)` and have `send` clear the draft only if it still equals the text it sent. Alternatively, leave the draft alone for chip sends. Update the "keeps the label in the composer" assertions in `ChatDock.test.tsx` accordingly.

### IN-02: The `onActionsApplied` promise is dropped, and its type hides that

**File:** `frontend/src/lib/useChat.ts:20,53` and `frontend/src/components/ChatDock.tsx:13`
**Issue:** `Dashboard.applyChatActions` is `async`, but the hook and `ChatDock` type the callback as `=> void`. `send` therefore fires it without awaiting or catching. Today nothing in it can reject (`load`, `refresh` and `refreshHistory` all catch), but a throw from `clearTicker` or `markAiChanged` would surface as an unhandled rejection.
**Fix:** Type the callback as `(actions: ChatAction[]) => void | Promise<void>`, or `void` the call explicitly and document that it never rejects.

### IN-03: Low-value and duplicated test and style constants

**File:** `frontend/src/lib/chat.test.ts:56-58`, `frontend/src/lib/aiChangeStore.test.ts:17-20`, `frontend/src/components/ChatComposer.tsx:7-10`
**Issue:**
- `"has a chip test id"` asserts that a constant equals its own literal, and `"exposes the hold and fade durations"` does the same.
- `TEXTAREA_CLASS` and `TEXTAREA_PENDING_CLASS` are two copies of one long class string that differ only by `opacity-60`.
- `useAiChange.test.tsx` class-token assertions are string checks and can pass while the CSS is wrong.

**Fix:** Remove the tautological tests. Build the pending class as `` `${TEXTAREA_CLASS}${pending ? " opacity-60" : ""}` ``, and keep a single source for the class string.

### IN-04: Retry sends the live draft, not the failed attempt

**File:** `frontend/src/components/ChatComposer.tsx:16,22` and `frontend/src/components/ChatTranscript.tsx:30,39`
**Issue:** After a failure the error panel says "Your message was kept", but the Send action submits `chat.draft`. If the user edits the draft first, the failed bubble is replaced by the edited text on the next send. A test ("the error stays until the next send starts") encodes this. The wording is inaccurate once the draft has been edited, but there is no data loss.
**Fix:** Either word the follow-up as "Edit and press Send to try again", or keep the draft locked to `attempt.text` until the user clears the error.

---

_Reviewed: 2026-10-16T20:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
