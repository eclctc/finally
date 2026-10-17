---
phase: 05-ai-chat
plan: 01
subsystem: frontend
tags: [chat, react, vitest, dashboard]
requires:
  - phase: 04-trading-portfolio
    provides: lifted usePortfolio/usePortfolioHistory refresh, errorMessage/request in api.ts
provides:
  - "ChatAction/ChatReply types and describeAction chip copy"
  - "useChat hook (messages, attempt slot, draft, send)"
  - "ChatDock/ChatTranscript/ChatBubble/ChatComposer components"
  - "Dashboard.applyChatActions refresh wiring"
  - "chat fixtures in test/fixtures.ts"
affects: [05-02, 05-03, 05-04, 05-05, 05-06]
tech-stack:
  added: []
  patterns: ["hook owned above the panel body in ChatDock", "onActionsApplied called outside the try/catch"]
key-files:
  created:
    - frontend/src/lib/chat.ts
    - frontend/src/lib/chat.test.ts
    - frontend/src/lib/useChat.ts
    - frontend/src/components/ChatDock.tsx
    - frontend/src/components/ChatTranscript.tsx
    - frontend/src/components/ChatBubble.tsx
    - frontend/src/components/ChatBubble.test.tsx
    - frontend/src/components/ChatComposer.tsx
  modified:
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/Dashboard.test.tsx
    - frontend/src/test/fixtures.ts
key-decisions:
  - "Bubble component named ChatBubble to avoid clashing with the ChatMessage record type"
  - "Refresh portfolio and history together on any ok action; nothing on zero or all-failed replies"
requirements-completed: [CHAT-01, CHAT-03, CHAT-05]
status: complete
duration: 15min
completed: 2026-10-16
commits: 2
plan_head_before: 120688144f5055d0e4d814884338b2962883a308
plan_head_after: 212492f2a3e4c6c6ab405fcec08cca314316fd91
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
---

# Phase 5 Plan 01: Chat tracer and action chips Summary

Open AI Chat panel that posts to `/api/chat`, shows the reply with one inline chip per attempted action, and refreshes portfolio and P&L history after any successful action.

## What was built

- Task 1 (tracer, `4c2a8ca`): `chat.ts` types and `describeAction`, `useChat`, `ChatDock`/`ChatTranscript`/`ChatBubble`/`ChatComposer`, `Dashboard.applyChatActions` (`Promise.all([refresh(), refreshHistory()])` only when some action is `ok`), chat fixtures, and Dashboard tests for the buy path and the no-refetch path (zero actions, all failed).
- Task 2 (`212492f`): `chat.test.ts` copy table (eight cases plus a 120-character reason) and `ChatBubble.test.tsx` (roles, hidden sender names, zero/many actions, order, adjacency, empty message, hostile text).

Verification: 301 frontend tests pass, `tsc --noEmit` clean, `next build` succeeds and `out/index.html` contains `data-testid="chat-input"`.

## Deviations from Plan

None - plan executed as written. Task 2 tests passed on first run because the tracer already implemented the full `describeAction` table and bubble contract, as the plan's flagged assumptions anticipated. The kept Phase 4 `onUnconfirmed={refresh}` wiring on `TradeBar` is unchanged.

## Known Stubs

None. (Plan 05-02 will add the pending lock, loading line and Enter key; these are scoped to that plan.)

## Threat Flags

None. T-05-01 (hostile text) covered by the ChatBubble hostile-text test, T-05-02 by mixed-outcome tests, T-05-03 by calling `onActionsApplied` outside the try/catch.

## Self-Check: PASSED

All created files exist; commits `4c2a8ca` and `212492f` are ancestors of HEAD.
