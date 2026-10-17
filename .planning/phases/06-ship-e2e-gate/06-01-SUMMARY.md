---
phase: 06-ship-e2e-gate
plan: 01
subsystem: infra
tags: [docker, bash, powershell, start-script, readiness, docs]
requires:
  - phase: 01-walking-skeleton
    provides: Dockerfile that builds the static frontend and backend into one image
provides:
  - start_mac.sh returns and opens the browser only after /api/health answers
  - start_windows.ps1 waits the same way (UNTESTED)
  - accurate README configuration text and agent docs
affects: [06-03 gate run, student launch path]
tech-stack:
  added: []
  patterns: ["in-container python urllib health probe, same one-liner as the Dockerfile HEALTHCHECK"]
key-files:
  created: []
  modified:
    - scripts/start_mac.sh
    - scripts/start_windows.ps1
    - README.md
    - .claude/CLAUDE.md
    - .planning/codebase/STACK.md
key-decisions:
  - "Probe from inside the container with docker exec so it works for any FINALLY_PORT value, including 127.0.0.1:<port>"
  - "Windows uses a host-side Invoke-WebRequest probe because native stderr can become a terminating error under ErrorActionPreference Stop"
status: complete
commits: 3
plan_head_before: 74136c5a1047d7a536fee16b9276445dacb924bb
plan_head_after: 658221e457d34d0133fee32537e97df4705c9f71
actuals:
  tokens: 4000
  tasks: 3
  commits: 3
completed: 2026-10-16
requirements-completed: [INT-02]
---

# Phase 6 Plan 01: Start script readiness wait Summary

**`scripts/start_mac.sh` now waits for the app (30 probes, 1 s apart, in-container `/api/health`) before printing the URL and opening the browser, and exits 1 with a `docker logs` hint if the app never answers; the Windows script mirrors it and the README and agent docs are corrected.**

## Performance

- **Tasks:** 3 of 3
- **Files modified:** 5

## Accomplishments

- `wait_until_ready` and `HEALTH_CHECK` added to `start_mac.sh`; defaults, option parsing, build condition, `.env` handling and open command untouched.
- Proven end to end from a `.env`-less `git worktree` checkout with throwaway names and port `127.0.0.1:8011`.
- `Wait-FinAllyReady` added to `start_windows.ps1`.
- README Configuration sentence, readiness note and `FINALLY_*` override sentence added; stale frontend-is-empty and `docker build` fails claims removed from `.claude/CLAUDE.md` and `.planning/codebase/STACK.md`.

## Task Commits

1. Task 1 (tracer): `716acd8` feat(06-01): start_mac.sh waits for /api/health before opening the browser
2. Task 2: `3beda3b` feat(06-01): start_windows.ps1 waits for /api/health before opening the browser
3. Task 3: `658221e` docs(06-01): correct README configuration and stale frontend claims in agent docs

## Verification Results

| Check | Result |
|---|---|
| SCRIPT_OK (bash -n plus structure greps; run as split commands) | passed |
| READY_ON_RETURN: single `curl -sf` right after `--build --no-open` returned `{"status":"ok",...}`; output contained `Waiting for FinAlly to be ready...`; worktree held no `.env` | passed |
| IDEMPOTENT_OK: re-run printed `FinAlly is already running.`, no `Building image`, exit 0, one container, health ok | passed |
| UNKNOWN_OPTION_OK: `--bogus` exit 1 | passed |
| LOOPBACK_ONLY: `8000/tcp -> 127.0.0.1:8011` only | passed |
| PERSIST_OK: PYPL added, stop removed container, volume kept, restart listed PYPL, second stop printed `FinAlly is not running.` | passed |
| NEVER_READY_FAILS_CLOSED: sleeping image gave exit 1, `FinAlly did not become ready. Check: docker logs finally-r6dead`, no `Open` line | passed |
| WINDOWS_STATIC_OK: function, `Invoke-WebRequest -UseBasicParsing -TimeoutSec 2`, message, call before the `Open` line, `.env` handling intact | passed (static) |
| CLEAN: no `finally-r6*` container, volume, image or worktree left | passed |
| DOCS_FACTS_OK / README_OK | passed |
| `finally-p1` | `Up 10 hours (healthy)` before and after |

## UNTESTED

- `scripts/start_windows.ps1` readiness wait: no PowerShell on this Mac, checked statically only.
- Unverified existing risk A1 (RESEARCH): `docker image inspect $Image *> $null` (line 16) and `docker rm -f $Container *> $null` (line 27 originally) run native commands under `$ErrorActionPreference = "Stop"`; in Windows PowerShell 5.1 native stderr can become a terminating error. Recorded, not fixed (INT-02 names only `start_mac.sh`).
- The real `open` call and a real browser landing on the app: only the user can run the script from the main checkout (it passes their `.env`, port 8000 is held by `finally-p1`). This is the Plan 06-03 human check.

## Deviations from Plan

None in scope. Execution notes:

- The harness refused compound shell commands (`&&` chains with `git` and `bash`), so each plan `<automated>` chain was run as separate plain commands with the same assertions. The worktree was created at `${TMPDIR}/finally-r6-wt` with the plan's own `git worktree add --detach`, and the uncommitted script was copied over it as the plan specifies.
- Probe containers ran without `.env`, so they carried no API key and no `LLM_MOCK`; `/api/chat` was never called (documented deviation, T-06-15).
- The printed URL under the override is `http://localhost:127.0.0.1:8011`; cosmetic and expected.
- The Windows not-ready message uses `Write-Host` (stdout) as the plan specifies; the bash one goes to stderr.

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths or trust-boundary changes; the readiness probe is a fixed one-liner with no user input.

## Next Phase Readiness

Plan 06-03 can rely on the start script returning only once the app answers. The human check of the real browser launch from the main checkout remains for 06-03.

## Self-Check: PASSED

- scripts/start_mac.sh, scripts/start_windows.ps1, README.md, .claude/CLAUDE.md, .planning/codebase/STACK.md modified and committed.
- Commits 716acd8, 3beda3b, 658221e are ancestors of HEAD.
