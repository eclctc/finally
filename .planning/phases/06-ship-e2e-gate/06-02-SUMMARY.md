---
phase: 06-ship-e2e-gate
plan: 02
subsystem: testing
tags: [docker-compose, playwright, npm, exit-status]
requires: []
provides:
  - "npm run test:docker exits with the Playwright container status after down -v cleanup"
  - "compose test app published on 127.0.0.1:8010 only"
affects: [06-03]
tech-stack:
  added: []
  patterns: ["save $? before cleanup, then exit $s"]
key-files:
  created: []
  modified: [test/package.json, test/docker-compose.test.yml]
key-decisions:
  - "Fix the exit status in the npm script (s=$?; ...; exit $s) rather than changing compose flags"
requirements-completed: [INT-03]
status: complete
commits: 2
plan_head_before: 74136c5a1047d7a536fee16b9276445dacb924bb
plan_head_after: b37fa3a218d9c5a5a585bd2671ed5873ee4b3ef6
actuals:
  tokens: 400
  tasks: 2
  commits: 2
metrics:
  completed: 2026-10-16
---

# Phase 6 Plan 02: Trustworthy E2E command Summary

`npm run test:docker` now returns the Playwright container's exit status after `down -v` cleanup, and the compose test app binds 127.0.0.1:8010 only.

## Tasks

1. **Tracer: exit-status propagation** (`313a4e9`, `test/package.json`). The `test:docker` script now reads `... --exit-code-from playwright; s=$?; docker compose -p finally-test -f docker-compose.test.yml down -v; exit $s`.
   - Stub `docker` that exits 3 on `up`: npm run exited 3 and the stub recorded the `down -v` call (FAILURE_PROPAGATES).
   - Stub that always exits 0: npm run exited 0 (SUCCESS_PASSES).
   - Script-shape check passed; `test` script unchanged; lockfile and `test/tests` untouched (SCRIPT_SHAPE_OK).
2. **Loopback port** (`b37fa3a`, `test/docker-compose.test.yml`). Port mapping changed to `"127.0.0.1:8010:8000"`. Rendered `docker compose config --format json` shows exactly one port (host_ip 127.0.0.1, published 8010, target 8000), `LLM_MOCK` `true`, tmpfs `/app/db`, no env file (LOOPBACK_COMPOSE_OK). `test/tests` has no changes or commits since the planning base (SPECS_UNCHANGED).

## Deviations from Plan

None - plan executed as written. The verification stubs were created in the session scratchpad instead of `mktemp -d` because the worktree sandbox rejected the compound one-liners; the checks were run as separate commands with identical logic. No container, image or volume was created; `.env` was never read.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- `test/package.json` and `test/docker-compose.test.yml` modified and committed
- Commits `313a4e9` and `b37fa3a` are ancestors of HEAD
