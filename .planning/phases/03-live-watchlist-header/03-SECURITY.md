---
phase: "03"
slug: "live-watchlist-header"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-16"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| backend SSE -> browser store | Same-origin `/api/stream/prices` frames merged into client memory | Prices, timestamps |
| backend REST -> browser DOM | `/api/watchlist` and `/api/portfolio` rendered into rows, header and attributes | Tickers, cash, positions |
| EventSource events -> status UI | Stream lifecycle decides what the connection dot claims | open/error, readyState |
| user input -> backend | Typed symbol posted to `POST /api/watchlist`; backend validates | Ticker string |
| backend error text -> DOM | 400 body echoes raw user input into the page | Error message |
| ticker -> URL path | Ticker becomes a path segment of `DELETE /api/watchlist/{ticker}` | Ticker string |
| host -> verification container | `finally-p3` publishes the app for the gate and UAT | HTTP |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Denial of service | Per-ticker history | low | mitigate | `HISTORY_LIMIT = 300` (`frontend/src/lib/priceStore.ts:6`); 299/300/301 cap test | closed |
| T-03-02 | Denial of service | Stream recreation loop | low | mitigate | `RECREATE_DELAY_MS = 1000` (`frontend/src/lib/priceStream.ts:5`); 999/1000 ms and post-cleanup tests | closed |
| T-03-03 | Tampering | Malformed SSE frame | low | accept | See AR-01 | closed |
| T-03-04 | Spoofing | Stream origin | low | mitigate | `STREAM_URL = "/api/stream/prices"` (`priceStream.ts:3`); exactly 1 `new EventSource(` in app code | closed |
| T-03-05 | Denial of service | Flash timers | low | mitigate | One timer per cell, `clearTimeout` on cleanup (`frontend/src/components/FlashingPrice.tsx:27`) | closed |
| T-03-06 | Tampering | Ticker in attributes | low | accept | See AR-02 | closed |
| T-03-07 | Spoofing | Connection dot | low | mitigate | Status set only in `onopen` / `onerror` from `readyState` (`priceStream.ts:22,25`); message-never-sets-status test | closed |
| T-03-08 | Tampering | Live total with missing price | low | mitigate | Fallback to `current_price` (`frontend/src/lib/portfolioValue.ts:30`); portfolioValue and Header tests | closed |
| T-03-09 | Information disclosure | Watchlist load-failure message | low | mitigate | Fixed D-02 sentence only (`frontend/src/components/Watchlist.tsx:29`); 500 and rejection tests | closed |
| T-03-10 | Tampering | REST ticker strings | low | accept | See AR-02 | closed |
| T-03-11 | Tampering | Reflected 400 error text | medium | mitigate | React text node; `<img onerror>` payload test renders literal text; 0 `dangerouslySetInnerHTML` in `frontend/src` | closed |
| T-03-12 | Tampering | Ticker in DELETE path | low | mitigate | `encodeURIComponent(ticker)` (`frontend/src/lib/useWatchlist.ts:61`); `A/B` encoding test | closed |
| T-03-13 | Tampering | Duplicate add/remove | low | mitigate | Add disabled while pending or empty (`Watchlist.tsx:110`); remove disabled in flight (`WatchlistRow.tsx:45`); backend add idempotent | closed |
| T-03-14 | Elevation of privilege | Remove touching holdings | low | mitigate | Remove issues only DELETE then GET (request-list test in `Watchlist.test.tsx`) | closed |
| T-03-15 | Information disclosure | Verification container exposure | low | mitigate | `finally-p3` published on `127.0.0.1:8010` only, tmpfs DB, `LLM_MOCK=true`; remove after UAT | closed |
| T-03-SC | Tampering | npm installs | high | mitigate | `git diff c5fe156..HEAD` of frontend and test `package.json` / `package-lock.json` is empty; `npm ci` from the approved lockfile only | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-03-03 | Same-origin trusted stream; `JSON.parse` only, no `eval`; values reach the DOM only as JSX text through the formatters. No defensive parsing beyond skipping null prices, per the project's no-defensive-programming rule | plan 03-01 threat model | 2026-10-16 |
| AR-02 | T-03-06, T-03-10 | React escapes text and attribute values; the backend enforces `^[A-Z]{1,5}$` on every stored ticker | plans 03-02, 03-04 threat models | 2026-10-16 |

*Accepted risks do not resurface in future audit runs.*

Open code-review advisories (WR-01..WR-04, IN-01..IN-04 in `03-REVIEW-DISPOSITION.md`) are robustness and display items, not security threats, and are tracked there.

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
