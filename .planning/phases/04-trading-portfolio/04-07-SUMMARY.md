---
phase: 04-trading-portfolio
plan: 07
subsystem: testing
tags: [playwright, docker, e2e, vitest, pytest]

requires:
  - phase: 04-trading-portfolio
    provides: "Plans 04-01..04-06 merged: trade bar, main chart, heatmap, positions table, P&L chart, lifted usePortfolio"
provides:
  - "Proof in a real browser, on a fresh database, that TRADE-01..05 and PORT-01..04 hold on the rebuilt image"
  - "End-of-phase browser UAT checklist (in the plan, ready to run)"
affects: [05-ai-chat, 06-ship-e2e-gate]

actuals:
  tokens: 0
  tasks: 2
  commits: 0
plan_head_before: 68b79d2f5e65c85599d1758bc0178a41d4fce93a
plan_head_after: 68b79d2f5e65c85599d1758bc0178a41d4fce93a

tech-stack:
  added: []
  patterns:
    - "Gate container: image finally-phase4, container finally-p4 on 127.0.0.1:8010, --tmpfs /app/db, only LLM_MOCK=true"

key-files:
  created: []
  modified: []

key-decisions:
  - "No app fix was needed; the gate passed first time, so no fix(04-07) commit exists"

requirements-completed: [TRADE-01, TRADE-02, TRADE-03, TRADE-04, TRADE-05, PORT-01, PORT-02, PORT-03, PORT-04]

coverage:
  - id: D1
    description: "Frontend suite, typecheck, static build and source gates pass on the merged phase"
    verification:
      - kind: unit
        ref: "npm --prefix frontend test (22 files, 278 tests); run typecheck; run build"
        status: pass
    human_judgment: false
  - id: D2
    description: "Tracer: fresh-start plus a real-browser buy lowers cash and adds a position on the rebuilt container"
    requirement: "TRADE-01"
    verification:
      - kind: e2e
        ref: "test/tests/fresh-start.spec.ts; test/tests/trading.spec.ts#buying shares lowers cash and adds a position"
        status: pass
    human_judgment: false
  - id: D3
    description: "All nine Phase 4 E2E tests pass on a fresh database (TRADE-01..05, PORT-01..04)"
    requirement: "TRADE-05"
    verification:
      - kind: e2e
        ref: "playwright: fresh-start, sse-reconnect, watchlist, trading, portfolio-charts (9 passed, 0 failed, 0 flaky)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Backend suite unchanged and green (145 tests)"
    verification:
      - kind: unit
        ref: "cd backend && uv run pytest -q"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual and layout look: default selection, chart tooltips, dashed Open and Start lines, heatmap label clipping, pinned positions head, 1280x720 layout"
    verification: []
    human_judgment: true
    rationale: "Real layout, label clipping and tooltip look cannot be asserted by jsdom or the E2E specs; backstopped by the end-of-phase browser UAT"

duration: 2min
completed: 2026-10-16
status: complete
---

# Phase 4 Plan 07: End-of-phase real-browser gate Summary

**The rebuilt `finally-phase4` image passes all nine Phase 4 Playwright tests on a fresh database, with the frontend suite (278), typecheck, build, source gates and backend suite (145) green and no spec edited.**

## Performance

- **Duration:** ~2 min (Docker layers were cached)
- **Started:** 2026-10-16T23:09:07Z
- **Completed:** 2026-10-16T23:10:10Z
- **Tasks:** 2
- **Files modified:** 0 (verification only)

## Accomplishments

- Task 1 (tracer): `npm ci` for `frontend/` and `test/` from lockfiles only; Vitest 22 files / 278 tests pass; `tsc --noEmit` and `next build` pass (`SUITE_OK`). All seven source gates held (`GATES_OK`): no raw-HTML prop, no absolute URL, no literal testid in components, exactly one `EventSource(`, no pure black, no `<form` in `TradeBar.tsx`, no `clipPath` in `Heatmap.tsx`.
- Image `finally-phase4` built from the unchanged Dockerfile and run as `finally-p4` on `127.0.0.1:8010` with `--tmpfs /app/db -e LLM_MOCK=true`. `/api/health` ok and the served page contains `trade-buy` (`CONTAINER_OK`). Tracer specs: 2 passed (fresh-start and "buying shares lowers cash and adds a position").
- Task 2: container recreated for a fresh database (`FRESH_DB_OK`); full set `fresh-start`, `sse-reconnect`, `watchlist` (2), `trading` (4), `portfolio-charts`: **9 passed, 0 failed, 0 flaky**. `cd backend && uv run pytest -q`: 145 passed. `git log c0701ffe5e..HEAD -- test/tests` and `git status --porcelain -- test/tests` both empty (`SPECS_UNCHANGED`). `finally-p4` removed (`CONTAINER_REMOVED`, no container named `finally-p4` remains).
- Heatmap Treemap `<rect>` spike result is recorded in `04-04-SUMMARY.md` (leaf renderer, no clip-path); the `portfolio-charts` spec confirms a visible heatmap `svg rect` and a `path.recharts-curve` in the real browser.
- `finally-p1` on :8000 was `Up 8 hours (healthy)` at the start and at the end; never touched. `.env` was never read or passed to Docker.

## Task Commits

No source files changed, so there are no task commits. Both tasks were verification-only.

**Plan metadata:** the SUMMARY.md commit (docs(04-07)).

## Files Created/Modified

None (verification only). Image `finally-phase4` was built locally; container `finally-p4` was removed after the gate.

## Decisions Made

None - followed plan as specified. No failing spec, so no app fix was required.

## Deviations from Plan

None - plan executed exactly as written. Compound `&&` verify chains were run as separate commands where the sandbox refused compound git commands; every sub-check passed.

## Issues Encountered

None.

## End-of-Phase Browser UAT (to be run by a human)

Start the gate container again with `docker run -d --name finally-p4 -p 127.0.0.1:8010:8000 --tmpfs /app/db -e LLM_MOCK=true finally-phase4`, open http://127.0.0.1:8010 on a desktop browser (image `finally-phase4` is still present locally), then `docker rm -f finally-p4` afterwards.

1. First watchlist row (AAPL) selected on load: dark fill, yellow ticker; chart caption shows AAPL, price, change and `Since page load`; the line fills in with a dashed `Open` line; the trade ticker field reads AAPL.
2. Click NVDA: chart and trade ticker swap to NVDA; hovering the chart shows `HH:MM:SS` and price. Tab to MSFT and press Enter: MSFT selected with a blue focus ring.
3. Quantity `2` + Buy: cash drops, muted `Filled BUY 2 NVDA @ ...`, an NVDA position row, a heatmap tile and a P&L line with a dot at the right end. Buy `1` JPM and `0.5` AAPL: three tiles; small tiles keep their label inside; hover shows the native tooltip.
4. TSLA, quantity 5, Sell: red inline error `Insufficient shares: selling 5 TSLA, hold 0`.
5. Hover the P&L chart: tooltip shows `Mon D, HH:MM:SS`, `Total value`, a colored `vs start`; dashed `Start $10,000` line visible.
6. Resize to 1280x720: trade bar fits with no horizontal scroll (including the long error), axis labels do not collide or clip, and with five or more positions the positions head stays pinned while rows scroll.

Earlier plan backstops also remain for this pass: chart axis labels and tooltip at the 413px minimum chart width (04-06), and heatmap label clipping in a real browser (04-04).

## Known Stubs

None.

## Threat Flags

None. T-04-19 (loopback-only publish, tmpfs database, no env file, container removed), T-04-20 (specs unchanged) and T-04-SC (lockfile-only `npm ci`) were all mitigated as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 4 is proven end to end in a real browser. Only the human UAT above remains before phase verification; Phase 5 (AI Chat) can be planned.

## Self-Check: PASSED

- FOUND: no `test/tests` changes since `c0701ffe5e`; `finally-p4` removed; Playwright 9 passed; pytest 145 passed.

---
*Phase: 04-trading-portfolio*
*Completed: 2026-10-16*
