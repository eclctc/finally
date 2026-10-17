---
phase: 06-ship-e2e-gate
reviewed: 2026-10-16T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - .claude/CLAUDE.md
  - README.md
  - scripts/start_mac.sh
  - scripts/start_windows.ps1
  - test/docker-compose.test.yml
  - test/package.json
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-16
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the diff `ae0eb645..HEAD` for the six files. I found no bugs or security problems in the changes.

- **`start_mac.sh` readiness wait:** correct. The probe runs inside the container, so the hardcoded `localhost:8000` is the container-internal port and is right even when `FINALLY_PORT` is overridden. The `cmd && return 0` inside the loop is safe under `set -e`. The wait also runs on the "already running" path.
- **`start_windows.ps1` readiness wait:** correct. A failed `Invoke-WebRequest` is caught and retried, and `exit 1` inside the function exits the script.
- **`test/docker-compose.test.yml`:** binding 8010 to `127.0.0.1` is a sound tightening. In-network Playwright traffic goes to `finally:8000` and is unaffected.
- **`test/package.json`:** `s=$?; ...down -v; exit $s` correctly preserves the Playwright exit code under POSIX `sh`, which is what npm uses on macOS and Linux.
- **README and CLAUDE.md edits:** accurate against the repo. Checked: `FINALLY_PORT`, `FINALLY_CONTAINER`, `FINALLY_IMAGE` and `FINALLY_VOLUME` are honored by both start scripts, and `FINALLY_CONTAINER` is honored by both stop scripts. The `.env.example` file exists. The `frontend/package.json` versions match the stack line (next 16.4.2, react 19.3.1, typescript 7.0.2, tailwind 4.3.3, recharts 3.10.1, vitest 5.0.5).

Only minor items remain.

## Info

### IN-01: CLAUDE.md platform requirement still says Node is for E2E only

**File:** `.claude/CLAUDE.md:101`
**Issue:** `- Node.js and npm for E2E tests in test/` contradicts the updated line 40 and the next bullet. Node and npm are also needed to build and test `frontend/`. The edit fixed the neighbouring lines but missed this one.
**Fix:** `- Node.js and npm for `frontend/` (build, Vitest) and the E2E tests in `test/``

### IN-02: Empty "## Frontend" placeholder section left in CLAUDE.md

**File:** `.claude/CLAUDE.md:196`
**Issue:** The `## Frontend` heading has no body. Frontend conventions are now relevant because `frontend/` exists, but the section is still blank. Line 246 (`Frontend (spec: Next.js static export) is served ...`) also still reads as if the frontend were hypothetical. Neither line is in the diff, so these are leftovers from the refresh.
**Fix:** Either fill the section with the actual frontend conventions (priceStore, `testIds.ts`, Vitest and RTL) or remove the heading. Drop the "spec:" qualifier on line 246.

### IN-03: `test:docker` script is POSIX-shell only, but the README presents Windows as supported

**File:** `test/package.json:8`
**Issue:** `s=$?` and `exit $s` are not valid under `cmd.exe`, which npm uses on Windows. The previous `;` chaining was equally invalid there, so this is not a regression. The README lists `npm run test:docker` without a platform caveat while advertising Windows start scripts.
**Fix:** No code change is needed. Optionally note in `test/README.md` that `test:docker` needs a POSIX shell (WSL or Git Bash), or run the two documented `docker compose` commands directly.

### IN-04: Readiness wait does not fail fast when the container has already exited

**File:** `scripts/start_mac.sh:14-21`, `scripts/start_windows.ps1:16-27`
**Issue:** If the container crashes at startup (for example a bad `.env`), the loop polls for the full 30 seconds before printing the "Check: docker logs" hint. This is correct but slow to report. The Windows script also writes the failure message to stdout via `Write-Host`, while the Bash script writes to stderr.
**Fix:** Optional. In the Bash loop, break early with `[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" = true ] || break`. Use `[Console]::Error.WriteLine` or `Write-Error` on Windows if stderr parity matters.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
