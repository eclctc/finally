---
phase: 02-backend-hardening
plan: 06
subsystem: api
tags: [pydantic, chat, llm, validation, gap-closure]

requires:
  - phase: 02-backend-hardening
    provides: parse_reply mapping pydantic errors to LLMError(BAD_REPLY_ERROR) and the 502 route (plan 02-01)
provides:
  - TradeInstruction.quantity rejects NaN and infinities at the schema boundary
  - Route-level regression tests for non-finite and largest-finite quantities
affects: [05-ai-chat]

actuals:
  tokens: 2200
  tasks: 2
  commits: 3
plan_head_before: 29dc70a1dceba8e142ff14a05c514ffa1e9e4f9a
plan_head_after: 3c7a30412e282e40269dda2e8cf8a29768306b59

tech-stack:
  added: []
  patterns:
    - "Reject unusable numbers in the LLM output schema (Field(allow_inf_nan=False)) so parse_reply turns them into a fixed 502 before any write"

key-files:
  created: []
  modified:
    - backend/app/chat/schemas.py
    - backend/tests/chat/test_router.py
    - backend/tests/chat/test_llm.py

key-decisions:
  - "A non-finite quantity rejects the whole reply (502 BAD_REPLY_ERROR, nothing executed or stored) rather than failing only that trade"
  - "No quantity upper bound added: sys.float_info.max stays valid and fails as an Insufficient cash action"
  - "REST trade path left untouched; all non-finite REST quantities already return 400"

requirements-completed: [HARD-01, HARD-05, INT-04]

coverage:
  - id: D1
    description: "A chat reply with NaN, Infinity, -Infinity or 1e999 trade quantity returns 502 BAD_REPLY_ERROR with nothing executed or stored"
    requirement: HARD-01
    verification:
      - kind: integration
        ref: "backend/tests/chat/test_router.py#test_non_finite_trade_quantity_returns_502"
        status: pass
    human_judgment: false
  - id: D2
    description: "String-encoded non-finite and null quantities are rejected by parse_reply with BAD_REPLY_ERROR"
    requirement: HARD-05
    verification:
      - kind: unit
        ref: "backend/tests/chat/test_llm.py#test_parse_malformed_raises"
        status: pass
    human_judgment: false
  - id: D3
    description: "The largest finite quantity still returns 200 with a failed action stored exactly as returned"
    requirement: HARD-05
    verification:
      - kind: integration
        ref: "backend/tests/chat/test_router.py#test_largest_finite_quantity_fails_as_an_action"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full backend suite green"
    requirement: INT-04
    verification:
      - kind: other
        ref: "cd backend && uv run pytest -q (145 passed)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 06: Non-finite chat quantity Summary

**One-line pydantic fix, `Field(allow_inf_nan=False)` on `TradeInstruction.quantity`, turns a NaN/Infinity trade quantity from the LLM into a fixed 502 instead of a 500 with a stored turn.**

This plan closes gap G-02-1 (review finding CR-01).

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-16T17:55:00Z
- **Completed:** 2026-10-16T18:07:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Root cause: `quantity: float` accepted non-finite values, the trade failed as an action carrying `inf` or `nan`, the turn was stored, and FastAPI's response serializer (`allow_nan=False`) then raised, giving a 500 after two chat rows were committed.
- `TradeInstruction.quantity` is now `float = Field(allow_inf_nan=False)`. `parse_reply` already maps the pydantic error to `LLMError(BAD_REPLY_ERROR)` and the router returns 502, so rejection happens before any write.
- The `response_format` schema sent to the provider is unchanged (`{'title': 'Quantity', 'type': 'number'}`).
- Final suite: **145 passed** (136 baseline plus 9 new), nothing failed or skipped.

## TDD Gate Compliance

- RED (`bcab2f1`): `test_non_finite_trade_quantity_returns_502` x4 failed with `ValueError: Out of range float values are not JSON compliant` out of `client.post` (the TestClient re-raises what a real server would answer as 500). Failure was on the planned behavior, not an import or fixture fault.
- GREEN (`c1a062e`): schema fix; the four cases and the existing 28 tests pass (32 passed).
- Task 2 teeth check: with the schema temporarily reverted, the three string cases (`"inf"`, `"nan"`, `"-inf"`) failed with `DID NOT RAISE LLMError` (null passed, as expected since it was already rejected). The fix was restored and the grep acceptance check passed before committing (`3c7a304`).

## Task Commits

1. **Task 1 RED: failing route test** - `bcab2f1` (test)
2. **Task 1 GREEN: schema fix** - `c1a062e` (feat)
3. **Task 2: finite boundary and string-encoded cases** - `3c7a304` (test)

## Files Created/Modified

- `backend/app/chat/schemas.py` - `Field` import, `quantity: float = Field(allow_inf_nan=False)` with reason comment.
- `backend/tests/chat/test_router.py` - `reply_with_quantity` helper, `test_non_finite_trade_quantity_returns_502` (4 cases), `test_largest_finite_quantity_fails_as_an_action`.
- `backend/tests/chat/test_llm.py` - 4 new `test_parse_malformed_raises` cases.

## Decisions Made

- Reject the whole reply on a non-finite quantity (HARD-01), reversible with one line.
- No quantity cap; extreme finite quantities fail through the insufficient cash check.
- No change under `backend/app/services`, `backend/app/routes`, `llm.py`, `service.py` or `router.py` (verified with `git diff --name-only 29dc70a`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Threat Flags

None. T-02-12, T-02-13 and T-02-14 are mitigated and covered by the tests above.

## Known Stubs

None.

## Self-Check: PASSED

- backend/app/chat/schemas.py contains `quantity: float = Field(allow_inf_nan=False)`: FOUND
- Commits bcab2f1, c1a062e, 3c7a304 are ancestors of HEAD: FOUND
- Acceptance: test_router.py 11 passed, test_llm.py 26 passed (10 parse_malformed), full suite 145 passed.
