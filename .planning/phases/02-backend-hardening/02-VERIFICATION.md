---
phase: 02-backend-hardening
verified: 2026-10-16T19:00:00Z
status: gaps_found
score: 4/5 must-haves verified
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
covered_digest: "v3:sha256:5a5c8bd12f4ce06aeaa12209493770bdf53aaf6c8996fa707702687bb714f9be"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "In a chat turn, an action that fails unexpectedly appears as a failed action with a reason, the other actions still execute, and the chat turn is delivered (SC3; HARD-05; also SC1 'never a 500')"
    status: failed
    reason: "A non-finite LLM trade quantity (Infinity, NaN, 1e999) is accepted by ChatReply, the trade fails validation and is recorded as a failed action carrying inf/nan, the turn is committed to chat_messages, and then FastAPI fails to serialize the response, so POST /api/chat returns HTTP 500. Reproduced against the real app via TestClient with a stubbed acompletion (see Behavioral Spot-Checks)."
    artifacts:
      - path: "backend/app/chat/schemas.py"
        issue: "TradeInstruction.quantity is a plain float; allow_inf_nan is not disabled, so a non-finite value passes schema validation instead of surfacing as a 502 BAD_REPLY_ERROR"
      - path: "backend/app/chat/service.py"
        issue: "describe_trade copies the raw quantity into the action dict, which is then stored with json.dumps and returned in the response"
    missing:
      - "Reject non-finite quantities at the schema boundary: quantity: float = Field(allow_inf_nan=False) in TradeInstruction (becomes a 502 BAD_REPLY_ERROR before anything runs)"
      - "Optionally also guard execute_trade with math.isfinite(quantity) so REST trades fail with 400"
      - "A regression test through POST /api/chat for NaN and Infinity quantities asserting 502 and nothing stored"
advisory:
  - finding: "WR-03: a failing final chat-message insert leaves committed trades with no stored record and surfaces a 500"
    category: other
    reason: "Requires a disk-full or lock-timeout failure on the last write; deliberate trade-off of not holding the write lock across the LLM call. Not exercised by any roadmap criterion. Fix is a logger.exception with the action list or returning the reply anyway."
    evidence_status: "code inspection only (service.py handle_chat_message)"
  - finding: "WR-02: savepoint() cleanup can mask the original exception when SQLite has already auto-rolled back"
    category: other
    reason: "Only affects which exception is logged in rare SQLITE_FULL/IOERR/BUSY_SNAPSHOT cases; the action is still recorded as failed. Not reproduced here."
    evidence_status: "none provided by this verifier"
---

# Phase 2: Backend Hardening Verification Report

**Phase Goal:** As a trader, I want to get clean errors and consistent chat actions, so that the AI copilot is reliable.
**Verified:** 2026-10-16
**Status:** gaps_found
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | LLM no choices / empty / unparseable content / timeout gives 502 with a fixed public `{"error"}` and never a 500; missing-key message stays actionable; upstream error only in the log | VERIFIED | `llm.py` request_reply: `choices[0].message.content` read inside the try, `Timeout` -> `TIMEOUT_ERROR`, any other exception -> `UPSTREAM_ERROR` via `logger.exception`; `parse_reply` raises constant `BAD_REPLY_ERROR`, pydantic detail only to `logger.warning`; missing-key literal `OPENROUTER_API_KEY is not set` kept; `timeout=TIMEOUT_SECONDS` (30) passed. Tests `test_upstream_error_returns_fixed_502`, `test_bad_llm_replies_return_fixed_502`, `test_timeout_raises_timeout_error`, `test_schema_error_does_not_echo_model_output` pass. Enumerated cases hold; the non-finite-quantity edge is tracked under truth 3. |
| 2 | Concurrent adds of the same ticker never return 500; duplicate treated as already watched | VERIFIED | `repository.insert_watchlist_row` uses `ON CONFLICT (user_id, ticker) DO NOTHING`; `add_to_watchlist` is a no-op success when already watched; `test_concurrent_adds_of_same_ticker_store_one_row` passes |
| 3 | Unexpected action failure or over-cap (5 trades / 5 watchlist changes) appears as `failed` with a reason; other actions still execute; stored message matches what was executed; no write lock across the LLM call | FAILED | Per-action isolation (`run_action`, `UNEXPECTED_ERROR`), caps (`MAX_ACTIONS_PER_KIND`, `skipped`) and no-lock-across-LLM (`test_no_transaction_open_during_llm_call`) all verified. But a non-finite trade quantity fails its action, the turn is stored, and the HTTP response is a 500 (reproduced). The failed action is never delivered to the client and breaks "never a 500" |
| 4 | Remove then re-add keeps the original session open price | VERIFIED | `PriceCache._session_opens` survives `remove()` and `update()` uses `setdefault`; `GBMSimulator.last_prices` resumes re-added tickers; tests `test_open_survives_remove_and_readd`, `test_readd_keeps_session_open_and_resumes_price`, `test_readd_keeps_session_open` (Massive) pass |
| 5 | Backend pytest passes with a reproducing test per fix; snapshot and chat history queries backed by per-user time-ordered indexes | VERIFIED | `uv run pytest -q`: 136 passed. `schema.sql` has `idx_snapshots_user_time (user_id, recorded_at)` and `idx_chat_user_time (user_id, created_at)` (`CREATE INDEX IF NOT EXISTS`, applied by `init_db`); `test_time_ordered_queries_use_an_index` asserts USING INDEX and no TEMP B-TREE. Note: no test covers the non-finite-quantity case |

**Score:** 4/5 truths verified

### Review Claims Checked Independently

| Claim | Result |
|-------|--------|
| CR-01 non-finite quantity gives HTTP 500 after the turn is stored | CONFIRMED. `Infinity`, `NaN` and `1e999` each returned 500; `10` returned 200. After the 500, `chat_messages` held 2 rows. The review's "second POST also 500" was not reproduced (next turn returned 200); the rest holds. |
| WR-01 SDK retries multiply the 30 s timeout | NOT REPRODUCED on the real route. With `model="openrouter/openai/gpt-oss-120b"` against a local never-replying server and `timeout=1`: 1 connection, `Timeout` after 1.1 s. The review measured the `openai/` provider; the OpenRouter route does not retry. No effect on verdict. |
| WR-02, WR-03 | Code reads as described; rare storage-failure edges outside roadmap criteria. Recorded as advisory, not blocking. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/chat/llm.py` | Fixed constants, timeout, logging | VERIFIED | Substantive, wired via `generate_reply` in `service.py` |
| `backend/app/chat/service.py` | Isolated, capped, savepoint-based actions | VERIFIED (with CR-01 gap) | `run_action`, `run_trades`, `run_watchlist_changes` wired into `handle_chat_message` |
| `backend/app/chat/schemas.py` | Schema for LLM output | PARTIAL | Missing non-finite rejection on `quantity` |
| `backend/app/chat/prompt.py` | States the cap | VERIFIED | `MAX_ACTIONS_PER_KIND` shared with service |
| `backend/app/db/connection.py` | `savepoint()` helper | VERIFIED | Used in watchlist service and chat service |
| `backend/app/db/repository.py` / `schema.sql` | Idempotent insert, indexes | VERIFIED | Present and tested |
| `backend/app/market/cache.py`, `simulator.py` | Session open persistence | VERIFIED | Present and tested |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| chat router | `handle_chat_message` | `LLMError` -> 502 JSONResponse | WIRED |
| `handle_chat_message` | `generate_reply` -> `request_reply` | import and await | WIRED |
| actions | `execute_trade_and_sync` / watchlist service | `run_action(perform)` | WIRED |
| `add_to_watchlist` | idempotent SQL | `savepoint` + `ON CONFLICT DO NOTHING` | WIRED |
| `init_db` | indexes | `executescript(schema.sql)` | WIRED |

### Data-Flow Trace (Level 4)

The action dicts flow from the LLM reply to the response and `chat_messages`. For a non-finite quantity the value reaches the response serializer and breaks it (the gap above). Other values flow correctly (finite quantity returns 200 with action `status: ok`).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full backend suite | `cd backend && uv run pytest -q` | 136 passed | PASS |
| Non-finite quantity via POST /api/chat | scratch TestClient script with stubbed `acompletion` returning quantity `Infinity` / `NaN` / `1e999` / `10` | 500 / 500 / 500 / 200 | FAIL |
| Turn stored despite the 500 | same script, then read `chat_messages` | 2 rows stored | FAIL (inconsistent state) |
| OpenRouter route timeout not multiplied by retries | `acompletion(model="openrouter/...", timeout=1)` against a silent local server | Timeout in 1.1 s, 1 connection | PASS |

### Probe Execution

SKIPPED: no probes declared by the phase plans.

### Requirements Coverage

All nine phase IDs appear in PLAN frontmatter (01: HARD-01/02/03; 02: HARD-04/08; 03: HARD-07; 04: HARD-05; 05: HARD-06/INT-04) and in REQUIREMENTS.md. No orphaned requirement IDs. The REQUIREMENTS.md checkboxes and traceability rows still read Pending and need updating after closure.

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| HARD-01 | 02-01 | SATISFIED for no choices, empty and unparseable content | Tests above. Residual: non-finite number content is accepted by the schema and ends in a 500 (CR-01) |
| HARD-02 | 02-01 | SATISFIED | Fixed constants, log-only detail, missing-key message kept |
| HARD-03 | 02-01 | SATISFIED | `timeout=30`, `Timeout` -> 502 `TIMEOUT_ERROR`; no retry multiplication on the OpenRouter route |
| HARD-04 | 02-02 | SATISFIED | `ON CONFLICT DO NOTHING`, race test |
| HARD-05 | 02-04 | BLOCKED (partially) | Isolation and lock-free LLM call hold; a non-finite quantity yields a 500 and an undelivered failed action |
| HARD-06 | 02-05 | SATISFIED | Cap of 5 per kind, skipped actions recorded as failed, prompt states cap; boundary tests pass |
| HARD-07 | 02-03 | SATISFIED | Session open persists across remove/re-add |
| HARD-08 | 02-02 | SATISFIED | Two indexes, plan-based tests |
| INT-04 | 02-05 | SATISFIED for the suite (136 pass) | The reproducing-test-per-fix part has no test for CR-01 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/chat/schemas.py` | 13 | Unconstrained `float` for LLM-supplied quantity | Blocker | Non-finite input yields a 500 after commit |
| `backend/app/services/watchlist.py` | 28-38 | Single-statement savepoints used only to force an early commit, uncommented (IN-01) | Info | Maintenance risk |
| `backend/app/chat/service.py` | 29-36 | `.upper()` vs `normalize_ticker` in action records (IN-02) | Info | Cosmetic |

No TBD/FIXME/XXX markers found in the phase's changed source files.

### Human Verification Required

None. The gap is code-observable and reproduced.

### Gaps Summary

Four of five roadmap criteria hold: LLM boundary errors map to fixed 502s, duplicate watchlist adds are idempotent, the action cap and per-action isolation work, session open survives re-add, and the suite and indexes are in place. One defect blocks the "AI copilot is reliable" goal. A model reply with a non-finite trade quantity (Infinity, NaN, 1e999) passes the schema, runs as a failed action, commits the turn, and then the response serialization fails with a 500. This contradicts the criterion "never a 500" and the criterion that a failing action appears as a `failed` action while the turn completes. The fix is a one-line schema constraint (`Field(allow_inf_nan=False)`) plus a router-level regression test; it can be closed with `/gsd-plan-phase 2 --gaps`. The WR-01 timeout multiplication was not reproduced on the actual OpenRouter route. WR-02 and WR-03 are recorded as advisory.

---

_Verified: 2026-10-16_
_Verifier: Claude (gsd-verifier)_
