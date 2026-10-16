---
phase: 01-walking-skeleton
plan: 04
subsystem: frontend
tags: [nextjs, dev-proxy, sse, readme]

requires:
  - phase: 01-walking-skeleton
    provides: "Plan 01 next.config.ts with dev-only /api rewrite and compress: false"
provides:
  - "Live proof that next dev proxies /api/* and a 40 s SSE stream to the backend on :8000 without buffering or cutting"
  - "README Development section lines for npm run dev and npm run build"
affects: [01-03, frontend phases]

actuals:
  tokens: 1500
  tasks: 1
  commits: 1
plan_head_before: 4d7cc444ecdbe662c2c8fb1fad3a3bec9e7146fe
plan_head_after: e64b0d16d9a6dcf1b39456508cf09176307357a5

tech-stack:
  added: []
  patterns: ["Dev proxy verified live with a port-scoped start/stop script and temp-dir SQLite so the repo stays clean"]

key-files:
  created: []
  modified:
    - README.md

key-decisions:
  - "next.config.ts left unchanged: the check passed first time with compress: false, so no experimental.proxyTimeout was added"

requirements-completed: [FND-06]

coverage:
  - id: D1
    description: "next dev on :3100 proxies /api/health and holds /api/stream/prices open for 40 s unbuffered (curl exit 28, 80 data frames, health 200 mid-stream)"
    requirement: "FND-06"
    verification:
      - kind: other
        ref: "plan 01-04 Task 1 first automated command: health_mid=0 sse_exit=28 frames=80 dev_rc=0"
        status: pass
    human_judgment: false
  - id: D2
    description: "README Development section documents cd frontend && npm run dev (proxy to :8000, -p 3100 when 3000 busy) and npm run build"
    requirement: "FND-06"
    verification:
      - kind: other
        ref: "grep 'npm run dev' README.md && grep 'npm run build' README.md"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-16
status: complete
---

# Phase 1 Plan 04: Dev Loop Proxy Proof Summary

**`next dev` on :3100 proxies `/api/*` including a 40 s unbuffered SSE stream to the FastAPI backend on :8000 (80 frames, curl ended by its own timeout), documented in two README lines.**

## Performance

- **Duration:** about 6 min
- **Tasks:** 1 of 1
- **Files modified:** 1 (README.md)

## Accomplishments

- Ran `npm --prefix frontend ci` (lockfile only, no package changes), then ran the plan's dev-loop check against live processes. Backend used a temp-dir `FINALLY_DB_PATH` and `LLM_MOCK=true`.
- Result: `health_mid=0 sse_exit=28 frames=80 dev_rc=0`. The stream survived past the reported ~30 s dev-proxy timeout, and `/api/health` returned 200 through the proxy while the stream was open.
- `frontend/next.config.ts` needed no change; `compress: false` is present and `proxyTimeout` is not needed.
- `README.md` Development section now lists `cd frontend && npm run build` next to `npm test` and a line for `cd frontend && npm run dev` with the proxy note and the `-p 3100` fallback.
- Both servers were stopped by port-scoped kill; ports 8000 and 3100 are free, `db/` does not exist and `frontend/AGENTS.md` does not exist. `frontend/tsconfig.json`, `package.json` and the lockfile are unchanged.

## Task Commits

1. **Task 1: Dev loop proxy proof and README** - `e64b0d1` (docs)

## Deviations from Plan

None - plan executed exactly as written. The plan's one-line `<automated>` command was run as an equivalent script file (scratchpad) because the sandbox refused the compound one-liner; commands, ports, timeouts and assertions are identical.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None.

## Next Phase Readiness

Plan 03 (wave 3) can start its container on :8000; nothing from this plan is listening.

## Self-Check: PASSED

- README.md contains `npm run dev` and `npm run build`
- Commit e64b0d1 is an ancestor of HEAD
- No listeners on :3100 or :8000; package.json and lockfile unchanged
