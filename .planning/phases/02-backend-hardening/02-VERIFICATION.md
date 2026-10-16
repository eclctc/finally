---
phase: 02-backend-hardening
verified: 2026-10-16T20:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/02-backend-hardening/02-01-PLAN.md
  - .planning/phases/02-backend-hardening/02-01-SUMMARY.md
  - .planning/phases/02-backend-hardening/02-02-PLAN.md
  - .planning/phases/02-backend-hardening/02-02-SUMMARY.md
  - .planning/phases/02-backend-hardening/02-03-PLAN.md
  - .planning/phases/02-backend-hardening/02-03-SUMMARY.md
  - .planning/phases/02-backend-hardening/02-04-PLAN.md
  - .planning/phases/02-backend-hardening/02-04-SUMMARY.md
  - .planning/phases/02-backend-hardening/02-05-PLAN.md
  - .planning/phases/02-backend-hardening/02-05-SUMMARY.md
  - .planning/phases/02-backend-hardening/02-06-PLAN.md
  - .planning/phases/02-backend-hardening/02-06-SUMMARY.md
  - backend/app/chat/llm.py
  - backend/app/chat/prompt.py
  - backend/app/chat/schemas.py
  - backend/app/chat/service.py
  - backend/app/db/connection.py
  - backend/app/db/repository.py
  - backend/app/db/schema.sql
  - backend/app/market/cache.py
  - backend/app/market/simulator.py
  - backend/app/services/watchlist.py
  - backend/tests/chat/test_llm.py
  - backend/tests/chat/test_router.py
covered_digest: "v3:sha256:9e1f1879725867077dcd2e17025f79fb75c5f776b891e87d42e91f85b6a507ed"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "In a chat turn, an action that fails unexpectedly appears as a failed action with a reason, the other actions still execute, and the chat turn is delivered (SC3; HARD-05; also SC1 'never a 500') - non-finite LLM trade quantity no longer yields HTTP 500 (G-02-1 / CR-01)"
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "WR-03: a failing final chat-message insert leaves committed trades with no stored record and surfaces a 500"
    category: other
    reason: "Needs a disk-full or lock-timeout failure on the last write; deliberate trade-off of not holding the write lock across the LLM call. No roadmap criterion covers it. Still open in 02-REVIEW-DISPOSITION.md."
    evidence_status: "code inspection only"
  - finding: "WR-02: savepoint() cleanup can mask the original exception when SQLite has already auto-rolled back"
    category: other
    reason: "Affects which exception is logged in rare SQLITE_FULL/IOERR cases; the action is still recorded as failed. Still open."
    evidence_status: "none provided by this verifier"
  - finding: "IN-03: a subnormal quantity (e.g. 5e-324) passes validation and fills at $0 (pre-existing, services/portfolio.py)"
    category: other
    reason: "Data-quality oddity, not a 500 and not in any Phase 2 criterion. Out of scope for this phase."
    evidence_status: "review finding, not re-run"
---

# Phase 2: Backend Hardening Verification Report

**Phase Goal:** As a trader, I want to get clean errors and consistent chat actions, so that the AI copilot is reliable.
**Verified:** 2026-10-16
**Status:** passed
**Re-verification:** Yes, after gap closure (plan 02-06, gap G-02-1)

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | LLM no choices / empty / unparseable content / timeout gives 502 with a fixed public `{"error"}` and never a 500; missing-key message stays actionable; upstream error only in the log | VERIFIED | Held in the first pass (`llm.py` constants, `Timeout` -> `TIMEOUT_ERROR`, `parse_reply` -> `BAD_REPLY_ERROR`). The non-finite-number edge now also holds: 20 NaN/Infinity/-Infinity/1e999/-1e999/"inf"/"nan"/"-inf"/"Infinity"/null combinations (buy and sell) all returned 502 with exactly `{"error": "The AI assistant returned an unusable reply, please try again"}` (see Spot-Checks). |
| 2 | Concurrent adds of the same ticker never return 500; duplicate treated as already watched | VERIFIED | Regression check: `ON CONFLICT DO NOTHING` path unchanged (no diff in `repository.py` / `services/watchlist.py` since plan start); `test_concurrent_adds_of_same_ticker_store_one_row` passes in the 145-test run. |
| 3 | Unexpected action failure or over-cap (5/5) appears as `failed` with a reason; other actions still execute; stored message matches executed; no write lock across the LLM call | VERIFIED | Previously FAILED on the non-finite edge. Now: a quantity of `sys.float_info.max` and `1e308` returns 200 with the PYPL add `ok` and the AAPL trade `failed`, and the turn is stored (2 rows per turn). Non-finite values never reach an action: the reply is rejected whole before any write (0 chat rows, PYPL not watched). `run_action` isolation, caps and `test_no_transaction_open_during_llm_call` unchanged and passing. |
| 4 | Remove then re-add keeps the original session open price | VERIFIED | `PriceCache._session_opens` and simulator `last_prices` unchanged; tests pass in the full run. |
| 5 | Backend pytest passes with a reproducing test per fix; snapshot and chat-history queries backed by per-user time-ordered indexes | VERIFIED | `uv run pytest -q`: 145 passed (136 baseline + 9 new), none failed or skipped. New tests: `test_non_finite_trade_quantity_returns_502` (4 cases), `test_largest_finite_quantity_fails_as_an_action`, 4 new `test_parse_malformed_raises` cases. Indexes in `schema.sql` unchanged. |

**Score:** 5/5 truths verified

### Gap Closure Check (G-02-1)

| Item | Result |
|------|--------|
| Fix present | `backend/app/chat/schemas.py:13` `quantity: float = Field(allow_inf_nan=False)` |
| Fix is the only app change | `git diff --name-only 29dc70a HEAD -- backend/app` lists only `backend/app/chat/schemas.py`; `llm.py`, `service.py`, `router.py`, `services/`, `routes/` untouched |
| Provider schema unchanged | pydantic keeps `{'title': 'Quantity', 'type': 'number'}` (allow_inf_nan is a validation-only constraint); summary states it was checked |
| Previous reproduction no longer fails | Own scratch run with a stubbed `acompletion` and `TestClient(raise_server_exceptions=False)`: every non-finite form gives 502, `chat_messages` rows stay 0 and PYPL stays unwatched. Before the fix the same input gave 500 with 2 stored rows. |
| Prohibitions in 02-06 (no stored turn without deliverable response; no coercion of non-finite to finite) | Enforced by tests: the route test asserts 502, empty positions, cash 10000.0, empty chat history and PYPL unwatched |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/chat/schemas.py` | Quantity rejects non-finite | VERIFIED | Substantive, imported by `llm.py` `parse_reply` and used as `response_format`; previously PARTIAL |
| `backend/tests/chat/test_router.py` | Route-level regression tests | VERIFIED | 4 `non_finite` cases collected, 11 tests in file pass |
| `backend/tests/chat/test_llm.py` | String-encoded and null parse cases | VERIFIED | Passes alone (37 passed with test_router.py) |
| `backend/app/chat/llm.py`, `service.py`, `prompt.py` | Boundary errors, isolated and capped actions | VERIFIED | Unchanged since first pass |
| `backend/app/db/*`, `backend/app/market/*`, `services/watchlist.py` | Idempotent adds, indexes, session open | VERIFIED | Unchanged since first pass |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `TradeInstruction.quantity` | `parse_reply` | pydantic `finite_number` error -> `LLMError(BAD_REPLY_ERROR)` | WIRED (observed in log output of the scratch run) |
| `LLMError` | chat router | `JSONResponse(502, {"error": str(exc)})` | WIRED (502 body observed) |
| `handle_chat_message` | `generate_reply` | rejection raised before any action or chat row | WIRED (0 rows observed) |
| remaining links from first pass | | | WIRED, files unchanged |

### Data-Flow Trace (Level 4)

Action dicts flow from the LLM reply to the response and `chat_messages`. Non-finite values can no longer enter this flow. Finite extremes (1.797e308, 1e308) flow through as failed actions and serialize correctly (200).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full backend suite | `cd backend && uv run pytest -q` | 145 passed | PASS |
| Touched files alone | `uv run pytest -q tests/chat/test_router.py tests/chat/test_llm.py` | 37 passed | PASS |
| New regression cases collected | `pytest --collect-only -k non_finite` | 4/11 collected | PASS |
| Non-finite quantity via POST /api/chat (own script, scratchpad `check_nonfinite.py`) | stubbed `acompletion`; tokens NaN, Infinity, -Infinity, 1e999, -1e999, "inf", "nan", "-inf", "Infinity", null; buy and sell | all 20 returned 502 with the fixed body; 0 chat rows; PYPL unwatched | PASS |
| Finite extremes and normal quantity | same script; 10, 1.7976931348623157e+308, 1e308 | all 200; rows stored per turn; PYPL added | PASS |

### Probe Execution

SKIPPED: no probes declared by the phase plans.

### Requirements Coverage

All nine IDs are declared in PLAN frontmatter (02-01: HARD-01/02/03; 02-02: HARD-04/08; 02-03: HARD-07; 02-04: HARD-05; 02-05: HARD-06, INT-04; 02-06: HARD-01, HARD-05, INT-04) and all appear in REQUIREMENTS.md. No orphaned IDs.

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| HARD-01 | 02-01, 02-06 | SATISFIED | No choices, empty, unparseable and non-finite content all give 502 |
| HARD-02 | 02-01 | SATISFIED | Fixed constants, log-only detail, missing-key message kept |
| HARD-03 | 02-01 | SATISFIED | `timeout=30`, `Timeout` -> 502 |
| HARD-04 | 02-02 | SATISFIED | `ON CONFLICT DO NOTHING`, race test |
| HARD-05 | 02-04, 02-06 | SATISFIED | Isolation, lock-free LLM call, failed action delivered; non-finite no longer 500 |
| HARD-06 | 02-05 | SATISFIED | Cap of 5 per kind, skipped as failed, prompt states cap |
| HARD-07 | 02-03 | SATISFIED | Session open persists across remove/re-add |
| HARD-08 | 02-02 | SATISFIED | Two time-ordered indexes with plan-based tests |
| INT-04 | 02-05, 02-06 | SATISFIED | 145 passed, a reproducing test per fix including CR-01 |

Housekeeping: the REQUIREMENTS.md checkboxes (lines 21-28, 70) and traceability rows (lines 115-122, 149) still read Pending. The orchestrator should mark them complete when closing the phase. ROADMAP.md progress also still shows Phase 2 "In Progress".

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/services/watchlist.py` | 28-38 | Single-statement savepoints used only to force an early commit (IN-01) | Info | Maintenance risk |
| `backend/app/chat/service.py` | 29-36 | `.upper()` vs `normalize_ticker` in action records (IN-02) | Info | Cosmetic |

No TBD/FIXME/XXX markers in the phase's changed source files (grep exit 1). The earlier blocker in `schemas.py` is resolved.

### Human Verification Required

None. All criteria are backend behavior and were checked programmatically.

### Gaps Summary

No gaps. The single gap from the first verification (a non-finite LLM trade quantity turning a chat turn into a 500 after it was stored) is closed by a one-line schema constraint, confirmed by an independent behavioral run against the real app and by the regression tests. The change touches only `schemas.py`, so the four criteria that passed earlier are unaffected, and the full suite is green at 145 passed. Open review items WR-01 (not reproduced on the OpenRouter route), WR-02, WR-03 and IN-01..IN-03 are advisory and outside the roadmap criteria.

---

_Verified: 2026-10-16_
_Verifier: Claude (gsd-verifier)_
