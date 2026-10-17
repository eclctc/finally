---
phase: "05"
slug: "ai-chat"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-16"
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| user input -> backend | The typed message is posted to `POST /api/chat`; the backend calls the LLM and validates every action | Message text |
| backend error text -> DOM | 502 bodies and network failures are rendered in the chat error block | Error message |
| chat reply -> shared state | Ok actions trigger portfolio, history and watchlist refreshes, price-store cleanup and row highlights | Action tickers, statuses |
| user action -> chat state | Collapse and expand change only local view state; an in-flight request continues | View state |
| host -> verification container | `finally-p5` publishes the app for the gate and UAT | HTTP |
| plan executor -> E2E specs | The executor could edit specs to pass the gate | Spec files |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Tampering | Assistant text, action tickers and errors | medium | mitigate | React text children only; 0 `dangerouslySetInnerHTML` in `frontend/src`; `<img onerror>` payload test asserts no `img` (`frontend/src/components/ChatBubble.test.tsx:12,105`) | closed |
| T-05-02 | Repudiation | Failed or skipped action shown as executed | medium | mitigate | `data-status={action.status}` (`frontend/src/components/ChatBubble.tsx:26`); failed chips say `failed - {reason}`; mixed-outcome tests | closed |
| T-05-03 | Tampering | Refresh error reported as a chat error | low | mitigate | `onActionsApplied` called after the try/catch (`frontend/src/lib/useChat.ts:53`) | closed |
| T-05-04 | Tampering | Double submission of one chat message | medium | mitigate | `inFlight` ref guard (`frontend/src/lib/useChat.ts:25-31`), Send disabled and textarea `readOnly` while pending; one-POST tests | closed |
| T-05-05 | Tampering | Starter chip triggering a mocked trade | low | mitigate | `QUICK_PROMPTS` keyword test (`frontend/src/lib/chat.test.ts:53`) | closed |
| T-05-06 | Information disclosure | Error text in `chat-error` | low | accept | See AR-01 | closed |
| T-05-07 | Tampering | Model-supplied ticker passed to `clearTicker` | low | accept | See AR-02 | closed |
| T-05-08 | Tampering | Overlapping watchlist loads | low | accept | See AR-03 | closed |
| T-05-09 | Denial of service (local) | Timers and listeners in `aiChangeStore.ts` | low | mitigate | Timers cleared on repeat mark and reset (`frontend/src/lib/aiChangeStore.ts:34,56`); `resetAiChanges()` in `frontend/vitest.setup.ts:54`; restart and reset tests | closed |
| T-05-10 | Repudiation | Highlight implying a change that did not happen | low | mitigate | Marks only after every refresh resolves `true` (`frontend/src/components/Dashboard.tsx:46`); failed-action, removal and failed-refresh tests | closed |
| T-05-11 | Tampering | Ticker used as store key and attribute | low | accept | See AR-02 | closed |
| T-05-12 | Tampering | Collapse dropping an in-flight request | medium | mitigate | `useChat` at the top of `ChatDock` above both views (`frontend/src/components/ChatDock.tsx:14`); reply-while-collapsed test | closed |
| T-05-13 | Information disclosure | Gate and UAT containers | low | mitigate | `127.0.0.1` only, `--tmpfs /app/db`, only `LLM_MOCK` passed by the orchestrator; `finally-p5` and `finally-p5-nokey` removed after the gate and UAT (only `finally-p1` remains) | closed |
| T-05-14 | Repudiation / Tampering | E2E specs edited to pass the gate | medium | mitigate | `git log 85bb11844b..HEAD -- test/tests` and `git status --porcelain -- test/tests` both empty | closed |
| T-05-15 | Information disclosure | Conversation persisted in browser storage | low | mitigate | 0 `localStorage`/`sessionStorage`/`indexedDB` references in `frontend/src` | closed |
| T-05-SC | Tampering | npm installs | high | mitigate | `git diff 1206881..HEAD` of frontend and test `package.json` / `package-lock.json` is empty; `npm ci` from committed lockfiles only | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-05-06 | Backend 502 bodies are fixed public sentences (HARD-02); upstream detail stays in the server log; rendered as text | plan 05-02 threat model | 2026-10-16 |
| AR-02 | T-05-07, T-05-11 | Tickers are backend-validated and executed; used only as `Map` keys, text and React-escaped attributes, never in selectors or markup | plans 05-03, 05-04 threat models | 2026-10-16 |
| AR-03 | T-05-08 | Single user, rare overlap; the next load corrects it; nothing is written client-side | plan 05-03 threat model | 2026-10-16 |

*Accepted risks do not resurface in future audit runs.*

Open code-review advisories (WR-01..WR-03, IN-01..IN-04 in `05-REVIEW-DISPOSITION.md`) are tracked there. WR-01 (a lost chat response shows a retry prompt without refreshing, so a resend can re-execute trades the backend already ran) is adjacent to T-05-04: it is a user-driven duplicate after a network failure, not a double submit, and the backend still validates cash and shares.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-16 | 16 | 16 | 0 | secure-phase orchestrator (ASVS L1 grep evidence; register authored at plan time, auditor short-circuited) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-16
