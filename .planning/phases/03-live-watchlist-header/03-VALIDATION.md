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
| 03-01-T1 | 03-01 | 1 | LIVE-01, LIVE-03 | T-03-04 | Tracer: one `EventSource` at `/api/stream/prices` puts AAPL's live price and daily change into its REST-listed row; MSFT stays `--`; unmount closes the stream | component (end to end in jsdom) + build | `npm --prefix frontend test -- src/components/Dashboard.test.tsx` | ❌ W0 | ⬜ pending |
| 03-01-T2 | 03-01 | 1 | LIVE-01, LIVE-02, LIVE-05 | T-03-01, T-03-02 | Merge never replaces; repeat timestamp ignored; seed never overwrites the stream; history caps at 300; open/error/readyState status; CLOSED recreated after 1 s; unmount clears the timer; server snapshots | unit | `npm --prefix frontend test -- src/lib/priceStore.test.ts src/lib/priceStream.test.ts src/lib/usePrice.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02-T1 | 03-02 | 2 | LIVE-04 | T-03-05 | Up/down flash with `data-flash`, held 50 ms then idle fade class; equal, first, repeat and sticky-direction frames never flash; reduced-motion classes | component | `npm --prefix frontend test -- src/components/FlashingPrice.test.tsx` | ❌ W0 | ⬜ pending |
| 03-02-T2 | 03-02 | 2 | LIVE-05 | — | Empty 64x20 box under 2 points; line with up/down/muted stroke; no focus stop; reset after `clearTicker` | component | `npm --prefix frontend test -- src/components/Sparkline.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-T1 | 03-03 | 2 | LIVE-02 | T-03-07 | Dot starts `reconnecting`; through the real stream: connected, reconnecting, disconnected, recreated, connected; `role="status"` with hidden text, no `aria-label`; page `h1` | component | `npm --prefix frontend test -- src/components/Header.test.tsx` | ✅ (must change) | ⬜ pending |
| 03-03-T2 | 03-03 | 2 | LIVE-08 | T-03-08 | Total = cash + Σ qty × live price, falling back to `current_price`; API `total_value` ignored; cash `$10,000.00` on an empty portfolio | unit + component | `npm --prefix frontend test -- src/lib/portfolioValue.test.ts src/components/Header.test.tsx` | ❌ W0 | ⬜ pending |
| 03-03-T3 | 03-03 | 2 | LIVE-08 (WR-01) | — | Single Intl rounding: `$1.01` for 1.005, `-$0.01` for -0.005, no signed zero | unit | `npm --prefix frontend test -- src/lib/format.test.ts` | ✅ (must change) | ⬜ pending |
| 03-04-T1 | 03-04 | 2 | LIVE-03 | T-03-09 | Loading, failed, empty states; rows in REST order; held-only ticker gets no row; `--` placeholder; change % from `open_price` | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx` | ❌ W0 | ⬜ pending |
| 03-04-T2 | 03-04 | 2 | LIVE-03 (D-01, D-05) | — | 1280px grid classes; every panel is a named region; `color-scheme: dark` | component + source | `npm --prefix frontend test -- src/components/Dashboard.test.tsx` | ✅ (extend) | ⬜ pending |
| 03-05-T1 | 03-05 | 3 | LIVE-06, LIVE-03 | T-03-11, T-03-13 | Input uppercased; exact POST body; row appears and scrolls into view; 400 text inline as literal text; disabled while pending or empty; reload keeps streamed prices | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx` | ❌ W0 (created by 03-04) | ⬜ pending |
| 03-05-T2 | 03-05 | 3 | LIVE-07 | T-03-12, T-03-14 | `DELETE /api/watchlist/{encodeURIComponent(ticker)}` then reload only; × disabled in flight; 404 converges silently; store cleared; focus to input | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx` | ❌ W0 (created by 03-04) | ⬜ pending |
| 03-05-T3 | 03-05 | 3 | LIVE-01..LIVE-08 | T-03-15 | Rebuilt container on 127.0.0.1:8010 with a tmpfs DB passes fresh-start, sse-reconnect, and watchlist add/remove | e2e | `cd test && BASE_URL=http://127.0.0.1:8010 npx playwright test fresh-start.spec.ts sse-reconnect.spec.ts watchlist.spec.ts -g "fresh start\|reconnects after\|adding and removing" --reporter=list` | ✅ (specs exist) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/priceStore.test.ts` — merge, no-replace, repeat-timestamp skip, flash direction, history cap, reset (LIVE-01, LIVE-04, LIVE-05)
- [ ] `frontend/src/lib/priceStream.test.ts` — status mapping and CLOSED recreation with `FakeEventSource` (LIVE-01, LIVE-02)
- [ ] `frontend/src/lib/portfolioValue.test.ts` (LIVE-08)
- [ ] `frontend/src/components/{Watchlist,FlashingPrice,Sparkline}.test.tsx` (LIVE-03..LIVE-07)
- [ ] `frontend/src/test/fixtures.ts` — `makeFrame()` builder (portfolio stubs stay local to the tests that use them)
- [ ] `frontend/vitest.setup.ts` — `resetPriceStore()` in the global `afterEach`
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
