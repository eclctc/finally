---
phase: 04-trading-portfolio
plan: 01
subsystem: ui
tags: [react, nextjs, trading, portfolio, vitest]
status: complete
requires:
  - phase: 03-live-watchlist-header
    provides: priceStore live prices, Header figures, request() wrapper
provides:
  - Dashboard-owned single usePortfolio() source (portfolio, failed, refresh, setPortfolio)
  - TradeBar component posting market orders and reporting fills via onFilled
  - Props-driven Header
  - Shared errorMessage and NETWORK_ERROR in api.ts
  - makePosition, makePortfolio, makeTradeResponse test fixtures
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 05-ai-chat]
tech-stack:
  added: []
  patterns:
    - "Generation counter guard: setPortfolio and each refresh bump a ref; an older GET never overwrites newer state"
    - "Trade result applied from the POST response (setPortfolio), no follow-up GET"
key-files:
  created:
    - frontend/src/components/TradeBar.tsx
    - frontend/src/components/TradeBar.test.tsx
    - frontend/src/lib/usePortfolio.test.tsx
  modified:
    - frontend/src/lib/usePortfolio.ts
    - frontend/src/lib/api.ts
    - frontend/src/lib/useWatchlist.ts
    - frontend/src/components/Dashboard.tsx
    - frontend/src/components/Dashboard.test.tsx
    - frontend/src/components/Header.tsx
    - frontend/src/components/Header.test.tsx
    - frontend/src/test/fixtures.ts
key-decisions:
  - "refresh() returns Promise<boolean> (never rejects) so Phase 5 can skip row highlights after a failed refresh"
  - "failed is derived as failedLoad && portfolio === null: background poll failures never blank valid numbers (D-07)"
  - "The single message slot is cleared on edit of either input, including the success line"
requirements-completed: [TRADE-03, TRADE-04, TRADE-05, PORT-04]
metrics:
  duration: ~25 min
  completed: 2026-10-16
commits: 3
plan_head_before: 85bb11844b84a59622827ed1129fbe9fe4af1d09
plan_head_after: c33458adcb7dada5f9ad963da7bb8fe2f21cab7a
actuals:
  tokens: 7500
  tasks: 3
  commits: 3
---

# Phase 4 Plan 01: Trade bar and shared portfolio source Summary

**Trade bar posts market orders and applies the response portfolio to the header in the same render, via one Dashboard-owned `usePortfolio()` with a 30 s poll and a generation guard against stale GETs.**

## Accomplishments

- Task 1 (tracer): `Dashboard` calls `usePortfolio()` once and passes `portfolio`/`failed` to a props-driven `Header`; `TradeBar` posts `/api/portfolio/trade` and `handleFilled` -> `setPortfolio`. A Dashboard test drives the real modules: cash goes `$10,000.00` -> `$9,175.40`, body is `{ticker:"MSFT",side:"buy",quantity:2}`, and `GET /api/portfolio` is called once. `errorMessage`/`NETWORK_ERROR` moved from `useWatchlist.ts` to `api.ts`.
- Task 2: trade bar contract: enabled rule (`Number.isFinite && > 0`, trimmed ticker), `aria-busy` group, disabled in-flight buttons (one POST for two clicks), `Est. value` row from the live price, error/fill message slot cleared on edit, focus to quantity, no form element and no key handlers. 23 component tests.
- Task 3: `usePortfolio` polls every `POLL_MS = 30_000`; `setPortfolio` and each `refresh` bump a generation ref so only the latest-started response applies; `failed` only while nothing has loaded. 7 hook tests including 29,999/30,000 ms and unmount.

## Verification

- `npm --prefix frontend test`: 15 files, 169 tests pass (was 138 before the plan)
- `npm --prefix frontend run typecheck` and `run build` exit 0; `frontend/out/index.html` contains `data-testid="trade-buy"` (TRACER_OK)
- Gates: `TRADEBAR_GATES_OK` (no `<form`, `aria-busy`, `inputMode="decimal"` present)
- Tracer feedback gate: automated `<verify>` re-run end-to-end after Task 1 and passed, then expanded.

## Deviations from Plan

None - plan executed exactly as written, with two minor environment notes:
- `npm --prefix frontend ci` was run once (fresh worktree, no new packages).
- The per-plan commit ledger file lives in the shared `.git/worktrees/...` dir, which the worktree sandbox refused to write; the base hash (`85bb118`, verified at start) was used directly for the `commits:` measurement.

## Known Stubs

None.

## Threat Flags

None. T-04-01..04 mitigations are implemented and tested (text-only rendering with `<img onerror>` test, in-flight lock, `type="button"` and no form, generation guard).

## Self-Check: PASSED

- FOUND: frontend/src/components/TradeBar.tsx, TradeBar.test.tsx, frontend/src/lib/usePortfolio.test.tsx
- FOUND commits: 4659fac, 1efd54a, c33458a
