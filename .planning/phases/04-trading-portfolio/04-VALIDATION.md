---
phase: "4"
slug: "trading-portfolio"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-16"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.5 + React Testing Library 16.3.3 + jest-dom 7.0.1 (jsdom 30.1.3); Playwright 1.64.1 in `test/` for the phase gate |
| **Config file** | `frontend/vitest.config.mts`, `frontend/vitest.setup.ts` (stubs `ResizeObserver` at 800x400, `EventSource`, `scrollIntoView`; `resetPriceStore()` after each test) |
| **Quick run command** | `npm --prefix frontend test -- <touched test file>` |
| **Full suite command** | `npm --prefix frontend test && npm --prefix frontend run typecheck && npm --prefix frontend run build` |
| **Estimated runtime** | ~2 seconds for Vitest (138 tests at baseline); build ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm --prefix frontend test -- <touched test file>`
- **After every plan wave:** Run `npm --prefix frontend test && npm --prefix frontend run typecheck`
- **Before `/gsd-verify-work`:** Full suite + build green, `cd backend && uv run pytest`, then the E2E gate (`trading.spec.ts`, `portfolio-charts.spec.ts`, `watchlist.spec.ts` against a container on `127.0.0.1:8010` with tmpfs DB and `LLM_MOCK=true`)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Filled in by the planner and executors. Requirement-to-test map (from 04-RESEARCH.md):

| Requirement | Test Type | Automated Command | File Exists | Status |
|-------------|-----------|-------------------|-------------|--------|
| TRADE-01 | component + unit | `npm --prefix frontend test -- src/components/Watchlist.test.tsx src/components/MainChart.test.tsx src/lib/priceStore.test.ts src/components/Sparkline.test.tsx` | partial (MainChart ❌ W0) | ⬜ pending |
| TRADE-02, TRADE-03, TRADE-04 | component | `npm --prefix frontend test -- src/components/TradeBar.test.tsx` | ❌ W0 | ⬜ pending |
| TRADE-05 | component + hook | `npm --prefix frontend test -- src/components/TradeBar.test.tsx src/components/Dashboard.test.tsx src/lib/usePortfolio.test.tsx` | partial | ⬜ pending |
| PORT-01 | unit + component | `npm --prefix frontend test -- src/lib/portfolioValue.test.ts src/components/PositionsTable.test.tsx` | partial | ⬜ pending |
| PORT-02 | component + unit (blocking spike) | `npm --prefix frontend test -- src/components/Heatmap.test.tsx` | ❌ W0 | ⬜ pending |
| PORT-03 | unit + component | `npm --prefix frontend test -- src/lib/pnlSeries.test.ts src/components/PnlChart.test.tsx` | ❌ W0 | ⬜ pending |
| PORT-04 | hook + component | `npm --prefix frontend test -- src/lib/usePortfolio.test.tsx src/components/PnlChart.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/Heatmap.test.tsx` — Treemap `<rect>` spike assertions (blocking first heatmap task), PORT-02
- [ ] `frontend/src/lib/usePortfolio.test.tsx` — 30 s poll with fake timers, stale-GET guard, silent background failure (TRADE-05, PORT-04)
- [ ] `frontend/src/lib/pnlSeries.test.ts`, `TradeBar.test.tsx`, `PositionsTable.test.tsx`, `MainChart.test.tsx`, `PnlChart.test.tsx`
- [ ] `frontend/src/test/fixtures.ts` — `makePortfolio` / `makePosition` / `makeTradeResponse` / `makeSnapshot` builders
- No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Heatmap labels clip inside tiles; chart tooltips appear on hover | PORT-02, PORT-03, TRADE-01 | jsdom cannot drive hover or measure real SVG clipping | Open the app, buy two tickers, hover the main chart and P&L chart, inspect the heatmap tiles |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
