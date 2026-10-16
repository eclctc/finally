---
phase: "3"
slug: "live-watchlist-header"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-16"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.5 + React Testing Library 16.3.3 + jest-dom 7.0.1 (jsdom 30.1.3); Playwright 1.64.1 for in-phase browser checks |
| **Config file** | `frontend/vitest.config.mts`, `frontend/vitest.setup.ts` (stubs `ResizeObserver`, `EventSource` -> `FakeEventSource`, `scrollIntoView`) |
| **Quick run command** | `npm --prefix frontend test -- <touched test file>` |
| **Full suite command** | `npm --prefix frontend test && npm --prefix frontend run typecheck && npm --prefix frontend run build` |
| **Estimated runtime** | ~5 seconds for Vitest (35 passed at baseline); build ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the touched test file(s) with the quick command
- **After every plan wave:** Run `npm --prefix frontend test && npm --prefix frontend run typecheck`
- **Before `/gsd-verify-work`:** Full suite plus build green, then `cd test && BASE_URL=http://localhost:8010 npx playwright test sse-reconnect.spec.ts fresh-start.spec.ts watchlist.spec.ts -g "adding and removing"` against a rebuilt container on a fresh volume
- **Max feedback latency:** 10 seconds (Vitest)

---

## Per-Task Verification Map

Filled in by the planner and executor as tasks are created. Requirement-level map from RESEARCH.md:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | LIVE-01 | — | Frame with only AAPL updates AAPL only; repeat timestamp ignored; one `EventSource` at `/api/stream/prices`; cleanup closes it | unit | `npm --prefix frontend test -- src/lib/priceStore.test.ts src/lib/priceStream.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIVE-02 | reconnect storm | open -> connected; error at CONNECTING -> reconnecting; error at CLOSED -> disconnected, new source after fixed 1 s delay; unmount clears timer | unit + component | `npm --prefix frontend test -- src/lib/priceStream.test.ts src/components/Header.test.tsx` | ❌ W0 (Header test exists, must change) | ⬜ pending |
| TBD | TBD | TBD | LIVE-03 | — | Rows follow `GET /api/watchlist` order; held-only ticker creates no row; no-price row shows `--`; change % uses `open_price` | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIVE-04 | — | Up tick -> up class, down tick -> down class; equal/first/repeat -> no class; cleared after hold | component | `npm --prefix frontend test -- src/components/FlashingPrice.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIVE-05 | unbounded memory | History grows per new tick and caps at 300; cleared on remove; sparkline renders an `svg` path | unit + component | `npm --prefix frontend test -- src/lib/priceStore.test.ts src/components/Sparkline.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIVE-06 | reflected error text | Input uppercased; 400 text rendered inline as literal text; button disabled while pending; list refetched on success | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIVE-07 | path injection | `DELETE /api/watchlist/{encodeURIComponent(ticker)}`; row disappears after refetch; 404 still converges | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | LIVE-08 | — | Total = cash + Σ qty × live price, falls back to `current_price`; cash `$10,000.00` on empty portfolio | unit + component | `npm --prefix frontend test -- src/lib/portfolioValue.test.ts src/components/Header.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/priceStore.test.ts` — merge, no-replace, repeat-timestamp skip, flash direction, history cap, reset (LIVE-01, LIVE-04, LIVE-05)
- [ ] `frontend/src/lib/priceStream.test.ts` — status mapping and CLOSED recreation with `FakeEventSource` (LIVE-01, LIVE-02)
- [ ] `frontend/src/lib/portfolioValue.test.ts` (LIVE-08)
- [ ] `frontend/src/components/{Watchlist,FlashingPrice,Sparkline}.test.tsx` (LIVE-03..LIVE-07)
- [ ] `frontend/src/test/fixtures.ts` — `makeFrame()`, `makePortfolio()` builders
- [ ] `frontend/vitest.setup.ts` — `priceStore.reset()` in the global `afterEach`
- [ ] Update `frontend/src/components/Header.test.tsx` — stubs gain `positions: []`; replace "starts disconnected"; assert `data-status` mapping

Framework install: none.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Price flash fades green/red over ~500ms | LIVE-04 | CSS transitions do not run in jsdom | Open the rebuilt container in a browser; watch rows tick |
| Connection dot colors through a backend stop/start | LIVE-02 | Visual color check | Stop then restart the container; dot goes yellow, then green |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
