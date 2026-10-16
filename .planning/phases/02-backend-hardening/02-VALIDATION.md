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
| 02-01-T1 | 02-01 | 1 | HARD-02 | T-02-01, T-02-03 | 502 body is the fixed `UPSTREAM_ERROR`; upstream text only in `caplog`; missing-key message names `OPENROUTER_API_KEY` | route + unit | `cd backend && uv run pytest -q tests/chat/test_router.py tests/chat/test_llm.py` | ✅ extend (update `upstream down` test) | ⬜ pending |
| 02-01-T2 | 02-01 | 1 | HARD-01, HARD-03 | T-02-01, T-02-02 | No choices / None message give `UPSTREAM_ERROR`; bad content gives `BAD_REPLY_ERROR`; `timeout=30`; `Timeout` gives `TIMEOUT_ERROR`; all 502 | unit + route | `cd backend && uv run pytest -q tests/chat/` | ✅ extend | ⬜ pending |
| 02-02-T1 | 02-02 | 1 | HARD-04 | T-02-04 | Concurrent duplicate adds: no exception, one row | service + db | `cd backend && uv run pytest -q tests/services/test_watchlist.py tests/db/test_repository.py tests/routes` | ✅ extend (update duplicate-raises test) | ⬜ pending |
| 02-02-T2 | 02-02 | 1 | HARD-08 | T-02-05 | Query plans use indexes, no temp b-tree; `init_db` adds them to an existing DB | db | `cd backend && uv run pytest -q tests/db/` | new `tests/db/test_indexes.py` | ⬜ pending |
| 02-03-T1 | 02-03 | 1 | HARD-07 | T-02-06 | Simulator re-add keeps `open_price` and resumes at the last price | unit | `cd backend && uv run pytest -q tests/market/test_simulator.py tests/market/test_cache.py` | ✅ extend (update restart-at-seed test) | ⬜ pending |
| 02-03-T2 | 02-03 | 1 | HARD-07 | T-02-06 | Cache keeps the open across remove/re-add; Massive re-add keeps the open | unit | `cd backend && uv run pytest -q tests/market/` | ✅ extend | ⬜ pending |
| 02-04-T1 | 02-04 | 1 | HARD-05 | T-02-07, T-02-08 | Unexpected failure on trade 2 of 3 is `failed` with `UNEXPECTED_ERROR`; others commit; stored actions equal returned | service | `cd backend && uv run pytest -q tests/chat/test_service.py tests/services tests/routes tests/db` | ✅ extend | ⬜ pending |
| 02-04-T2 | 02-04 | 1 | HARD-05 | T-02-09 | No transaction across awaits or the LLM call; savepoint commit / nested rollback / re-raise; trade + snapshot one unit | service + db | `cd backend && uv run pytest -q tests/chat/test_service.py tests/db/test_connection.py tests/services/test_portfolio.py tests/services/test_watchlist.py tests/routes` | ✅ extend; savepoint tests new | ⬜ pending |
| 02-05-T1 | 02-05 | 2 | HARD-06 | T-02-10, T-02-11 | 7 + 7 actions: 5 executed each, 2 `failed` each with the skip reason; boundary 5/6; per-kind cap | service | `cd backend && uv run pytest -q tests/chat/` | ✅ extend | ⬜ pending |
| 02-05-T2 | 02-05 | 2 | HARD-06, INT-04 | — | Prompt states the cap; every Phase 2 test file passes alone and in the full suite | full | `cd backend && uv run pytest -q` | ✅ | ⬜ pending |

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
