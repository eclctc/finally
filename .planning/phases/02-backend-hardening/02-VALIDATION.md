---
phase: "2"
slug: "backend-hardening"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-16"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.1.1 + pytest-asyncio 1.4.0 (`asyncio_mode = "auto"`) |
| **Config file** | `backend/pyproject.toml` (`testpaths = ["tests"]`, `pythonpath = ["."]`) |
| **Quick run command** | `cd backend && uv run pytest -q tests/<area>/<file>.py` |
| **Full suite command** | `cd backend && uv run pytest -q` |
| **Estimated runtime** | ~2 seconds (103 passed at baseline) |

---

## Sampling Rate

- **After every task commit:** Run the touched test file(s) with the quick command
- **After every plan wave:** Run `cd backend && uv run pytest -q`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

Filled in by the planner and executor as tasks are created. Requirement-level map from RESEARCH.md:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | HARD-01 | — | Empty choices / None message / bad content give `LLMError` and route 502, never 500 | unit + route | `cd backend && uv run pytest -q tests/chat/test_llm.py tests/chat/test_router.py` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | HARD-02 | T-02 info disclosure | 502 body is a fixed constant; upstream text only in `caplog`; missing-key message names `OPENROUTER_API_KEY` | unit + route | same as above | ✅ extend (update `upstream down` test) | ⬜ pending |
| TBD | TBD | TBD | HARD-03 | T-02 DoS | `acompletion` receives `timeout`; `litellm.exceptions.Timeout` gives 502 | unit + route | same as above | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | HARD-04 | — | Concurrent duplicate adds: no exception, one row | service + db | `cd backend && uv run pytest -q tests/services/test_watchlist.py tests/db/test_repository.py` | ✅ extend (update duplicate-raises test) | ⬜ pending |
| TBD | TBD | TBD | HARD-05 | — | Unexpected failure rolls back only that action; stored actions equal returned; no transaction open during LLM call | service + db | `cd backend && uv run pytest -q tests/chat/test_service.py tests/db/test_connection.py tests/services/test_portfolio.py` | ✅ extend; savepoint tests new | ⬜ pending |
| TBD | TBD | TBD | HARD-06 | T-02 tampering | 7 + 7 actions: 5 executed each, 2 `failed` each with reason | service | `cd backend && uv run pytest -q tests/chat/test_service.py` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | HARD-07 | — | Remove then re-add keeps `open_price`; simulator resumes at last price | unit | `cd backend && uv run pytest -q tests/market/test_cache.py tests/market/test_simulator.py` | ✅ extend (update restart-at-seed test) | ⬜ pending |
| TBD | TBD | TBD | HARD-08 | — | Query plans use indexes, no temp b-tree; `init_db` adds them to an existing DB | db | `cd backend && uv run pytest -q tests/db/test_connection.py` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | INT-04 | — | N/A | full | `cd backend && uv run pytest -q` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Fixtures `conn`, `cache`, `source` exist in `tests/services/conftest.py` and `tests/chat/conftest.py`; new tests extend existing files.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
