---
phase: 05-ai-chat
plan: 02
subsystem: frontend
tags: [chat, react, vitest, send-lifecycle]
requires:
  - phase: 05-ai-chat
    provides: "05-01 useChat, ChatDock, ChatTranscript, ChatComposer, ChatBubble"
provides:
  - "502/network error follow-up line and resend-replaces-attempt behaviour pinned"
  - "Thinking line, readOnly composer lock, in-flight ref guard, Enter / Shift+Enter / IME handling"
  - "QUICK_PROMPTS, testIds.chatChip, ChatChips empty state"
  - "Transcript scroll-to-newest sentinel"
  - "ChatDock.test.tsx (19 cases) against the real ChatDock"
affects: [05-05]
tech-stack:
  added: []
  patterns: ["useRef in-flight guard alongside derived pending flag", "two full literal class strings chosen by pending (Tailwind scanning)"]
key-files:
  created:
    - frontend/src/components/ChatChips.tsx
    - frontend/src/components/ChatDock.test.tsx
  modified:
    - frontend/src/lib/useChat.ts
    - frontend/src/lib/chat.ts
    - frontend/src/lib/chat.test.ts
    - frontend/src/lib/testIds.ts
    - frontend/src/components/ChatTranscript.tsx
    - frontend/src/components/ChatComposer.tsx
key-decisions:
  - "Textarea is readOnly (never disabled) while pending so focus and text survive"
  - "Chips unmount once an attempt exists; their disabled state is pinned by a source assertion"
requirements-completed: [CHAT-01, CHAT-02, CHAT-04, CHAT-06]
status: complete
duration: 10min
completed: 2026-10-16
commits: 3
plan_head_before: ed444e211f34b620f3fe6b25d603874a4931ac40
plan_head_after: a43bb56c18a5feac8994cacb65c9e9884d9792e3
actuals:
  tokens: 9000
  tasks: 3
  commits: 3
---

# Phase 5 Plan 02: Chat send lifecycle Summary

A failed chat send shows the backend sentence inline and keeps the text, a pending send shows `Thinking...` behind a locked composer and a one-request guard, and an empty chat offers three safe starter chips with the transcript scrolling to the newest message.

## What was built

- Task 1 (tracer, `c16138f`): `Your message was kept. Press Send to try again.` added to the `chat-error` block; `ChatDock.test.tsx` pins the 502 sentence, the network copy, the status-only copy, text kept, resend replacing the failed attempt (one user bubble, `onActionsApplied` once with `[]`), and the error staying until the next send starts. `useChat` already behaved correctly, so no root-cause fix was needed.
- Task 2 (`2e3129d`): `inFlight` ref with `finally` reset in `useChat.send`; `Thinking...` (`role="status"`) while pending; textarea `readOnly` with `opacity-60`, Send disabled while pending, `onKeyDown` where Enter sends, Shift+Enter adds a newline and an IME-composing Enter is ignored. Tests: loading, locked composer, two synchronous submits plus Enter while pending send one POST, resolve and reject paths, Enter/Shift+Enter/IME, empty draft, trimmed-but-verbatim encoding (`Wie geht's? 日本 € naïve`, inner newline), no `maxlength`.
- Task 3 (`a43bb56`): `QUICK_PROMPTS` (exact list, `/buy|sell|add/i` guard), `testIds.chatChip`, `ChatChips` (empty line plus three `type="button"` chips that `setDraft` then `send` the label), chips mounted only with no messages and no attempt, zero-height scroll sentinel with `scrollIntoView({ block: "end" })` on `[messages, attempt]`. Tests: empty state, chip click sends once, failed chip send keeps the label, chips never return, four bubbles in order, scroll on send and reply.

Verification: 324 frontend tests pass, `tsc --noEmit` clean, `next build` succeeds, `out/index.html` contains the empty-state line (`TRACER_OK` and `CHAT_LIFECYCLE_OK` gates both passed).

## Deviations from Plan

None - plan executed as written. The three Task 1 failures were exactly the follow-up-line cases; several Task 2 cases (Shift+Enter, IME, empty draft, encoding) passed immediately because 05-01 already produced the right behaviour, and they remain as regression pins.

## Known Stubs

None.

## Threat Flags

None. T-05-04 (double submit) mitigated by the ref guard, pending lock and unmounted chips, with tests; T-05-05 by the `QUICK_PROMPTS` keyword test; error text renders as React text nodes.

## Notes for the orchestrator

- REQUIREMENTS.md was not touched (shared file, 05-03 runs in parallel); this plan satisfies CHAT-01 (composer and scroll half), CHAT-02, CHAT-04, CHAT-06.
- Not covered by jsdom, left to UAT backstops: composer/Send bottom alignment at 318px, no horizontal scroll in the 320px column, `scrollIntoView` not scrolling the page (A2).

## Self-Check: PASSED

Created files `ChatChips.tsx`, `ChatDock.test.tsx` exist; commits `c16138f`, `2e3129d`, `a43bb56` are ancestors of HEAD.
