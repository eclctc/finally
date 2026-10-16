---
phase: 02-backend-hardening
reviewed: 2026-10-16T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - backend/app/chat/llm.py
  - backend/app/chat/prompt.py
  - backend/app/chat/service.py
  - backend/app/db/__init__.py
  - backend/app/db/connection.py
  - backend/app/db/repository.py
  - backend/app/db/schema.sql
  - backend/app/market/cache.py
  - backend/app/market/simulator.py
  - backend/app/services/portfolio.py
  - backend/app/services/watchlist.py
  - backend/tests/chat/test_llm.py
  - backend/tests/chat/test_prompt.py
  - backend/tests/chat/test_router.py
  - backend/tests/chat/test_service.py
  - backend/tests/db/test_connection.py
  - backend/tests/db/test_indexes.py
  - backend/tests/db/test_repository.py
  - backend/tests/market/test_cache.py
  - backend/tests/market/test_massive_source.py
  - backend/tests/market/test_simulator.py
  - backend/tests/services/test_portfolio.py
  - backend/tests/services/test_watchlist.py
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-16
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 2 changed the LLM error path, chat action isolation and caps, savepoint-based atomicity, the watchlist duplicate handling, session-open persistence, and two indexes. The suite passes (136 tests). Most of the work is sound. HARD-04, HARD-06, HARD-07 and HARD-08 hold up, and the "no write lock across the LLM call" property is tested properly.

I probed the edges with throwaway scripts (not committed) and found four real defects:

- A non-finite `quantity` from the model still turns a chat turn into an HTTP 500, which defeats HARD-01 and HARD-05.
- The new 30 s LLM timeout is effectively about 95 s.
- `savepoint()` hides the original error in a case that real SQLite can produce.
- A failure in the final chat-message insert leaves committed trades with no stored record.

## Critical Issues

### CR-01: Non-finite trade quantity from the LLM causes an HTTP 500 after the turn is stored

**File:** `backend/app/chat/service.py:40-43` (also `backend/app/chat/schemas.py:13`, `backend/app/chat/service.py:109-115`)
**Issue:** `ChatReply.model_validate_json` accepts `NaN`, `Infinity` and `1e999` as `float` quantities. I confirmed this by running `ChatReply.model_validate_json` on each input. The result was `nan`, `inf` and `inf`.

`execute_trade` rejects `inf` through the cash check ("Insufficient cash: need $inf") and rejects NaN through `not quantity > 0`. Either way the action is recorded as `failed`. `describe_trade` copies the raw `quantity` into the action dict, so the action carries `inf` or `nan`.

`handle_chat_message` then does two things with that action dict:
- `repository.insert_chat_message` stores it with `json.dumps`, which accepts non-finite floats, so the turn is committed.
- FastAPI serializes the response with `allow_nan=False`, which raises.

I reproduced this through `TestClient`. A model reply with `"quantity": Infinity` returned **500 Internal Server Error**. The user and assistant messages were already committed, and a second POST also returned 500.

This breaks HARD-01 (the model's output should map to 502, not 500). It also breaks HARD-05 (one bad action must not abort the turn). A flaky or adversarial model can trigger it with one token.
**Fix:** Reject non-finite numbers at the schema boundary so they surface as a 502 `BAD_REPLY_ERROR` before anything runs:
```python
# schemas.py
class TradeInstruction(BaseModel):
    ticker: str
    side: Literal["buy", "sell"]
    quantity: float = Field(allow_inf_nan=False)
```
Optionally also guard in `execute_trade` with `math.isfinite(quantity)`, so REST trades with `Infinity` fail with 400. Add a `test_parse_malformed_raises` case for `NaN` and `Infinity`.

## Warnings

### WR-01: The 30 s LLM timeout is multiplied by silent SDK retries (HARD-03)

**File:** `backend/app/chat/llm.py:44`
**Issue:** `timeout=TIMEOUT_SECONDS` is passed to `acompletion`, but LiteLLM's OpenAI-compatible handler keeps the OpenAI SDK's default of 2 retries. I measured this with a local server that accepts connections and never replies. Called as `acompletion(..., timeout=1)` against `openai/x` on `127.0.0.1`, it opened 3 connections and raised `Timeout` after 4.7 s. I used the `openai/` provider, so the OpenRouter route could differ.

If the OpenRouter route behaves the same way, a hung provider holds a chat request for about 3 x 30 s plus backoff, roughly 95 s. The user would wait far past the intended bound. The PLAN says "no retry". The comment on `TIMEOUT_SECONDS` ("LiteLLM's default would hold a request for 600 s") shows the intent was a hard cap.
**Fix:**
```python
response = await acompletion(..., timeout=TIMEOUT_SECONDS, num_retries=0)
```
Add a test asserting `captured["num_retries"] == 0`, next to the existing `timeout` assertion.

### WR-02: `savepoint()` replaces the original exception when SQLite has already rolled back

**File:** `backend/app/db/connection.py:52-62`
**Issue:** The error path runs `ROLLBACK TO unit` and then `RELEASE unit`. If the failing statement made SQLite roll back the whole transaction, the savepoint no longer exists. Cases include `SQLITE_FULL`, `IOERR`, `NOMEM` and `BUSY_SNAPSHOT`. The `ROLLBACK TO` then raises `OperationalError: no such savepoint: unit`, which replaces the real cause.

I reproduced this by issuing `ROLLBACK` inside a `savepoint()` block and raising `RuntimeError("original")`. The caller saw `OperationalError no such savepoint: unit`. The traceback is chained, but `run_action` logs and reports the wrong exception type. The tests only simulate failures at the Python level (`monkeypatch` raising `OperationalError`), so they never exercise this path.
**Fix:** Do not let cleanup failures mask the cause:
```python
except Exception:
    if conn.in_transaction:
        conn.execute("ROLLBACK TO unit")
        conn.execute("RELEASE unit")
    raise
```
If SQLite already rolled back, `in_transaction` is False and the original error propagates untouched. A nested savepoint after an auto-rollback is an edge case; the outer `get_connection` rollback covers it.

### WR-03: A failing chat-message insert leaves committed actions with no stored record (HARD-05)

**File:** `backend/app/chat/service.py:109-115`
**Issue:** Each watchlist change and trade commits independently, because the outermost savepoint releases to a commit. This is deliberate and tested. The final `with savepoint(conn):` that stores the user and assistant messages is the only place the executed actions get recorded. If that insert fails (disk full, lock timeout), the exception propagates as a 500. By then the trades are committed, and the chat history and the LLM's next-turn context contain no trace of them. The HARD-05 requirement says "every executed action is reflected in the stored chat message".

The write-lock-not-held-across-the-LLM constraint makes full atomicity impossible. The failure mode is still silent and unrecoverable for the user: the money has moved, but the UI shows a 500 and the history shows nothing.
**Fix:** Pick one and document it in the docstring. Either option is small:
- Log at `logger.exception` level with the action list before re-raising, so the record is recoverable from logs.
- Return the reply with its actions anyway (catch the insert failure and log it), since the actions did execute and the client should see them.

## Info

### IN-01: Single-statement savepoints in the watchlist service exist only to force an early commit

**File:** `backend/app/services/watchlist.py:28-29, 36-38`
**Issue:** A savepoint around one `INSERT ... ON CONFLICT DO NOTHING` or one `DELETE` provides no extra atomicity, since a single statement is already atomic. Its only effect is that, when outermost, `RELEASE` commits immediately and drops the write lock before the following `await source.remove_ticker(...)`. That is the property `test_actions_commit_one_by_one_without_spanning_awaits` relies on. Nothing in code or docstring says so. The `savepoint` docstring ("Atomic unit of work") hides the coupling, and a future refactor could remove the wrapper as redundant and reintroduce a lock held across an await.
**Fix:** Add one comment at each site, for example `# commit now so no write lock is held across the await below`. Alternatively, expose that intent as a separate named helper.

### IN-02: Action records use `.upper()` where the service normalizes with `strip().upper()`

**File:** `backend/app/chat/service.py:29-36`
**Issue:** `describe_trade` and `describe_watchlist_change` build the recorded ticker with `ticker.upper()`. The actual execution path uses `normalize_ticker`, which strips whitespace first. A model value like `" aapl"` executes against `AAPL`, but the stored and displayed action says `" AAPL"`. That is cosmetic, but the same record is replayed to the LLM as history. The same helper also yields over-cap `skipped` entries with unnormalized tickers.
**Fix:** Use `normalize_ticker(trade.ticker)` in both `describe_*` helpers.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
