---
phase: "04"
slug: "trading-portfolio"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-16"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| user input -> backend | Trade bar posts `{ticker, side, quantity}` to `POST /api/portfolio/trade`; backend validates | Ticker, side, quantity |
| backend error text -> DOM | 400 body echoes user input into `trade-error` | Error message |
| backend REST -> browser DOM | `/api/portfolio` and `/api/portfolio/history` rendered into header, table, heatmap and charts | Positions, cash, snapshots |
| concurrent requests -> shared state | Poll GETs and trade responses race to set the one portfolio and history source | Portfolio, history |
| host -> verification container | `finally-p4` publishes the app for the gate and UAT | HTTP |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | Trade error and fill text | medium | mitigate | React text children only; `<img onerror>` payload test in `TradeBar.test.tsx`; 0 `dangerouslySetInnerHTML` in `frontend/src` | closed |
| T-04-02 | Tampering | Double submission of a market order | medium | mitigate | `canTrade = !inFlight && ...` (`frontend/src/components/TradeBar.tsx:56`); "one POST for two clicks" test | closed |
| T-04-03 | Tampering | Trade from the Enter key | medium | mitigate | No `<form>` in `TradeBar.tsx`, both buttons `type="button"`; Enter-sends-nothing test | closed |
| T-04-04 | Tampering | Stale GET overwriting the post-trade portfolio | medium | mitigate | `generation` ref in `frontend/src/lib/usePortfolio.ts:15-24`; both orderings tested | closed |
| T-04-05 | Denial of service | 30 s portfolio poll | low | accept | See AR-01 | closed |
| T-04-06 | Tampering | Default selection overwriting a typed ticker | medium | mitigate | `hadSelection` rule (`TradeBar.tsx:44`); "typed MSFT survives the first selection" test | closed |
| T-04-07 | Tampering | Remove click selecting the row | low | mitigate | `stopPropagation()` and `target !== currentTarget` check (`frontend/src/components/WatchlistRow.tsx:40,71`); tests | closed |
| T-04-08 | Tampering | Selection triggering a trade | medium | mitigate | Selection sets state only; `fetchMock` not-called test (`TradeBar.test.tsx:115`) | closed |
| T-04-09 | Tampering | Ticker text in chart caption | low | accept | See AR-02 | closed |
| T-04-10 | Denial of service | Per-ticker series growth | low | mitigate | `HISTORY_LIMIT = 1200` (`frontend/src/lib/priceStore.ts:6`); 1,199/1,200/1,201 test | closed |
| T-04-11 | Tampering | Ticker and tooltip text in main chart | low | accept | See AR-02 | closed |
| T-04-12 | Tampering | Ticker text in heatmap tiles | low | mitigate | SVG `<title>`/`<text>` children as React text; 0 raw-HTML props; 0 `clipPath` in `Heatmap.tsx` | closed |
| T-04-13 | Information disclosure | P&L by color only | low | mitigate | `<title>` with ticker, value and percent on every tile (`frontend/src/components/Heatmap.tsx:31`); percent on large tiles; positions table equivalent | closed |
| T-04-14 | Tampering | Ticker text in position rows | low | mitigate | React text nodes; hostile-ticker test in `PositionsTable.test.tsx` | closed |
| T-04-15 | Information disclosure | Fetch-time P&L shown as live | low | mitigate | `livePosition` in `frontend/src/components/PositionRow.tsx`; 0 `unrealized_pnl` references in the row; test asserts it is never shown | closed |
| T-04-16 | Denial of service | History payload size | low | accept | See AR-01 | closed |
| T-04-17 | Tampering | Overlapping history GETs out of order | low | mitigate | `latest` request counter (`frontend/src/lib/usePortfolioHistory.ts:14`); later-started-wins test | closed |
| T-04-18 | Tampering | Tooltip and baseline text | low | accept | See AR-02 | closed |
| T-04-19 | Information disclosure | Gate and UAT container `finally-p4` | low | mitigate | Published on `127.0.0.1:8010` only, `--tmpfs /app/db`, only `LLM_MOCK=true` passed; removed after the gate and after UAT (no `finally-p4` container remains) | closed |
| T-04-20 | Repudiation / Tampering | E2E specs edited to pass the gate | medium | mitigate | `git log c0701ffe5e..HEAD -- test/tests` and `git status --porcelain -- test/tests` both empty | closed |
| T-04-SC | Tampering | npm installs | high | mitigate | `git diff 734ff2c..HEAD` of frontend and test `package.json` / `package-lock.json` is empty; `npm ci` from the committed lockfiles only | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-04-05, T-04-16 | Local single-user app: one small same-origin GET per 30 s each for portfolio and history, cleared on unmount; backend prunes snapshots older than 7 days and the client downsamples to 300 points (server bucketing deferred to DATA-V2-01) | plans 04-01, 04-06 threat models | 2026-10-16 |
| AR-02 | T-04-09, T-04-11, T-04-18 | React and Recharts render tickers, tooltips and baseline labels as text nodes from the same-origin backend payload; the backend enforces `^[A-Z]{1,5}$` on tickers and values are `Intl`-formatted numbers | plans 04-02, 04-03, 04-06 threat models | 2026-10-16 |

*Accepted risks do not resurface in future audit runs.*

Open code-review advisories (WR-01..WR-05, IN-01..IN-08 in `04-REVIEW-DISPOSITION.md`) are robustness and display items and are tracked there. WR-04 (a failed or lost trade POST shows a generic retry message without checking whether the order filled) is adjacent to T-04-02: it is a user-driven duplicate-order risk after a network failure, not a double-submit, and the backend still validates cash and shares.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-16 | 21 | 21 | 0 | secure-phase orchestrator (ASVS L1 grep evidence; register authored at plan time, auditor short-circuited) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-16
