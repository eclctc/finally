---
phase: 06-ship-e2e-gate
verified: 2026-10-16T21:45:00Z
status: human_needed
score: 8/9 must-haves verified
covered_files:
  - ".planning/phases/06-ship-e2e-gate/06-01-PLAN.md"
  - ".planning/phases/06-ship-e2e-gate/06-01-SUMMARY.md"
  - ".planning/phases/06-ship-e2e-gate/06-02-PLAN.md"
  - ".planning/phases/06-ship-e2e-gate/06-02-SUMMARY.md"
  - ".planning/phases/06-ship-e2e-gate/06-03-PLAN.md"
  - ".planning/phases/06-ship-e2e-gate/06-03-SUMMARY.md"
  - "README.md"
  - "scripts/start_mac.sh"
  - "scripts/start_windows.ps1"
  - "test/docker-compose.test.yml"
  - "test/package.json"
covered_digest: "v3:sha256:976149b219c5cd4f65103672a4da9e10e6d5044d9be99253eefd588a37337ddf"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Running scripts/start_mac.sh opens the browser onto a working FinAlly page (ROADMAP SC1, browser-open half; must_have verification: backstop)"
    test: "From the main checkout run FINALLY_PORT=8001 FINALLY_CONTAINER=finally-ui FINALLY_VOLUME=finally-ui-data ./scripts/start_mac.sh --build"
    expected: "Build output, 'FinAlly started.', 'Waiting for FinAlly to be ready...', 'Open http://localhost:8001', and the browser lands on the terminal with a green connection dot, 10 flashing watchlist rows and $10,000 cash"
    why_human: "The open call and a real browser landing cannot be exercised by the agent: the script passes the user's .env from the main checkout and port 8000 is held by finally-p1. Presence of the 'open \"$URL\" || xdg-open' line proves nothing about the browser."
human_verification:
  - test: "Browser launch of the start script (INT-02), steps 1-4 of the 06-03 human-check"
    expected: "Step 1 as above; step 2 re-run without --build prints 'FinAlly is already running.', does not rebuild, opens the browser again; step 3 buy 1 share (cash drops, position row appears) and send 'hello' in chat (reply, mock reply, or inline missing-key error); step 4 stop_mac.sh prints 'FinAlly stopped.', volume finally-ui-data remains, second stop prints 'FinAlly is not running.', then docker volume rm finally-ui-data"
    why_human: "Browser open and the visual landing page; runs against the user's own .env"
  - test: "Optional, Windows machine only: scripts\\start_windows.ps1 -Build"
    expected: "Waits for the app (Wait-FinAllyReady) and then opens the browser; not-ready path prints the docker logs hint and exits 1"
    why_human: "No PowerShell on this Mac; the readiness wait is UNTESTED (static check only). Existing RESEARCH A1 risk (native stderr under ErrorActionPreference Stop in PS 5.1 on lines 'docker image inspect $Image *> $null' and 'docker rm -f $Container *> $null') is unverified and unfixed. INT-02 names only start_mac.sh, so this does not block."
---

# Phase 6: Ship & E2E Gate Verification Report

**Phase Goal:** As a student, I want to launch FinAlly with one script and see every E2E test pass, so that I know it all works.
**Verified:** 2026-10-16T21:45:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1 (build, launch half): `scripts/start_mac.sh` builds the image, launches the container and returns only once the app answers `/api/health` | VERIFIED | Read `scripts/start_mac.sh`: `HEALTH_CHECK` (python urllib, timeout 2), `wait_until_ready` loops 30 x `docker exec "$CONTAINER" python -c "$HEALTH_CHECK"` with `sleep 1`, then prints the `docker logs` hint to stderr and `exit 1`. The bare `wait_until_ready` call sits after the build/start/already-running branch and before `echo "Open $URL"` and the `open` line. `bash -n` passes. Defaults (`finally`, `finally`, `8000`, `finally-data`), option parsing (`*) ... exit 1`), build condition and conditional `--env-file` are unchanged in the diff (13 added lines only). Runtime proof (READY_ON_RETURN, IDEMPOTENT_OK, NEVER_READY_FAILS_CLOSED, PERSIST_OK, UNKNOWN_OPTION_OK, LOOPBACK_ONLY, CLEAN) comes from the 06-01 SUMMARY; corroborated by the orchestrator's docker events (a `finally-r6dead` probe container was created and destroyed) and by `docker ps -a`/`docker volume ls` now showing only `finally-p1` and `finally-data`. I did not re-run the container checks (forbidden by the constraints). |
| 2 | SC1 (browser half): the script opens the browser onto a working app at http://localhost:8000 | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `open "$URL" 2>/dev/null \|\| xdg-open ... \|\| true` is present, gated by `$OPEN`, after the readiness wait. No automated test can exercise a real browser landing. Planned human check, must_have `verification: backstop`. See Human Verification. |
| 3 | SC2 / INT-03: the full Playwright suite passes against the container with `LLM_MOCK=true` (fresh start, watchlist, trading, portfolio charts, chat, SSE reconnect); no spec weakened | VERIFIED | `npx playwright test --list` shows 10 tests in 6 files (fresh-start 1, chat 1, portfolio-charts 1, sse-reconnect 1, trading 4, watchlist 2), no `skip`/`fixme`/`.only` in `test/tests`. `git log 35d295876b..HEAD -- test/tests` is empty, `git status --porcelain -- test/tests` is empty, `git diff 74136c5..HEAD -- Dockerfile test/package-lock.json test/tests` is empty. 10 passed by `docker run` and by `npm run test:docker` is claimed in the 06-03 SUMMARY; orchestrator docker events show the `finally-p6` containers (tracer, then a fresh-DB full run) and the compose pair `finally-test-finally-1` + `finally-test-playwright-1` created and destroyed in sequence. Not independently re-run (no containers allowed). |
| 4 | SC3 / INT-01: `npm test` passes with Vitest + RTL coverage of the price store and merge, flash triggering, watchlist add/remove, portfolio revaluation and chat rendering/loading | VERIFIED | Re-ran `npm --prefix frontend test`: 30 files, 374 tests passed. `npm --prefix frontend run typecheck` exit 0. All 10 named INT-01 edge test titles are present (49/50 ms flash boundary, one cent either side of average cost, equal price adjacency, empty equals cash, null price skipped, action ordering, precision, idempotent merge, synchronous double submit, pending Add). |
| 5 | The documented E2E command `npm --prefix test run test:docker` exits with the Playwright status and still tears down | VERIFIED | `test/package.json` reads `... --exit-code-from playwright; s=$?; ... down -v; exit $s`. Re-ran with a stub `docker` (no containers): stub failing on `up` gives npm exit 3 and the `down -v` call is recorded; an always-0 stub gives exit 0. `test` script is still `playwright test`; lockfile unchanged. |
| 6 | The compose test app is published on 127.0.0.1:8010 only, with LLM_MOCK=true, tmpfs db and no env file | VERIFIED | `docker compose config --format json` (starts nothing): ports `[{host_ip:"127.0.0.1", target:8000, published:"8010"}]`, environment `{"LLM_MOCK":"true"}`, tmpfs `["/app/db"]`, `env_file` undefined. |
| 7 | Backend suite passes | VERIFIED | Re-ran `cd backend && uv run pytest -q`: 145 passed, 1 warning. |
| 8 | README and agent docs state the facts (where config goes, `FINALLY_*` overrides, frontend exists, `docker build` succeeds) | VERIFIED | README Configuration reads "Set these in `.env` (copy `.env.example`)" and the Windows line names all four `FINALLY_*` overrides with an example; `.env.example` exists. `/usr/bin/grep` finds none of "Known Build Blockers", "Next.js project was deleted", "is restored", "currently cannot run" in `.claude/CLAUDE.md` or `.planning/codebase/STACK.md`; CLAUDE.md line 40 and line 102 carry the corrected text. Residual stale lines are info only (see Anti-Patterns). |
| 9 | Gate left no resources behind and did not disturb the user's Docker state | VERIFIED | `docker ps -a` lists only `finally-p1` (Up 10 hours, healthy); `docker volume ls` lists only `finally-data`. No `finally-p6`, `finally-r6*` or compose containers. |

**Score:** 8/9 truths verified (1 present, behavior-unverified: the real browser launch)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `scripts/start_mac.sh` | `HEALTH_CHECK`, `wait_until_ready` before URL/open | VERIFIED | Present, substantive, wired (called once, before `echo "Open $URL"`) |
| `scripts/start_windows.ps1` | `Wait-FinAllyReady` before `Start-Process` | VERIFIED (static, UNTESTED at runtime) | Function polls `Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "$Url/api/health"` 30 times; call precedes `Write-Host "Open $Url"` |
| `README.md` | `FINALLY_PORT` etc. overrides, accurate Configuration sentence | VERIFIED | See truth 8 |
| `test/package.json` | `exit $s` | VERIFIED | See truth 5 |
| `test/docker-compose.test.yml` | `127.0.0.1:8010:8000` | VERIFIED | See truth 6 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `start_mac.sh` | `/api/health` in container | `docker exec ... python -c "$HEALTH_CHECK"` | WIRED | Same probe shape as the Dockerfile HEALTHCHECK; runs on both the fresh-start and already-running paths |
| `start_windows.ps1` | `$Url/api/health` | `Invoke-WebRequest` in try/catch | WIRED (static) | Not executed |
| `test:docker` | compose `playwright` service exit code | `--exit-code-from playwright`, `s=$?`, `exit $s` | WIRED | Stub-proven both directions |
| `test/tests/*.spec.ts` | the served static export + API | Playwright BASE_URL | WIRED (claimed) | 10 tests listed; run results per SUMMARY and docker events |

### Data-Flow Trace (Level 4)

Not applicable: this phase changes scripts, test harness and docs, and renders no dynamic data.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Script syntax | `bash -n scripts/start_mac.sh scripts/stop_mac.sh` | OK | PASS |
| Exit-code propagation (fail) | stub `docker` exiting 3 on `up`; `npm --prefix test run test:docker` | exit 3, `down -v` recorded | PASS |
| Exit-code propagation (ok) | stub `docker` always 0 | exit 0 | PASS |
| Compose port binding | `docker compose config --format json` | 127.0.0.1:8010 only | PASS |
| Frontend suite | `npm --prefix frontend test` | 30 files, 374 passed | PASS |
| Typecheck | `npm --prefix frontend run typecheck` | exit 0 | PASS |
| Backend suite | `cd backend && uv run pytest -q` | 145 passed | PASS |
| Playwright inventory | `npx playwright test --list` | 10 tests / 6 files | PASS |
| Container, Playwright, start-script runtime checks | not run (constraint: no containers, ports, scripts, or Playwright) | relied on SUMMARY + orchestrator docker events | SKIP |

### Probe Execution

No `probe-*.sh` scripts declared or present for this phase. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| INT-01 | 06-03 | Vitest + RTL tests for price store/merge, flash, watchlist add/remove, portfolio revaluation, chat rendering/loading | SATISFIED | Truth 4; 374 tests re-run, edge titles present |
| INT-02 | 06-01, 06-03 | `scripts/start_mac.sh` builds and launches a working app at localhost:8000 and opens the browser | NEEDS HUMAN | Build/launch/wait verified (truth 1); browser open is the backstop human check (truth 2) |
| INT-03 | 06-02, 06-03 | Full Playwright suite passes against the container with `LLM_MOCK=true` | SATISFIED | Truths 3, 5, 6; run results from SUMMARY, corroborated by docker events, not re-run by me |

All three IDs declared in PLAN frontmatter (INT-02 in 06-01; INT-03 in 06-02; INT-01/02/03 in 06-03) match REQUIREMENTS.md and ROADMAP Phase 6. No orphaned requirements (REQUIREMENTS.md maps only INT-01..INT-03 to Phase 6; INT-04 belongs to Phase 2). Note: REQUIREMENTS.md still shows INT-01..03 as `[ ]`/`Pending`; the orchestrator should tick INT-01 and INT-03 and tick INT-02 only after the human check.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (modified files) | - | TBD/FIXME/XXX/TODO/HACK scan | none | No debt markers in scripts, test harness files or README |
| `.claude/CLAUDE.md` | ~101 | "Node.js and npm for E2E tests in test/" is stale (review IN-01) | Info | Docs only |
| `.claude/CLAUDE.md` | ~196, ~246 | Empty `## Frontend` heading; "spec:" qualifier (review IN-02) | Info | Docs only |
| `test/package.json` | 8 | `test:docker` is POSIX-shell only (review IN-03) | Info | Not a regression; npm on Windows would need WSL/Git Bash |
| `scripts/start_mac.sh` | 14-21 | Wait does not fail fast if the container already exited (review IN-04) | Info | Slow (30 s) but correct failure |

All four are open info items in `06-REVIEW-DISPOSITION.md`; none blocks the goal.

### Human Verification Required

#### 1. Browser launch of the start script (INT-02)

**Test:** From the main checkout run `FINALLY_PORT=8001 FINALLY_CONTAINER=finally-ui FINALLY_VOLUME=finally-ui-data ./scripts/start_mac.sh --build`, then re-run without `--build`, buy 1 share and send `hello` in chat, then `FINALLY_CONTAINER=finally-ui ./scripts/stop_mac.sh` twice and `docker volume rm finally-ui-data`.
**Expected:** Build, `FinAlly started.`, `Waiting for FinAlly to be ready...`, `Open http://localhost:8001`, and the browser opens straight onto the terminal (green dot, 10 flashing rows, $10,000 cash). Re-run prints `FinAlly is already running.`, no rebuild, opens again. Stop prints `FinAlly stopped.`, volume persists; second stop prints `FinAlly is not running.`
**Why human:** Real browser open and visual landing; runs with the user's own `.env`; port 8000 is held by `finally-p1`.

#### 2. Windows start script (optional)

**Test:** On Windows, `scripts\start_windows.ps1 -Build`.
**Expected:** Waits for the app, then opens the browser.
**Why human:** No PowerShell available; UNTESTED, plus unverified A1 stderr risk. Not required by INT-02.

### Gaps Summary

No gaps. Every automated must-have holds: the start script's readiness wait is present, ordered before the browser open, and fails closed; `test:docker` now propagates the Playwright exit status (re-proved with stubs); the compose app is loopback-only; no spec, Dockerfile or lockfile changed; frontend (374) and backend (145) suites pass on re-run; the machine holds only `finally-p1` and `finally-data`. Limits of this verification: the 10/10 Playwright results (docker run and compose) and the start-script runtime checks rest on the 06-03 and 06-01 SUMMARY outputs, corroborated by the orchestrator's docker event log, because the constraints forbade starting containers or Playwright. The remaining open item is the planned human check that the script actually opens a browser onto a working app, so the phase status is `human_needed`, not `passed`.

---

_Verified: 2026-10-16T21:45:00Z_
_Verifier: Claude (gsd-verifier)_
