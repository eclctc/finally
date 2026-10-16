---
phase: 02-backend-hardening
plan: 01
subsystem: api
tags: [litellm, openrouter, error-handling, fastapi, pytest]

requires:
  - phase: 01-walking-skeleton
    provides: working backend chat route (POST /api/chat) and LLMError to 502 mapping in router
provides:
  - LLM boundary that raises LLMError only from fixed constants (UPSTREAM_ERROR, TIMEOUT_ERROR, BAD_REPLY_ERROR, plus the unchanged missing-key literal)
  - 30 s request timeout on acompletion
  - server-side logging of the real upstream and parse failures
affects: [05-ai-chat, 02-backend-hardening]

plan_head_before: 6ba74b25c583d370b65cc4b4ca933612ee254157
plan_head_after: de59463e307f31d4c8bf1643caf83d74b6f5e0a4

actuals:
  tokens: 3500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Public error text is a module constant; the cause goes to logger.exception / logger.warning"

key-files:
  created: []
  modified:
    - backend/app/chat/llm.py
    - backend/tests/chat/test_llm.py
    - backend/tests/chat/test_router.py

key-decisions:
  - "A response with no usable choice maps to UPSTREAM_ERROR (provider gave nothing back); bad content maps to BAD_REPLY_ERROR; both are 502"
  - "TIMEOUT_SECONDS = 30 and the public wordings are the plan's assumptions A1 and A2; easy to tune"

requirements-completed: [HARD-01, HARD-02, HARD-03]

coverage:
  - id: D1
    description: "Upstream LLM exception returns 502 with fixed UPSTREAM_ERROR body; cause only in server log; nothing executed or stored"
    requirement: HARD-02
    verification:
      - kind: integration
        ref: "backend/tests/chat/test_router.py#test_upstream_error_returns_fixed_502"
        status: pass
      - kind: unit
        ref: "backend/tests/chat/test_llm.py#test_request_failure_raises_llm_error"
        status: pass
    human_judgment: false
  - id: D2
    description: "No choices, empty or unparseable content return 502 with fixed constants and never echo model output"
    requirement: HARD-01
    verification:
      - kind: integration
        ref: "backend/tests/chat/test_router.py#test_bad_llm_replies_return_fixed_502"
        status: pass
      - kind: unit
        ref: "backend/tests/chat/test_llm.py#test_missing_choices_raise_llm_error"
        status: pass
      - kind: unit
        ref: "backend/tests/chat/test_llm.py#test_schema_error_does_not_echo_model_output"
        status: pass
    human_judgment: false
  - id: D3
    description: "acompletion is called with timeout=30 and a litellm Timeout returns a fixed 502"
    requirement: HARD-03
    verification:
      - kind: unit
        ref: "backend/tests/chat/test_llm.py#test_timeout_raises_timeout_error"
        status: pass
      - kind: unit
        ref: "backend/tests/chat/test_llm.py#test_request_reply_parses_model_output"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 01: LLM Boundary Hardening Summary

**Every LLM failure (upstream exception, no choices, unusable content, 30 s timeout) now reaches the client as a 502 with a fixed constant message, with the real cause logged server-side only.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (both TDD: RED commit then GREEN commit)
- **Files modified:** 3 (`backend/app/chat/llm.py`, two chat test modules)

## Accomplishments

- `request_reply` raises `LLMError(UPSTREAM_ERROR)` for any upstream exception and logs it with `logger.exception`; the `choices[0].message.content` extraction moved inside the same try so empty/None choices or a None message give 502 instead of 500.
- `acompletion` gets `timeout=TIMEOUT_SECONDS` (30); `litellm.exceptions.Timeout` is caught first and gives `TIMEOUT_ERROR`.
- `parse_reply` raises `LLMError(BAD_REPLY_ERROR)` for empty or schema-mismatched content; pydantic's error (which echoed the model output) now goes only to a `logger.warning`.
- No `LLMError` message is interpolated; the missing-key message is unchanged.

## Task Commits

1. Task 1 RED: `e65c0bb` test(02-01): failing tests for fixed upstream-error 502
2. Task 1 GREEN: `9ea1921` feat(02-01): fixed 502 message for upstream LLM errors
3. Task 2 RED: `b80fe06` test(02-01): failing tests for missing choices, bad content and timeout
4. Task 2 GREEN: `de59463` feat(02-01): fixed 502 messages for missing choices, bad content and timeout

## TDD Notes

- RED (Task 1): 3 tests failed with `AttributeError: module 'app.chat.llm' has no attribute 'UPSTREAM_ERROR'`. Semantic assessment: the target tests executed and failed because the planned public constant did not exist yet (before the change the body was `LLM request failed: ...` with the upstream text). The `gsd_run check tdd-red-evidence` classifier does not support the pytest report format, so the assessment is manual.
- RED (Task 2): 15 tests failed; the schema-echo test failed on its real assertion (`SECRETOUT` present in the error), `test_request_reply_parses_model_output` failed on missing `timeout`, the others on the missing constants. Route test parametrization resolves constants with `getattr(llm, name)` inside the test body so the failure is per test, not a collection error.
- GREEN: `uv run pytest -q tests/chat/` 36 passed; full suite 113 passed (baseline 103 plus 10 new test cases). No REFACTOR commit needed.

## Deviations from Plan

None - plan executed exactly as written, with one note: Task 1's acceptance criterion `grep -v '^\s*#' llm.py | grep -c 'LLMError(f'` equals 0 could not hold after Task 1 alone because `parse_reply` still had its two f-string messages until Task 2 replaced them with `BAD_REPLY_ERROR` (the plan assigns that change to Task 2). It outputs 0 after Task 2, which is the state the plan-level threat mitigation (T-02-01) requires.

**Total deviations:** 0 auto-fixed.

## Known Stubs

None.

## Threat Flags

None. No new endpoints, auth paths or trust boundaries. T-02-01, T-02-02 and T-02-03 mitigations are implemented as planned (fixed constants, 30 s timeout, log calls pass only fixed messages plus the exception).

## Issues Encountered

None.

## Next

Ready for the next plan in Phase 2 (chat action consistency half of the phase goal).

## Self-Check: PASSED

- backend/app/chat/llm.py, backend/tests/chat/test_llm.py, backend/tests/chat/test_router.py exist and are committed.
- Commits e65c0bb, 9ea1921, b80fe06, de59463 are ancestors of HEAD.
- `cd backend && uv run pytest -q`: 113 passed.
