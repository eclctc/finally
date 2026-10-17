---
phase: 05-ai-chat
plan: 05
subsystem: frontend
tags: [chat, collapse, rail, focus, react, vitest]
requires:
  - phase: 05-ai-chat
    provides: "05-01 ChatDock/useChat above the panel body; 05-02 send lifecycle and ChatDock.test.tsx"
provides:
  - "Panel optional `actions` slot in the title strip"
  - "ChatRail 40px collapsed rail with the expand button"
  - "ChatDock collapsed flag and toggle; conversation, draft, pending request and error survive collapse"
  - "ChatComposer autoFocus prop (focus returns to the composer after expand only)"
  - "testIds.chatToggle"
affects: [05-06]
tech-stack:
  added: []
  patterns: ["state hook kept above two sibling views so collapse unmounts only the view", "conditional autoFocus instead of effects/refs"]
key-files:
  created:
    - frontend/src/components/ChatRail.tsx
    - frontend/src/components/Panel.test.tsx
  modified:
    - frontend/src/components/Panel.tsx
    - frontend/src/components/ChatDock.tsx
    - frontend/src/components/ChatComposer.tsx
    - frontend/src/lib/testIds.ts
    - frontend/src/components/ChatDock.test.tsx
key-decisions:
  - "Collapse button is local to ChatDock.tsx and shares the chat-toggle testid with the rail button; only one is mounted at a time"
  - "Aside width switches between two full literal classes (w-[320px] / w-10); the layout change stays inside ChatDock, Dashboard.tsx untouched"
requirements-completed: [CHAT-01]
status: complete
duration: 8min
completed: 2026-10-16
commits: 2
plan_head_before: 3ee8ebfd1d217bec2106f7567c5aad5ca20ff2b5
plan_head_after: e1fa0eb096529129904e1e5f111680aec0e5d565
actuals:
  tokens: 5500
  tasks: 2
  commits: 2
---

# Phase 5 Plan 05: Collapsible chat panel Summary

The AI Chat dock opens expanded on load, collapses to a 40px rail and expands again with the transcript, draft, pending request and error intact, because `useChat` stays above both views in `ChatDock`.

## What was built

- Task 1 (tracer, `be25b7b`): `Panel` gains `actions` (rendered in `div.ml-auto` after the `h2`, absent otherwise). `ChatRail` renders `section[chat-panel][aria-label="AI Chat"]` holding one full-height `chat-toggle` button (`‹`, vertical 11px label). `ChatDock` flips a local `collapsed` flag between the rail (`w-10`) and the panel (`w-[320px]`) with the `›` collapse button passed as `actions`. `testIds.chatToggle` added. Test: send, type a draft, collapse, expand; bubbles and draft are back and `fetch` was called once.
- Task 2 (`e1fa0eb`): `ChatComposer` takes `autoFocus` (added in the Task 1 commit because `ChatDock` passes `autoFocus={toggled}` from the start); `toggled` flips on the first toggle, so nothing is focused on load, the rail button is focused after a collapse (its own `autoFocus`) and the composer after an expand. Tests pin: no focus on load / rail / composer; pending request still shown after a collapse-expand and a reply resolving while collapsed calls `onActionsApplied` once with its actions and both bubbles are present after expand; error block and draft survive; toggles never call `fetch`; `Panel` with and without `actions`.

Verification: 342 frontend tests pass (28 files), `tsc --noEmit` clean, `next build` succeeds, `out/index.html` contains `data-testid="chat-toggle"` (`TRACER_OK`). A temporary `autoFocus={false}` mutation made the focus test fail, confirming it is not vacuous; the file was restored.

## Deviations from Plan

None. The Task 2 behaviors (pending survival, error survival, panel slot) already held after Task 1 and are kept as regression pins. The composer `autoFocus` prop landed in the Task 1 commit instead of Task 2, so the Task 2 commit is tests only. `Dashboard.tsx` was not touched; the collapse is fully inside `ChatDock.tsx`'s own `aside`.

## Known Stubs

None.

## Threat Flags

None. T-05-12 mitigated: `useChat` sits above both views and the reply-while-collapsed test passes; T-05-SC: no new packages (`npm ci` only).

## Not verified here

Scroll position after expand and the real-browser focus/layout (UAT backstops).

## Self-Check: PASSED

Files ChatRail.tsx and Panel.test.tsx exist; commits be25b7b and e1fa0eb are in HEAD.
