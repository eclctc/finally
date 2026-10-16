---
phase: 02-backend-hardening
plan: 03
subsystem: market-data
tags: [price-cache, gbm-simulator, session-open, tdd]

requires:
  - phase: 01-walking-skeleton
    provides: market data package (PriceCache, GBMSimulator, MassiveDataSource) from the completed backend
provides:
  - PriceCache session open that survives remove() for the backend lifetime
  - GBMSimulator that resumes a re-added ticker at its last simulated price
  - Re-add regression tests for the simulator, cache and Massive source
affects: [03-live-watchlist-header, watchlist daily change percent]

actuals:
  tokens: 2600
  tasks: 2
  commits: 3
plan_head_before: 6ba74b25c583d370b65cc4b4ca933612ee254157
plan_head_after: 55b81f4b45f1b0620fbbda183a19d0802eb660cb

tech-stack:
  added: []
  patterns:
    - "Lifetime memory dicts (_session_opens, last_prices) keyed by ticker, never pruned"

key-files:
  created: []
  modified:
    - backend/app/market/cache.py
    - backend/app/market/simulator.py
    - backend/tests/market/test_simulator.py
    - backend/tests/market/test_cache.py
    - backend/tests/market/test_massive_source.py

key-decisions:
  - "Re-added simulator ticker resumes at its last price and keeps the original open (research assumption A5), rather than restarting at the open"
  - "massive_source.py is unchanged: its re-add calls cache.update, which now reuses the remembered open"

patterns-established:
  - "Session open lives in the cache (_session_opens.setdefault), not in the per-tick PriceUpdate chain"

requirements-completed: [HARD-07]

coverage:
  - id: D1
    description: "Removing and re-adding a simulator ticker keeps its first session open and resumes at its last price"
    requirement: HARD-07
    verification:
      - kind: unit
        ref: "backend/tests/market/test_simulator.py#test_readd_keeps_session_open_and_resumes_price"
        status: pass
      - kind: unit
        ref: "backend/tests/market/test_simulator.py#test_remove_and_readd_resumes_at_last_price"
        status: pass
    human_judgment: false
  - id: D2
    description: "The cache keeps the session open across remove and re-add, with and without ticks in between"
    requirement: HARD-07
    verification:
      - kind: unit
        ref: "backend/tests/market/test_cache.py#test_open_survives_remove_and_readd"
        status: pass
      - kind: unit
        ref: "backend/tests/market/test_cache.py#test_readd_with_no_ticks_keeps_open_and_price"
        status: pass
    human_judgment: false
  - id: D3
    description: "A re-added Massive ticker keeps its original session open"
    requirement: HARD-07
    verification:
      - kind: unit
        ref: "backend/tests/market/test_massive_source.py#test_readd_keeps_session_open"
        status: pass
    human_judgment: false

status: complete
duration: 10min
completed: 2026-10-16
---

# Phase 2 Plan 03: Session Open Survives Ticker Re-add Summary

**PriceCache remembers each ticker's first price as its session open past remove(), and GBMSimulator resumes a re-added ticker at its last price, so daily change % no longer resets (HARD-07).**

## Performance

- **Duration:** about 10 min
- **Tasks:** 2 of 2
- **Files modified:** 5 (2 source, 3 test)

## Accomplishments

- `PriceCache._session_opens` holds the first price seen per ticker; `update` uses `_session_opens.setdefault(ticker, price)` for `open_price`. `remove` is untouched, so the open survives it.
- `GBMSimulator.last_prices` stores the popped price on `remove`; `add` starts a newly added ticker at `last_prices.get(ticker, profile.seed_price)`. Without this the old open would have paired with a fresh random seed (the plan reproduced about +381%).
- Tests pin the contract at three levels: simulator end-to-end through `SimulatorDataSource`, the cache boundary (re-add with and without ticks), and the Massive source (no source change needed).

## TDD Gate Compliance

- **RED** (`a94f5b9`): `test_remove_and_readd_resumes_at_last_price` failed with `assert 190.0 == 189.927...` and `test_readd_keeps_session_open_and_resumes_price` failed with `assert 317.84 == 340.88` on `open_price`. Both ran and failed on the planned assertions; no collection or import errors (semantic assessment: valid RED). The checker CLI `gsd_run check tdd-red-evidence` was not run because this plan has `type: execute`, not `type: tdd`.
- **GREEN** (`d55dc13`): both tests and the existing cache tests pass (12 passed).
- **Task 2** (`55b81f4`): the implementation already existed from Task 1, so these are pin tests rather than RED-first. As a check that they are meaningful, I temporarily restored the pre-change `cache.py`: `test_open_survives_remove_and_readd`, `test_readd_keeps_session_open` and the simulator test failed (3 failed). `test_readd_with_no_ticks_keeps_open_and_price` passes on old code by design, since it is a same-price boundary case. The implementation was then restored (verified by a clean 30 passed).
- No REFACTOR commit.

## Task Commits

1. `a94f5b9` test(02-03): add failing tests for session open and price surviving ticker re-add
2. `d55dc13` feat(02-03): keep session open and last price across ticker re-add
3. `55b81f4` test(02-03): pin session open survival across re-add at cache and Massive boundaries

## Deviations from Plan

None - plan executed exactly as written. The tracer feedback gate was satisfied by the Task 1 verify (`tests/market/test_simulator.py tests/market/test_cache.py`, 12 passed) before Task 2 expanded.

## Verification

- `cd backend && uv run pytest -q tests/market/`: 30 passed.
- `cd backend && uv run pytest -q`: 107 passed (baseline 103 plus 4 new tests; the replaced simulator test is net zero).
- Acceptance greps: `_session_opens.setdefault(ticker, price)` count 1, `self.last_prices` count 3, old `test_remove_and_readd_restarts_at_seed` count 0.

## Known Stubs

None.

## Threat Flags

None. T-02-06 (misleading daily change % after re-add) is mitigated as planned; no new network, auth or file surface.

## Notes

- `_session_opens` and `last_prices` grow by one float per ticker ever seen; no pruning, as accepted in the plan.
- A re-added unknown (non-seeded) simulator ticker keeps its price and open but draws a fresh random volatility profile. Price continuity is what HARD-07 requires, so this was left alone.

## Self-Check: PASSED

- backend/app/market/cache.py, backend/app/market/simulator.py: FOUND with the planned changes
- Commits a94f5b9, d55dc13, 55b81f4: FOUND in HEAD history
