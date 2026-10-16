---
phase: 02-backend-hardening
plan: 05
subsystem: chat
tags: [fastapi, llm, pytest, prompt-injection, action-cap]
requires:
  - phase: 02-backend-hardening
    provides: "run_action, describe_* helpers and savepoint-based handle_chat_message (plans 02-01..02-04)"
provides:
  - "Service-level cap of 5 trades and 5 watchlist changes per chat reply; overflow recorded as failed actions"
  - "System prompt line telling the model the cap"
  - "INT-04 gate: full backend suite green (136 passed) with a test for every Phase 2 fix"
affects: [05-ai-chat]
actuals:
  tokens: 1800
  tasks: 2
  commits: 4
plan_head_before: b8e475d2154cada03c38c9de3626b7eee4963e6c
plan_head_after: 56589568250bb3f3301bac99fcf01102722f4fa4
tech-stack:
  added: []
  patterns:
    - "Cap enforced in the service by slicing, not by schema maxItems, so an over-long reply is degraded rather than rejected"
    - "One shared constant (MAX_ACTIONS_PER_KIND) feeds both the prompt text and the service slicing"
key-files:
  created: []
  modified:
    - backend/app/chat/prompt.py
    - backend/app/chat/service.py
    - backend/tests/chat/test_service.py
    - backend/tests/chat/test_prompt.py
key-decisions:
  - "Extracted run_watchlist_changes and run_trades helpers (the plan's optional extraction) so handle_chat_message stays short"
  - "No maxItems/max_length on ChatReply: that would 502 the whole reply and change the provider response_format schema"
requirements-completed: [HARD-06, INT-04]
duration: 10min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 05: Chat Action Cap and Phase Gate Summary

**Each chat reply now executes at most 5 trades and 5 watchlist changes; the rest are returned and stored as failed "Skipped" actions, the model is told the cap in the system prompt, and the full backend suite passes (136 tests).**

## Performance

- **Duration:** about 10 min
- **Completed:** 2026-10-16T17:36:39Z
- **Tasks:** 2 (tracer + auto, both TDD)
- **Files modified:** 4

## Accomplishments

- `MAX_ACTIONS_PER_KIND = 5` in `backend/app/chat/prompt.py`, shared by the prompt and the service.
- `skipped()`, `run_watchlist_changes()` and `run_trades()` in `backend/app/chat/service.py`. The first 5 items of each kind in reply order execute; items 6 and later follow that kind's executed items as `failed` actions with error "Skipped: only the first 5 {watchlist changes|trades} per message are executed". Watchlist entries still come before trade entries. The reply is not rejected, and the stored assistant actions equal the returned actions.
- System prompt rule: "List at most 5 trades and 5 watchlist changes per reply; extra items are skipped."
- INT-04 gate: each of the 12 Phase 2 test files passes on its own, and the full suite reports 136 passed, 0 failed, 0 errors, 0 skipped (baseline 103, 131 after wave 1).

## TDD Gate Compliance

- **RED (`dd675f3`)**: `test_actions_over_the_cap_are_skipped_not_rejected` failed on `assert 'ok' == 'failed'` (action 5 executed instead of being skipped) and `test_trade_cap_boundary[6-5-1]` failed on `6 == 5` ok actions. Semantic assessment: both are the intended assertions for the planned behavior, not import or fixture faults. `test_trade_cap_boundary[5-5-0]` and `test_cap_applies_per_kind` passed at RED by design: they pin the boundary and per-kind independence that must keep holding after the change.
- **GREEN (`5f451fd`)**: all 44 tests in `tests/chat/` pass.
- **RED (`d166bb6`)**: `test_system_prompt_states_action_cap` failed because the prompt had no cap line.
- **GREEN (`5658956`)**: prompt cap line added; full suite 136 passed.
- No REFACTOR commit was needed.

## Task Commits

1. **Task 1 (tracer): cap and skip over-limit actions**: `dd675f3` (test), `5f451fd` (feat)
2. **Task 2: prompt states the cap, full-suite gate**: `d166bb6` (test), `5658956` (feat)

Tracer gate: the tracer `<verify>` (`uv run pytest -q tests/chat/`, 44 passed) re-ran green end to end before Task 2 expanded.

## Files Created/Modified

- `backend/app/chat/prompt.py` - `MAX_ACTIONS_PER_KIND`, f-string `SYSTEM_PROMPT` with the cap rule
- `backend/app/chat/service.py` - `skipped`, `run_watchlist_changes`, `run_trades`; `handle_chat_message` uses them
- `backend/tests/chat/test_service.py` - 3 cap tests (4 cases)
- `backend/tests/chat/test_prompt.py` - `test_system_prompt_states_action_cap`

## Decisions Made

- Used the optional helper extraction from the plan; `handle_chat_message` is now about 10 lines.
- Kept the cap out of `ChatReply` so a flooded reply degrades instead of returning 502.

## Deviations from Plan

None - plan executed exactly as written. The plan predated the wave 1 additions, so the cap was built on top of the existing `apply_watchlist_change`, `apply_trade` and `describe_*` helpers rather than re-creating them (as the orchestrator notes directed).

## Issues Encountered

None. The only noise is a pre-existing `StarletteDeprecationWarning` about `httpx` in the TestClient, which is out of scope.

## Known Stubs

None.

## Threat Flags

None. The change reduces attack surface (T-02-10 and T-02-11 mitigated: cap proven by `test_actions_over_the_cap_are_skipped_not_rejected` and `test_trade_cap_boundary`; skipped items are returned and stored in reply order).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 2 plans are all executed. The skip reason text is public: Phase 5 can show it inline under the reply.

## Self-Check: PASSED

- Commits `dd675f3`, `5f451fd`, `d166bb6`, `5658956` exist on this branch.
- Modified files exist; `MAX_ACTIONS_PER_KIND == 5`; all task acceptance greps return the expected counts; `uv run pytest -q` gives 136 passed.
