---
phase: 06-ship-e2e-gate
plan: 03
subsystem: testing
tags: [ship-gate, playwright, docker, vitest, e2e]
requires: ["06-01", "06-02"]
provides:
  - "Ship gate evidence: frontend 374 tests, INT-01 set 13 files, Playwright 10/10 by docker run and by compose, backend 145"
affects: []
tech-stack:
  added: []
  patterns: ["fresh tmpfs container per full Playwright run"]
key-files:
  created: []
  modified: []
key-decisions:
  - "No app fix was needed; every gate passed on the first run"
requirements-completed: [INT-01, INT-03]
status: complete
commits: 0
plan_head_before: 09d7ab6ae612baa652e30bd270b1d799387b22c2
plan_head_after: 09d7ab6ae612baa652e30bd270b1d799387b22c2
actuals:
  tokens: 0
  tasks: 3
  commits: 0
metrics:
  completed: 2026-10-16
---

# Phase 6 Plan 03: Ship gate Summary

The merged phase passes every automated gate: 374 frontend tests, typecheck, static build, a fresh image with 2/2 then 10/10 Playwright tests on fresh databases, 10/10 through `npm run test:docker`, and 145 backend tests. No source file changed, so there are no task commits; the only commit from this plan is this summary. The start-script browser check (INT-02) is pending for the user.

## Results

Task 1 (tracer):
- `npm --prefix frontend test`: 30 files, 374 tests passed. Typecheck and `next build` (static export) passed (SUITE_OK).
- INT-01 set of 13 named files: `Test Files 13 passed (13)`, `Tests 195 passed (195)` (INT01_AREAS_OK). All ten probe-edge test titles are present (EDGE_TESTS_PRESENT): boundary 49/50 ms and one cent either side of average cost, adjacency equal price, empty portfolio equals cash and null price skipped, ordering of chat actions, precision, idempotent merge, concurrent submits and pending add.
- Image `finally-phase6` built from the unchanged Dockerfile, run as `finally-p6` on `127.0.0.1:8010` with `--tmpfs /app/db` and `-e LLM_MOCK=true` only. `/api/health` ok, served page contains `chat-input` (CONTAINER_OK). Environment holds no OPENROUTER or MASSIVE variable, `LLM_MOCK=true` present, published on 127.0.0.1 only (NO_SECRETS_LOOPBACK).
- Playwright `fresh-start.spec.ts chat.spec.ts`: 2 passed, 0 failed, 0 flaky.

Task 2:
- Container recreated (fresh database, FRESH_DB_OK). Full Playwright suite: 10 passed (fresh-start 1, chat 1, portfolio-charts 1, sse-reconnect 1, trading 4, watchlist 2), 0 failed, 0 flaky.
- Backend `cd backend && uv run pytest -q`: 145 passed, 1 warning.
- `git log 35d295876b..HEAD -- test/tests` and `git status --porcelain -- test/tests` print nothing (SPECS_UNCHANGED).
- `finally-p6` and `finally-phase6` removed (GATE_RESOURCES_REMOVED).

Task 3:
- `npm --prefix test run test:docker`: exit 0, `10 passed (5.2s)`, no failed or flaky count, compose containers and network removed by `down -v`. Docker volume count 1 before and after (COMPOSE_GATE_OK).
- Machine state after the gate: `docker ps -a` lists only `finally-p1` (`Up 10 hours (healthy)`, same as at the start); the only volume is `finally-data` (untouched); no compose container or network, no `finally-p6`/`finally-r6*` container, no `finally-phase6` image. The pre-existing `finally-test-finally:latest` tag was rebuilt in place by compose and left as is. Specs unchanged (second check after the compose run).

## Pending human check (INT-02, for /gsd-verify-work)

Run from the main checkout with your own `.env`. Port 8000 is held by `finally-p1`, so use 8001 and a throwaway volume.

1. `FINALLY_PORT=8001 FINALLY_CONTAINER=finally-ui FINALLY_VOLUME=finally-ui-data ./scripts/start_mac.sh --build`. Expect the build, `FinAlly started.`, `Waiting for FinAlly to be ready...`, `Open http://localhost:8001`, and the browser opening straight onto the terminal with a green connection dot, 10 flashing watchlist rows and $10,000 cash.
2. Same command without `--build`: prints `FinAlly is already running.`, no rebuild, opens the browser again.
3. In that tab buy 1 share from the trade bar (cash drops, position appears) and send `hello` in chat (reply with a key or mock; inline error naming the missing key with neither).
4. `FINALLY_CONTAINER=finally-ui ./scripts/stop_mac.sh` prints `FinAlly stopped.`; `docker volume ls` still lists `finally-ui-data`; a second stop prints `FinAlly is not running.`; then `docker volume rm finally-ui-data`.
5. Optional, Windows only: `scripts\start_windows.ps1 -Build`.

This was not run by the agent: the start script passes the user's `.env`, and it was not run from the main checkout.

## Deviations from Plan

None - plan executed exactly as written. Some compound shell one-liners were split into separate commands because the worktree sandbox refuses git commands inside compound constructs; the checks had identical logic. `.env` was never read, no env file was passed to any container, `finally-p1`, port 8000 and `finally-data` were not touched.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- No created or modified source files by design; `git status` was clean before this summary was written
- Gate resources removed; `finally-p1` unchanged
