---
phase: "02"
slug: "backend-hardening"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-16"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| LLM (OpenRouter) -> backend | Structured model output parsed into `ChatReply` and auto-executed | Untrusted JSON (trades, watchlist changes, text) |
| backend -> browser | `POST /api/chat` error bodies and action records | Error messages, action results |
| chat history -> LLM | Stored `actions` replayed as context next turn | Failure reasons |
| REST client -> `POST /api/portfolio/trade` | Manual trade bodies | Ticker, side, quantity |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Information disclosure | LLM error text in 502 bodies | high | mitigate | Fixed `UPSTREAM_ERROR`/`TIMEOUT_ERROR`/`BAD_REPLY_ERROR` constants (`backend/app/chat/llm.py:19-21`); 0 interpolated `LLMError(f` | closed |
| T-02-02 | Denial of service | `acompletion` with no timeout | medium | mitigate | `timeout=TIMEOUT_SECONDS` (30) and `except Timeout` (`llm.py:18,44,47`) | closed |
| T-02-03 | Information disclosure | Server log of LLM failures | low | mitigate | Logs carry fixed messages plus the exception only (02-01 SUMMARY; verifier) | closed |
| T-02-04 | Denial of service | Concurrent duplicate watchlist adds | medium | mitigate | `ON CONFLICT (user_id, ticker) DO NOTHING` (`backend/app/db/repository.py:45`) + race test | closed |
| T-02-05 | Denial of service | Unindexed history/chat queries | low | mitigate | `idx_snapshots_user_time`, `idx_chat_user_time` (`backend/app/db/schema.sql:51-52`) + query-plan test | closed |
| T-02-06 | Tampering | Session open reset on re-add | low | mitigate | `_session_opens` (`backend/app/market/cache.py:16,30`), `last_prices` (`backend/app/market/simulator.py:40,47`) | closed |
| T-02-07 | Tampering | Partial chat turn vs DB | high | mitigate | `savepoint()` (`backend/app/db/connection.py:53`) + `run_action` isolation; tests pass | closed |
| T-02-08 | Information disclosure | Raw exception text in stored actions | medium | mitigate | `UNEXPECTED_ERROR` constant (`backend/app/chat/service.py:19`) | closed |
| T-02-09 | Denial of service | Lock held across await | medium | mitigate | Savepoints wrap only synchronous writes; `conn.in_transaction` guard tests | closed |
| T-02-10 | Elevation of privilege | Unbounded AI-proposed actions | high | mitigate | `MAX_ACTIONS_PER_KIND = 5` slicing (`service.py:87-95`) + cap tests | closed |
| T-02-11 | Repudiation | Skipped actions invisible | low | mitigate | Skipped items returned and stored with a reason (`service.py:81`) | closed |
| T-02-12 | Denial of service | Non-finite trade quantity from the model | high | mitigate | `Field(allow_inf_nan=False)` (`backend/app/chat/schemas.py:13`); verifier reproduced 502 for 20 non-finite inputs | closed |
| T-02-13 | Repudiation | Turn committed while response fails | medium | mitigate | Rejection before any write; route test asserts no rows, no positions | closed |
| T-02-14 | Information disclosure | 502 body for rejected reply | low | mitigate | Body equals `BAD_REPLY_ERROR` exactly (test assertion) | closed |
| T-02-15 | Tampering | REST trade with non-finite quantity | low | accept | See AR-01 | closed |
| T-02-SC | Tampering | Package installs | low | accept | See AR-02; `git diff 6ba74b2..HEAD -- backend/pyproject.toml backend/uv.lock` is empty | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-02-15 | All 8 non-finite buy/sell bodies already return 400 via `execute_trade`'s checks (planner probe, re-confirmed by plan checker and code reviewer); no 500 or state change | plan 02-06 threat model | 2026-10-16 |
| AR-02 | T-02-SC | No plan installed or upgraded a package; backend lockfile unchanged | plans 02-01..02-06 threat models | 2026-10-16 |

*Accepted risks do not resurface in future audit runs.*

Open code-review advisories (WR-01..WR-03, IN-01..IN-03 in `02-REVIEW-DISPOSITION.md`) are quality items below the blocking threshold and are tracked there.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-16 | 16 | 16 | 0 | secure-phase orchestrator (ASVS L1 grep evidence + verifier behavioral checks) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-16
