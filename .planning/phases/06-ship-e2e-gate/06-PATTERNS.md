# Phase 6: Ship & E2E Gate - Pattern Map

**Mapped:** 2026-10-16
**Files analyzed:** 8 (6 edits, 1 optional edit, 1 gate procedure)
**Analogs found:** 8 / 8 (all tracked in git; verified with `git ls-files`)

No new source files are created. Every change is a small edit to an existing tracked file, so most "analogs" are the file itself plus a sibling pattern to copy.

## File Classification

| File | Role | Data Flow | Closest Analog | Match |
|------|------|-----------|----------------|-------|
| `scripts/start_mac.sh` (add readiness wait) | config/script | request-response (poll) | `Dockerfile` HEALTHCHECK line 29 + `test/docker-compose.test.yml` healthcheck line 18 | exact (probe) |
| `scripts/start_windows.ps1` (mirror wait) | config/script | request-response (poll) | `scripts/start_mac.sh` structure; own `$LASTEXITCODE` style | role-match |
| `test/package.json` (`test:docker` exit code) | config | batch | same script string; POSIX `a; s=$?; b; exit $s` | exact |
| `test/docker-compose.test.yml` (optional `127.0.0.1:8010:8000`) | config | request-response | root `docker-compose.yml` ports style / the Phase 5 `docker run -p 127.0.0.1:8010:8000` | role-match |
| `.claude/CLAUDE.md` (stale blockers, lines 32, 39, 107-110) | doc | n/a | surrounding sections | exact |
| `README.md` (line 42 sentence, optional `FINALLY_*` and `LLM_MOCK` note) | doc | n/a | table at lines 44-48 | exact |
| Gate procedure (docker build/run, playwright, pytest, SPECS_UNCHANGED) | gate | batch | `.planning/phases/05-ai-chat/05-06-PLAN.md` Tasks 1-2 | exact |
| `test/tests/*.spec.ts` | test | n/a | MUST NOT be edited | n/a |

## Pattern Assignments

### `scripts/start_mac.sh` (script, poll health)

**Analog for probe:** `Dockerfile` line 28-29 and `test/docker-compose.test.yml` line 18:
```
CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"
```
**Existing style to preserve** (`scripts/start_mac.sh` lines 4-11, 41-47): `set -euo pipefail`, `FINALLY_*` env overrides with `${VAR:-default}`, `echo` progress lines, errors to `>&2` then `exit 1`:
```bash
set -euo pipefail
CONTAINER="${FINALLY_CONTAINER:-finally}"
...
*) echo "Unknown option: $arg" >&2; exit 1 ;;
...
echo "FinAlly started."
fi

echo "Open $URL"
if $OPEN; then
  open "$URL" 2>/dev/null || xdg-open "$URL" >/dev/null 2>&1 || true
fi
```
**Insert point:** after line 42 (`fi` closing the if/else), before `echo "Open $URL"`. Use the loop from RESEARCH "Readiness wait" (docker exec python probe, 30 x 1 s, fail with `docker logs` hint to stderr, `exit 1`). The in-container probe is deliberate: it works for any `FINALLY_PORT`, including `127.0.0.1:8011` used by the gate. Bash 3.2 compatible (`seq`, `for _`). Under `set -e` the final `|| { ...; exit 1; }` form is required so the failing `docker exec` does not abort silently.

### `scripts/start_windows.ps1` (script, poll health)

**Style to copy** (lines 7, 16-21, 23-35): `$ErrorActionPreference = "Stop"`, `$LASTEXITCODE` checks, `Write-Host`, `docker ... *> $null`:
```powershell
docker build -t $Image $RootDir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
...
Write-Host "FinAlly started."
}

Write-Host "Open $Url"
if (-not $NoOpen) { Start-Process $Url }
```
**Insert point:** after line 35, before `Write-Host "Open $Url"`. Loop with the same in-container probe: `docker exec $Container python -c $HealthCheck *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep -Seconds 1`, then on failure `Write-Error` and `exit 1`. Cannot be run on macOS: mark UNTESTED in the summary (RESEARCH A1: `*> $null` stderr under Stop may throw on PS 5.1; do not block on it).

### `scripts/stop_mac.sh` / `stop_windows.ps1`
No change. Reference only for idempotent messages ("FinAlly stopped." / "FinAlly is not running.") that the gate asserts.

### `test/package.json` (`test:docker`)

**Current** (line 8):
```
"test:docker": "docker compose -p finally-test -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from playwright; docker compose -p finally-test -f docker-compose.test.yml down -v"
```
**Target** (RESEARCH): replace the `;` between the two commands with `; s=$?; ` before `down -v` and append `; exit $s`:
```
"... --exit-code-from playwright; s=$?; docker compose -p finally-test -f docker-compose.test.yml down -v; exit $s"
```
Verify failure propagation without a real run by the shell semantics check (`sh -c 'false; s=$?; true; exit $s'` returns 1).

### `test/docker-compose.test.yml` (optional)
Only line 14: `- "8010:8000"` to `- "127.0.0.1:8010:8000"`. Keep the "Not named app" comment, `tmpfs: /app/db`, `LLM_MOCK: "true"`, and no `env_file`. Playwright reaches `finally:8000` over the compose network, so nothing else changes.

### `.claude/CLAUDE.md` (doc edits)
- Line 32: replace "Not present. The `frontend/` directory exists but is empty ..." with a statement that `frontend/` is a Next.js 16 static-export project (Vitest + RTL, built by the Dockerfile).
- Line 39: drop "which currently cannot run because `frontend/` is empty".
- Lines 107-110: delete the "Known Build Blockers" section (or replace with "None; `docker build` succeeds from a clean checkout").

### `README.md` (doc edits)
- Line 42 `Copy \`.env\` values as needed:` becomes "Set these variables in `.env` (copy from `.env.example`):". Keep the table at lines 44-48 unchanged; optionally one line listing `FINALLY_IMAGE|CONTAINER|PORT|VOLUME` overrides. Keep it concise.

### Gate procedure (commands to copy verbatim, rename p5/phase5 to p6/phase6)

**Source:** `.planning/phases/05-ai-chat/05-06-PLAN.md` Tasks 1-2 and `05-06-SUMMARY.md` (10/10). Full commands are in `06-RESEARCH.md` Pattern 1 (lines 102-108). Key shape:
```bash
docker build -t finally-phase6 . && docker run -d --name finally-p6 -p 127.0.0.1:8010:8000 --tmpfs /app/db -e LLM_MOCK=true finally-phase6
curl -sf --retry 30 --retry-all-errors --retry-delay 1 http://127.0.0.1:8010/api/health | /usr/bin/grep -q '"status":"ok"'
cd test && BASE_URL=http://127.0.0.1:8010 npx playwright test fresh-start.spec.ts chat.spec.ts --reporter=list   # tracer
docker rm -f finally-p6; docker run ... (recreate, fresh DB)
cd test && BASE_URL=http://127.0.0.1:8010 npx playwright test --reporter=list   # 10 passed
cd backend && uv run pytest -q                                                    # 145 passed
test -z "$(git log --format=%h 5681c3a..HEAD -- test/tests)" && test -z "$(git status --porcelain -- test/tests)" && echo SPECS_UNCHANGED
```
Rules: never `--env-file`, never port 8000, bind 127.0.0.1, only `-e LLM_MOCK=true`, recreate the container before every full run (fresh-start asserts 10000 and 10 rows), Bash timeout >= 600000 for the build.

**INT-02 script verification (Option B)** pattern: `.env`-less `git worktree add --detach <tmp> HEAD`, then `FINALLY_IMAGE=<tag> FINALLY_CONTAINER=<name> FINALLY_PORT=127.0.0.1:<port> FINALLY_VOLUME=<throwaway> scripts/start_mac.sh --no-open` and immediately `curl -sf http://127.0.0.1:<port>/api/health` must return 200; re-run start (expect "already running"), `stop_mac.sh` (volume survives), `--bogus` exits 1. Cleanup: `docker rm -f; docker volume rm; docker rmi; git worktree remove --force; git worktree prune`.

## Shared Patterns

### Health probe
**Source:** `Dockerfile:29`, `test/docker-compose.test.yml:18`, host-side variant `curl -sf --retry 30 --retry-all-errors --retry-delay 1 .../api/health` (Phase 5 gate). Use the python one-liner inside the container, curl from the host.

### Script option and error style
**Source:** `scripts/start_mac.sh:15-21`. Fixed `case` allow-list, errors to stderr, exit 1, all expansions quoted. Apply to any new branch in either start script.

### Secret safety
**Source:** `.dockerignore` excludes `.env`; `start_mac.sh:32-35` passes it only when present. Gate containers get only `LLM_MOCK=true`.

## No Analog Found

None. (Windows readiness loop has no PowerShell polling analog in the repo; copy the bash loop semantics using the file's own `$LASTEXITCODE` style.)

## Metadata

**Analog search scope:** `scripts/`, `test/`, `Dockerfile`, `README.md`, `.claude/CLAUDE.md`, `.planning/phases/05-ai-chat/`
**Files scanned:** about 14
**Pattern extraction date:** 2026-10-16
