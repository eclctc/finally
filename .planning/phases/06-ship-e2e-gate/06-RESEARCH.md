# Phase 6: Ship & E2E Gate - Research

**Researched:** 2026-10-16
**Domain:** Release gate: Docker start/stop scripts, Playwright E2E against the built container, frontend unit-coverage audit
**Confidence:** HIGH (everything below was read or run this session unless tagged otherwise)

<user_constraints>
## User Constraints

No CONTEXT.md exists: the user chose "Continue without context". The binding constraints come from the orchestrator prompt, `.planning/REQUIREMENTS.md` (Out of Scope table) and `CLAUDE.md`:

### Locked (from REQUIREMENTS.md "Out of Scope" and project state)
- No cloud deploy (Terraform/App Runner), no Docker hardening (non-root, pinned images), no root repo cleanup (stray root `pyproject.toml`).
- This phase is a ship gate, not a feature phase. Keep it minimal.
- ROADMAP Phase 6 criterion 2: "Failures are fixed in the app, not by weakening the specs." E2E specs in `test/tests/` are not edited.

### Environment constraints for research and execution
- Never read `.env`. Never pass `--env-file .env` or compose `env_file: .env` into a container the agent starts.
- Never stop, remove, restart or modify container `finally-p1` (publishes host port 8000). Never bind host port 8000.
- Any container the agent starts: only `-e LLM_MOCK=true`, bind `127.0.0.1` only, tmpfs or throwaway DB, removed afterwards.
- Host port 3000 is busy. Use `/usr/bin/grep` for GNU flags. Run frontend checks with `npm --prefix frontend ...` and backend with `cd backend && uv run pytest`.

### Deferred / out of scope
- Review advisories (WR/IN items) unless one breaks the ship gate (none does; see Section 5).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INT-01 | Vitest + RTL tests for price store and merge logic, flash triggering, watchlist add/remove, portfolio revaluation math, chat rendering and loading state | Audit table in "INT-01 Coverage Audit": every item already covered, no real gap. `npm --prefix frontend test` is green (374 tests / 30 files, three consecutive runs). |
| INT-02 | `scripts/start_mac.sh` builds and launches a working app at `http://localhost:8000` and opens the browser | Script run end to end in a `.env`-less git worktree this session; one real gap (no readiness wait before `open`). See "INT-02". |
| INT-03 | Full Playwright suite passes against the container with `LLM_MOCK=true` | Proven command shape from the Phase 3-5 gates (docker run + local `npx playwright test`); the compose path was never run and has an exit-code bug. See "INT-03". |
</phase_requirements>

## Summary

The codebase is already ship-ready in substance. The Phase 5 gate ran all 10 Playwright tests green on a fresh container, 374 frontend tests pass, typecheck is clean, and the Phase 5 backend suite is 145 passed. Phase 6 is therefore verification-heavy with three small, concrete fixes: (1) `scripts/start_mac.sh` opens the browser before the server answers (measured: not ready right after the script returns, ready about 1.5 s later), (2) `test/package.json` `test:docker` always exits 0 even when the Playwright run fails because the two compose commands are joined with `;`, and (3) stale docs (`.claude/CLAUDE.md` "Known Build Blockers", a confusing README config sentence). INT-01 needs no new tests.

The E2E gate has two paths. The one proven in Phases 3-5 is `docker build` + `docker run -d --tmpfs /app/db -e LLM_MOCK=true -p 127.0.0.1:8010:8000` followed by local `npx playwright test` with `BASE_URL`. The documented one (`test/docker-compose.test.yml`, README `npm run test:docker`) has never been run by any gate in this build; its config is valid (`docker compose config` renders), it uses the current Dockerfile, `LLM_MOCK=true`, tmpfs DB and no `env_file`. Run it once as a second proof, after fixing the exit-code bug.

**Primary recommendation:** Plan three small plans. (A) start script readiness wait + stale doc fixes, verified with a `.env`-less worktree run using `FINALLY_*` overrides. (B) `test:docker` exit-code fix. (C) the gate: INT-01 suite, then fresh container, full Playwright run, compose run, backend suite, specs-unchanged guard, and a human UAT step for the real browser open.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Build and launch the app with one command | Host shell scripts (`scripts/`) | Docker | Scripts wrap `docker build/run`; no app code involved |
| Serve UI + API on port 8000 | API / Backend (FastAPI + StaticFiles) | CDN / Static (Next export in `/app/static`) | Single container, same origin (PLAN §3) |
| SQLite persistence across restarts | Database / Storage (volume `finally-data:/app/db`) | — | Scripts mount the named volume; stop never removes it |
| Readiness before opening the browser | Host shell script | API (`/api/health`) | The script must poll the health endpoint; the server cannot open a browser |
| E2E verification | Test harness (`test/`, Playwright) | Browser | Drives the built container as a black box |
| Unit coverage of price/portfolio/chat logic | Browser / Client (Vitest + RTL, jsdom) | — | All INT-01 logic is client-side |

## Project Constraints (from CLAUDE.md)

- Simple, incremental, no over-engineering, no defensive programming; short, clearly named functions; no emojis in code or output [CITED: ~/.claude/CLAUDE.md, ./CLAUDE.md].
- `uv run` / `uv add` only for Python; backend checks via `cd backend && uv run pytest`, frontend via `npm --prefix frontend ...` [CITED: ./CLAUDE.md "Environment notes"].
- Keep README concise [CITED: ~/.claude/CLAUDE.md].
- Tech stack fixed by PLAN.md: Next.js static export, Tailwind, Recharts only, FastAPI, uv, SQLite; one container, one port 8000, single uvicorn worker, Node 22, Python 3.12 [CITED: .claude/CLAUDE.md Constraints].
- Testing: backend pytest, frontend Vitest + RTL, E2E Playwright with `LLM_MOCK=true` [CITED: .claude/CLAUDE.md].
- GSD workflow: file edits go through a GSD command (`/gsd-execute-phase`) [CITED: .claude/CLAUDE.md].
- Project skill `cerebras-inference`: not relevant (chat backend untouched).

## Standard Stack

No new packages. This phase installs nothing new; every install is `npm ci` from committed lockfiles (`frontend/`, `test/`) and `uv sync --frozen` inside the Dockerfile, exactly as in the Phase 3-5 gates.

### Core (already pinned)
| Tool | Version | Purpose | Source |
|------|---------|---------|--------|
| Vitest + RTL + jest-dom + user-event | 5.0.5 / 16.3.3 / 7.0.1 / 14.6.8 | INT-01 | [VERIFIED: frontend/package.json:1-40] |
| `@playwright/test` | 1.64.1 | INT-03 | [VERIFIED: test/package.json] |
| Playwright image | `mcr.microsoft.com/playwright:v1.64.1-noble` (present locally) | compose Playwright container | [VERIFIED: test/docker-compose.test.yml; `docker images`] |
| Chromium for local runs | revision 1248 (matches `browsers.json`, installed in `~/Library/Caches/ms-playwright`) | local `npx playwright test` | [VERIFIED: test/node_modules/playwright-core/browsers.json; `ls ~/Library/Caches/ms-playwright`] |
| Docker Compose | v5.6.0 | `npm run test:docker` | [VERIFIED: `docker compose version`] |

### Package Legitimacy Audit
No external package is added or upgraded by this phase. Audit not applicable: **Packages removed (SLOP):** none. **Packages flagged (SUS):** none.

## Architecture Patterns

### Gate flow (data flow)

```
scripts/start_mac.sh  --docker build-->  image  --docker run (-v finally-data:/app/db, optional --env-file .env)--> container :8000
        |                                                                    |
        | (NEW) poll GET /api/health until 200  <----------------------------+
        v
   open http://localhost:PORT  (browser)

Gate (no .env, no port 8000):
 docker build -t finally-phase6 .  -->  docker run -d --name finally-p6 -p 127.0.0.1:8010:8000 --tmpfs /app/db -e LLM_MOCK=true
        --> curl /api/health  --> cd test && BASE_URL=http://127.0.0.1:8010 npx playwright test
              [project fresh-start] -> [project features: chat, portfolio-charts, sse-reconnect, trading, watchlist]
```

### Pattern 1: Proven E2E gate (use this as the primary INT-03 path)
**What:** Phase 5 gate commands, verbatim from `.planning/phases/05-ai-chat/05-06-PLAN.md` (Tasks 1 and 2) which passed 10/10 (`05-06-SUMMARY.md`) [VERIFIED: files read this session]:
```bash
docker rm -f finally-p3 finally-p4 finally-p5 >/dev/null 2>&1; docker build -t finally-phase5 . && docker run -d --name finally-p5 -p 127.0.0.1:8010:8000 --tmpfs /app/db -e LLM_MOCK=true finally-phase5 && curl -sf --retry 30 --retry-all-errors --retry-delay 1 http://127.0.0.1:8010/api/health | /usr/bin/grep -q '"status":"ok"' && curl -sf http://127.0.0.1:8010/ | /usr/bin/grep -q 'data-testid="chat-input"' && echo CONTAINER_OK
cd test && BASE_URL=http://127.0.0.1:8010 npx playwright test fresh-start.spec.ts chat.spec.ts --reporter=list   # tracer
docker rm -f finally-p5 >/dev/null 2>&1; docker run -d --name finally-p5 -p 127.0.0.1:8010:8000 --tmpfs /app/db -e LLM_MOCK=true finally-phase5 && curl -sf --retry 30 --retry-all-errors --retry-delay 1 http://127.0.0.1:8010/api/health | /usr/bin/grep -q '"status":"ok"' && echo FRESH_DB_OK
cd test && BASE_URL=http://127.0.0.1:8010 npx playwright test --reporter=list     # full suite, 10 passed
cd backend && uv run pytest -q                                                    # 145 passed
test -z "$(git log --format=%h <BASE>..HEAD -- test/tests)" && test -z "$(git status --porcelain -- test/tests)" && echo SPECS_UNCHANGED
docker rm -f finally-p5
```
For Phase 6 rename `p5`/`phase5` to `p6`/`phase6`. Use a `<BASE>` of the HEAD at planning time (the only commit ever to touch `test/` is `5681c3a` [VERIFIED: `git log -- test/`], so `5681c3a` is also a valid base). The tracer pair must name `fresh-start.spec.ts` explicitly (05-RESEARCH A3: Playwright dependency projects may be filtered out when only some files are named). Give Bash calls that build the image a timeout of at least 600000 ms.

### Pattern 2: Fresh DB per full run
`fresh-start.spec.ts` asserts total value exactly 10000 and exactly 10 rows. `chat.spec.ts` leaves a 1 AAPL position and `portfolio-charts.spec.ts` leaves a 1 JPM position, so a second full run on the same container fails `fresh-start` for non-bug reasons. Always recreate the container (tmpfs) before each full run [VERIFIED: test/tests/fresh-start.spec.ts, chat.spec.ts, portfolio-charts.spec.ts read this session; matches PITFALLS.md Pitfall 12].

### Anti-Patterns to Avoid
- **Weakening or editing a spec to make it pass.** Fix the app. Guard with the `SPECS_UNCHANGED` check.
- **Running the start script from the main checkout on this machine.** The root `.env` exists there and the script passes it with `--env-file` (start_mac.sh:33-35); also port 8000 is taken by `finally-p1`.
- **Trusting `docker image inspect finally` as "up to date".** The script skips the build whenever the image exists (start_mac.sh:23). On this machine `finally:latest` exists and is 28 hours old [VERIFIED: `docker images`], so a gate run must use `--build` or a new `FINALLY_IMAGE` tag.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Waiting for the container | A fixed `sleep N` | `curl -sf` retry loop on `/api/health` (the same check the Dockerfile HEALTHCHECK and prior gates use) | Start time varies (about 1.5 s here, longer on a cold first run) |
| Fresh DB for E2E | Delete rows via API | `--tmpfs /app/db` (or compose `tmpfs`) | A recreated container is a pristine DB |
| E2E isolation | A new harness | Existing `test/` Playwright project with `fresh-start` then `features` | Already proven 10/10 |

## Runtime State Inventory

Not a rename/refactor phase. Omitted.

## INT-02: scripts audit

Read this session: `scripts/start_mac.sh`, `scripts/stop_mac.sh`, `scripts/start_windows.ps1`, `scripts/stop_windows.ps1`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.env.example`, `README.md`.

### Comparison against PLAN.md §11

| PLAN §11 requirement | start_mac.sh | Verdict |
|---|---|---|
| Build if not built or `--build` | line 23: `if $BUILD \|\| ! docker image inspect "$IMAGE" ...; docker build -t "$IMAGE" "$ROOT_DIR"` | OK |
| Volume `finally-data:/app/db` | line 38: `-v "${VOLUME}:/app/db"`, `VOLUME="${FINALLY_VOLUME:-finally-data}"` | OK |
| Port 8000 | line 37: `-p "${PORT}:8000"`, `PORT="${FINALLY_PORT:-8000}"` | OK |
| `.env` passed only if it exists | lines 32-35: `if [ -f "$ROOT_DIR/.env" ]; then ENV_ARGS=(--env-file "$ROOT_DIR/.env")` | OK |
| Print URL | line 44: `echo "Open $URL"` | OK |
| Open browser unless `--no-open` | lines 45-47: `open "$URL" \|\| xdg-open "$URL" ... \|\| true` | Works but see Gap 1 |
| Idempotent | line 28: running container and no `--build` prints "FinAlly is already running."; otherwise `docker rm -f` then run | OK (observed) |
| Stop does not remove the volume | stop_mac.sh uses only `docker stop` and `docker rm` of the container | OK (observed: volume survived stop) |
| Unknown option | lines 14-20 exit 1 with message | OK (observed `exit=1`) |
| Bash 3.2 (macOS) compat | `${ENV_ARGS[@]+"${ENV_ARGS[@]}"}` guard with `set -u` | OK; `bash -n` passes on both scripts [VERIFIED: ran `bash -n`] |
| Executable bit | `git ls-files -s`: `100755` for both `.sh` files | OK |

### Gaps (concrete)

1. **No readiness wait before opening the browser (`start_mac.sh:41-47`, real bug against ROADMAP criterion 1 "opens the browser to a working app").** `docker run -d` returns immediately; the script then runs `open`. Measured in the worktree run: three `curl /api/health` calls issued right after the script returned all returned `000`; a 0.1 s poll loop showed the server ready 1.5 s after the script returned [VERIFIED: ran this session]. A browser launch is slower than that on a warm machine, so it will often work, but on a cold start or slower machine the student sees a connection error. Minimal fix (in scope, PLAN §11-aligned): after `docker run`/"already running", poll `"$URL/api/health"` (about 30 tries, 1 s apart) before `open`; if it never answers, print `docker logs` guidance and exit 1. Mirror in `start_windows.ps1` with `Invoke-WebRequest` (cannot be run on this machine; mark untested, or leave Windows untouched, planner's call; PLAN lists both scripts so mirroring is recommended).
2. **Stale-image trap (`start_mac.sh:23`).** A pre-existing `finally` image is reused without a rebuild. Correct per PLAN ("builds the Docker image if not already built") and not a bug for a student's first run; it only matters for the gate. Gate runs must pass `--build` or `FINALLY_IMAGE=<new tag>`.
3. **Port conflict gives a raw Docker error.** If port 8000 is taken, `docker run` fails after `docker rm -f` and `set -e` exits with Docker's message. Acceptable; not worth code.
4. **README does not document the `FINALLY_IMAGE/CONTAINER/PORT/VOLUME` overrides** (they exist in both script pairs). Optional one-line mention; not required.
5. **Windows scripts parity:** structure matches the mac scripts. One unverified risk: under `$ErrorActionPreference = "Stop"`, `docker image inspect $Image *> $null` and `docker rm -f $Container *> $null` write to stderr when the image or container is absent, which Windows PowerShell 5.1 can treat as a terminating error [ASSUMED]. Not testable here; INT-02 names only `start_mac.sh`. Report to the user as unverified, do not block on it.

### Dockerfile, .dockerignore, docker-compose.yml
- Dockerfile stage 1 `npm ci` + `npm run build` on `frontend/`, stage 2 copies `/frontend/out` to `./static`, `STATIC_DIR=/app/static`, `FINALLY_DB_PATH=/app/db/finally.db`, `HEALTHCHECK` on `/api/health`, single uvicorn worker [VERIFIED: Dockerfile read this session]. The rebuilt Next.js frontend works with it: the worktree build (`docker build` from a clean checkout of HEAD, no `node_modules`) succeeded and the served page contains `data-testid="chat-input"`, `cash-balance`, `chat-panel`, `chat-send` [VERIFIED: ran this session]. The stale "Known Build Blockers" claim is false.
- `.dockerignore` excludes `.env`, `.git`, `.claude`, `.venv`, `db/`, `planning/`, `test/`, `scripts/`, `frontend/node_modules|.next|out`, `backend/.venv|static|tests` [VERIFIED: file read]. `.env` is never baked into the image.
- Root `docker-compose.yml` uses `env_file` with `required: false` and the same named volume. It is an optional wrapper (PLAN §4) and passes `.env` when present, so do not run it on this machine.
- `.env.example` has `OPENROUTER_API_KEY=`, `MASSIVE_API_KEY=`, `LLM_MOCK=false` [VERIFIED: file read], consistent with PLAN §5 and README.

### Verification options under this machine's constraints

| Option | How | Proves | Cost / trade-off |
|---|---|---|---|
| A. Static checks only | `bash -n scripts/*.sh`, read the flags | Syntax, flag wiring | Proves nothing about build or runtime |
| **B. `.env`-less git worktree + overrides (RECOMMENDED)** | `git worktree add --detach <tmpdir> HEAD` (no `.env`, it is gitignored), then `FINALLY_IMAGE=<tag> FINALLY_CONTAINER=<name> FINALLY_PORT=127.0.0.1:<free port> FINALLY_VOLUME=<throwaway> scripts/start_mac.sh --no-open`; poll health; `stop_mac.sh`; remove container, volume, image and worktree | Real build from the committed tree, container start, 127.0.0.1-only publish, idempotent re-run, stop keeps volume, unknown-option exit, no `.env` passed | Needs no script change: the existing overrides suffice. `FINALLY_PORT=127.0.0.1:8011` works because `PORT` is used only in `-p "${PORT}:8000"` and the printed URL; the printed line is cosmetically wrong (`http://localhost:127.0.0.1:8011`). Does not exercise `open`. The container has no `LLM_MOCK` (no `.env`), so it cannot run the chat spec |
| C. Human UAT | The user runs `scripts/start_mac.sh` themselves from the main checkout (their `.env` is then used legitimately by them). Port 8000 is held by `finally-p1`; the user stops that or runs `FINALLY_PORT=8001 FINALLY_CONTAINER=finally-ui scripts/start_mac.sh --build` (browser opens `http://localhost:8001` correctly) | The real `open` call and the real-browser look at the app | Only the human can do this (agent must not touch port 8000 or `.env`) |

**Recommendation:** B for automated proof (already executed once this session against current HEAD: build OK, started, `/api/health` 200 after about 1.5 s, second `start` printed "already running", `stop` removed the container and kept the volume, second `stop` printed "not running", `--bogus` exited 1) plus C as the end-of-phase UAT for the browser open. After the Gap 1 fix, re-run B and assert the script itself returns only after the health endpoint answers (for example run `curl -sf http://127.0.0.1:<port>/api/health` as the very next command and require 200). The Gap 1 fix is in scope (minimal, PLAN §11 / ROADMAP criterion 1); no other script change is needed and none that the user ruled out (no hardening, no cloud, no repo cleanup).

Cleanup after B (verified working): `docker rm -f <name>; docker volume rm <volume>; docker rmi <tag>; git worktree remove --force <dir>; git worktree prune`. After my run `docker ps -a` showed only `finally-p1`, `docker volume ls` only `finally-data`, `git worktree list` only the main tree.

## INT-03: E2E audit

### Spec to PLAN.md §12 scenario map

| PLAN §12 scenario | Spec (test name) |
|---|---|
| Fresh start: default watchlist, $10k, prices streaming | `fresh-start.spec.ts` "fresh start shows the default watchlist, $10,000 cash, and streaming prices" (10 rows, cash and total exactly 10000, dot `connected`, AAPL price ticks) |
| Add and remove a ticker | `watchlist.spec.ts` "adding and removing a ticker updates the watchlist" (DIS); plus "clicking a watchlist row selects it in the main chart and trade bar" |
| Buy shares | `trading.spec.ts` "buying shares lowers cash and adds a position" (MSFT x2) |
| Sell shares | `trading.spec.ts` "selling part of a position..." (NVDA), "selling an entire position removes it..." (AMZN), "selling more shares than held shows a trade error" (TSLA) |
| Portfolio visualization | `portfolio-charts.spec.ts` "heatmap and P&L chart render once a position exists" (JPM; `svg rect`, `svg path.recharts-curve`) |
| AI chat (mocked) | `chat.spec.ts` "mocked AI chat buys AAPL and shows the trade inline" |
| SSE resilience | `sse-reconnect.spec.ts` "price stream reconnects after the server drops the connection" (route-mocked drop, reconnecting, then connected, price resumes) |

10 tests in 6 spec files (+ `helpers.ts`), all PLAN §12 scenarios covered [VERIFIED: files read this session; `grep` of `test(` lines]. No `.skip/.fixme/.only` present.

### Config facts
`test/playwright.config.ts`: `workers: 1`, `fullyParallel: false`, `retries: 0`, test timeout 30 s, expect timeout 10 s, viewport 1600x1000, `baseURL: process.env.BASE_URL ?? "http://localhost:8010"`, projects `fresh-start` (matches `fresh-start.spec.ts`) then `features` (ignores it, `dependencies: ["fresh-start"]`) [VERIFIED: file read]. Features run alphabetically: chat, portfolio-charts, sse-reconnect, trading, watchlist.

### The documented compose path (`test/docker-compose.test.yml`)
Verified by reading the file and rendering `docker compose -p finally-test -f test/docker-compose.test.yml config` (valid):
- Builds the current Dockerfile (`context: ..`, `dockerfile: Dockerfile`); `.dockerignore` at the root still excludes `.env`.
- `environment: LLM_MOCK: "true"`; no `env_file`; `tmpfs: /app/db` (fresh DB per `up`).
- Service is named `finally`, not `app` (Chromium HSTS-preloads `.app`); keep the comment.
- Healthcheck uses `python -c urlopen(.../api/health)`, 2 s interval, 30 retries; Playwright waits via `depends_on: condition: service_healthy`.
- Playwright container `mcr.microsoft.com/playwright:v1.64.1-noble` (image tag matches the `@playwright/test` 1.64.1 pin, and is already pulled), `BASE_URL: http://finally:8000`, `CI: "true"`, bind mount `.:/e2e` with an anonymous `/e2e/node_modules` volume, `command: sh -c "npm ci && npx playwright test"`.
- App port is published `8010:8000` on all interfaces, not `127.0.0.1` (compose `config` output: `published: "8010"`). Host 8010 is free right now [VERIFIED: `lsof` printed "8010 free"].
- Local images `finally-test-finally` and `finally-test-app` exist from the original agent-team build [VERIFIED: `docker images`], but no Phase 3-5 gate ever ran the compose path (grep of `.planning/phases/0[3-5]-*` finds only `docker run` gates). **It is unproven against the current frontend.**

### Defects and risks found

1. **`test/package.json` `test:docker` hides test failures.** The script is `docker compose ... up --build --abort-on-container-exit --exit-code-from playwright; docker compose ... down -v`. In a shell, `a; b` returns `b`'s status, so `npm run test:docker` exits 0 (the `down -v` result) even when Playwright failed [VERIFIED: `test/package.json` read; `sh -c 'false; true'` returns 0]. README advertises this command as the E2E gate. Fix (in scope, test infra not a spec): capture the status, for example `up ... ; s=$?; down -v; exit $s` (or use `;` with an explicit `sh -c`). Until fixed, read the `playwright exited with code N` line, not the npm exit code.
2. **Compose path never run on current code.** Plan one real run (after fix 1). Failure modes to expect and fix in test infra only: a stale `finally-test-finally` image (the `--build` flag handles it), `npm ci` network in the container, root-owned `playwright-report/` or `test-results/` in the bind mount (gitignored by `test/.gitignore`, only matters on Linux hosts), host 8010 busy.
3. **Compose publishes 8010 on 0.0.0.0.** The agent's own constraints say 127.0.0.1 only. One-line optional change to `"127.0.0.1:8010:8000"` (Playwright reaches the app over the compose network, not the host port, so nothing else changes). If the planner prefers not to edit the file, run the compose path as a human UAT step instead.
4. **Fresh DB ordering (flakiness risk, handled):** `fresh-start` must see a pristine DB; both paths recreate the container. Re-running `npx playwright test` against a used container fails `fresh-start`; this is expected, not a bug.
5. **Spec cross-coupling by design:** chat buys 1 AAPL (never closed), portfolio-charts buys 1 JPM (never closed). Later specs close their own tickers (`closePosition`) and compare cash relatively, so ordering is safe [VERIFIED: trading.spec.ts, helpers.ts read]. Do not add a spec that asserts a pristine portfolio after `fresh-start`.
6. **SSE reconnect timing:** the spec depends on the client recreating a CLOSED stream after 1 s and on `retry: 500`; the Phase 3 Chromium spike and the Phase 5 10/10 run confirm it passes. Real-time dependent (price must change within 15 s in fresh-start, 10 s expect timeout elsewhere); a very slow CI could flake, raise Docker resources rather than timeouts.
7. **Local browsers:** `npx playwright test` needs the Chromium revision from `browsers.json` (1248, installed locally). If missing: `cd test && npx playwright install chromium`.
8. `test/README.md` still says "using the data-testids in planning/TEAM.md section 5". The file exists [VERIFIED: `ls planning`]; no action.

### Recommended INT-03 gate
Primary: Pattern 1 above (proven, binds 127.0.0.1, tmpfs, only `LLM_MOCK=true`). Secondary: `npm --prefix test run test:docker` after fix 1 (and optionally the 127.0.0.1 port tweak), then confirm "playwright exited with code 0" and cleanup (`down -v` is in the script). If the secondary run fails only for compose-infra reasons, fix the compose file; if it fails on a spec, fix the app.

## INT-01 Coverage Audit

All five items are covered by existing tests; names below are the exact `it(...)` titles read this session [VERIFIED: grep of `describe`/`it` lines in the listed files]. `npm --prefix frontend test` → `Test Files 30 passed (30)`, `Tests 374 passed (374)` on three consecutive runs; `npm --prefix frontend run typecheck` clean [VERIFIED: ran this session].

| INT-01 item | File | Representative tests |
|---|---|---|
| Price store and merge logic | `frontend/src/lib/priceStore.test.ts` (24) | `mergeFrame`: "ignores a repeated timestamp: same entry object, no listener call, no history point, same version", "merging the same frame twice changes nothing after the first merge", "notifies only the ticker that appears in the frame", "skips an entry with a null price", "keeps price and open price exactly as received"; `history` (cap, "stores t as exactly the frame timestamp times 1000"); `seedPrices` "never overwrites a streamed entry"; `clearTicker`; `status`; `subscriptions`; `resetPriceStore`. Also `priceStream.test.ts` (10: one EventSource, reconnect, CLOSED recreate after 1000 ms, cleanup) and `usePrice.test.tsx` (5: "re-renders only the probe whose ticker is in the frame") |
| Flash triggering | `frontend/src/components/FlashingPrice.test.tsx` (10) plus `priceStore.test.ts` | "flashes up with the up tint and keeps the text color", "flashes down with the down tint on a lower price", "holds for 49 ms and clears at 50 ms into the fade classes", "does not flash when an identical frame is merged again", "does not flash an equal price even when the frame direction says up", "decides direction on raw prices, not on the rendered text", "paints nothing under reduced motion"; store side: "flashes up, down and null by comparing raw prices and appends one history point per tick", "ignores the frame's sticky direction: an equal price flashes null" |
| Watchlist add/remove | `frontend/src/components/Watchlist.test.tsx` (48), `lib/useWatchlist.test.tsx` (4) | Add: "uppercases typed text, posts the trimmed ticker and shows the new row", "shows a 400 error inline, keeps the text and flags the input until the next keystroke", "keeps Add disabled and labelled Add while a POST is pending, and sends one POST"; Remove: "deletes, reloads, then drops the row, its store entry and history, and focuses the input", "treats a 404 as already removed...", "encodes the ticker in the DELETE path"; plus `Dashboard.test.tsx` (24) |
| Portfolio revaluation math | `frontend/src/lib/portfolioValue.test.ts` (6), `Header.test.tsx`, `PositionsTable.test.tsx`, `pnlSeries.test.ts` (12) | `liveTotalValue`: "equals cash when there are no positions", "values a position at the live price when the stream has one", "sums a live-priced and a fallback-priced position without counting either as zero"; `livePosition` (2); Header "revalues the total at live prices while cash stays the same", "ignores the API total_value"; PositionsTable "revalues at the live price and ignores other tickers", "colors one cent either side of the average cost", "never shows the API unrealized P&L"; `buildPnlSeries` live tail and 300-point `downsample` |
| Chat rendering and loading state | `frontend/src/components/ChatDock.test.tsx` (23), `ChatBubble.test.tsx` (8), `lib/chat.test.ts` (5) | Loading: "shows the user bubble, Thinking... and a locked composer", "a reply removes the loading line, unlocks and clears the composer, and adds one pair of bubbles", "a failure removes the loading line", "sends one request for two synchronous submits and for Enter while pending"; rendering: "renders every action in order with its own status and style", "renders hostile text as literal text in the message, ticker and error", "a fresh dock shows the empty line, three chips in order and the composer", "a 502 shows the error inline and keeps the text" |

**Gap:** none. There is no `useChat.test.ts`; the hook is exercised through `ChatDock.test.tsx` (pending, error, resend, lost-response `onUnconfirmed`), which is the right level. Do not add tests for this phase. If the planner wants a durable check, add a single verification step that greps for the five test files and runs them by name (see Validation Architecture); do not rewrite existing tests.

## Other ship blockers and stale docs

- `.claude/CLAUDE.md` "Known Build Blockers" (lines 107-110) says `frontend/` is empty and `docker build` fails. Both false (Phase 1 built the image; this session rebuilt it). The same file's "Languages", "Runtime" and "Frameworks" bullets still call `frontend/` empty. Fix in the plan: replace the blockers section and the "Not present. The `frontend/` directory exists but is empty" bullet. Doc-only, low risk, and stale instructions mislead later agents.
- `.planning/codebase/` map is stale for README and backend (advisory only; the orchestrator already knows; leave alone or refresh via `/gsd-map-codebase`).
- README Quick Start (`cp .env.example .env`, `./scripts/start_mac.sh`, `./scripts/stop_mac.sh`, `--build`, `--no-open`, `cd test && npm run test:docker`) matches the scripts. One awkward sentence: "Copy `.env` values as needed:" under Configuration (should say these variables go in `.env`). Optional one-liner: mention `LLM_MOCK=true` lets the app run chat without an API key. `.env.example` keys match PLAN §5 and the code.
- With the default `.env.example` (`LLM_MOCK=false`, empty key) chat returns 502 "OPENROUTER_API_KEY is not set". Expected per PLAN §9; document, do not change.
- Review dispositions: Phase 1 WR-03 (testid parity can pass vacuously), Phase 3 WR-01..04, and all IN items are non-gate; Phase 4 WR-01 (flaky Dashboard test) is already `fixed`, and three back-to-back full Vitest runs were stable [VERIFIED: 04-REVIEW-DISPOSITION.md frontmatter; ran this session]. None breaks the ship gate; none needs action.
- The user's `finally-data` volume exists locally and holds their own data. Never use it for gate runs.

## Common Pitfalls

### Pitfall 1: Gate run silently uses a stale image
**What goes wrong:** `scripts/start_mac.sh` finds `finally:latest` (28 h old here) and skips the build, so the "ship" test runs old code.
**How to avoid:** Gate with `--build` or a fresh `FINALLY_IMAGE` tag; for E2E always `docker build -t finally-phase6 .` first.
**Warning signs:** the script prints no "Building image" line.

### Pitfall 2: `fresh-start` fails on a reused container
**What goes wrong:** second full run sees AAPL/JPM positions and total != 10000.
**How to avoid:** `docker rm -f` + `docker run --tmpfs` before every full run.

### Pitfall 3: `npm run test:docker` exits 0 on failure
**How to avoid:** fix the script (Section INT-03 defect 1) and still read the `playwright exited with code` line.

### Pitfall 4: Agent passes `.env` or hits port 8000 by accident
**What goes wrong:** running `scripts/start_mac.sh` or root `docker compose up` from the main checkout passes the user's `.env` and/or fights `finally-p1` for 8000.
**How to avoid:** worktree without `.env` plus `FINALLY_*` overrides; never run root `docker-compose.yml`.

### Pitfall 5: Browser opens before the server is up
**How to avoid:** readiness wait (INT-02 Gap 1).

### Pitfall 6: Mock-trigger words in test strings
Any chat text containing "buy", "sell" or "add" inside a word triggers the mock LLM. Quick-prompt chips are already tested for this (`chat.test.ts` "never contains a word the mock LLM turns into a trade or watchlist change").

## Code Examples

### Readiness wait for `scripts/start_mac.sh` (insert before the `open` block, after the if/else)
```bash
echo "Waiting for FinAlly..."
HEALTH_CHECK='import urllib.request; urllib.request.urlopen("http://localhost:8000/api/health")'
for _ in $(seq 1 30); do
  docker exec "$CONTAINER" python -c "$HEALTH_CHECK" >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" python -c "$HEALTH_CHECK" >/dev/null 2>&1 || { echo "FinAlly did not become ready; see: docker logs $CONTAINER" >&2; exit 1; }
```
Source: the same Python one-liner the Dockerfile `HEALTHCHECK` and `docker-compose.test.yml` healthcheck already use [VERIFIED: Dockerfile, test/docker-compose.test.yml]. It probes inside the container, so it does not depend on `$URL` or the host port and works under any `FINALLY_PORT` override, including the `127.0.0.1:<port>` trick (where `$URL` is malformed). It does not prove the host port mapping, so the automated check for it is a `curl -sf http://127.0.0.1:<port>/api/health` issued as the very next command after the script returns (must be 200). `docker exec` and `python` in the image are verified by the HEALTHCHECK; the exact loop was not run this session, so run it in Option B. Alternative if a host-side probe is preferred: `curl -sf "$URL/api/health"`, which needs a plain numeric `FINALLY_PORT` and therefore binds all interfaces during verification.

### Exit-code-preserving `test:docker`
```json
"test:docker": "docker compose -p finally-test -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from playwright; s=$?; docker compose -p finally-test -f docker-compose.test.yml down -v; exit $s"
```
Source: POSIX shell semantics (verified `sh -c 'false; true'` → 0).

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| Original agent-team frontend at `5681c3a` | Fresh Next.js 16 / React 19 / TS 7 frontend, 374 tests | The E2E specs (unchanged since `5681c3a`) are the UI contract and pass against the new frontend |
| README "E2E in Docker" assumed reliable | Compose path never exercised in this build | Needs one proven run |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Windows PowerShell 5.1 may throw on `*> $null` of a native command's stderr under `$ErrorActionPreference = "Stop"` (Windows scripts' "absent image/container" path) | INT-02 Gap 5 | Windows start script could abort on first run. Not gating (INT-02 names only `start_mac.sh`); cannot be tested on this Mac |
| A2 | The compose Playwright container's `npm ci` and the Linux image's Chromium work on this Docker Desktop host without extra setup | INT-03 defect 2 | Compose run fails for environment reasons; fall back to the proven docker-run path and report |

All other claims in this document were read or run this session.

## Open Questions

1. **Should the Windows script get the same readiness wait?**
   - Known: the gap is identical; PLAN §11 lists both scripts.
   - Unclear: it cannot be run on macOS.
   - Recommendation: mirror it (small `Invoke-WebRequest` loop), mark it untested in the summary and in the UAT file; or leave Windows unchanged if the user prefers strictly minimal.
2. **Is the compose second proof worth running?** Recommendation: yes, once, because README tells students to use it; skip only if host constraints block it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | build, run, compose | yes | daemon running (`finally-p1` healthy) | — |
| Docker Compose | `test:docker` | yes | v5.6.0 | docker run gate |
| Node / npm | frontend, test | yes | frontend suite ran | — |
| uv | backend pytest | yes | used by prior gates (145 passed) | — |
| Playwright Chromium rev 1248 | local `npx playwright test` | yes | `~/Library/Caches/ms-playwright` | `npx playwright install chromium` |
| Playwright image `v1.64.1-noble` | compose Playwright container | yes (pulled locally) | 1.64.1 | pull |
| Host port 8010 | gate container | yes (free) | — | choose another 127.0.0.1 port and set `BASE_URL` |
| Host port 8000 | the user's own `start_mac.sh` run | no, held by `finally-p1` | — | `FINALLY_PORT=8001` for the human UAT |
| `.env` | users' real run | exists but must not be read | — | worktree without `.env` |

Machine state at research end: `docker ps -a` shows only `finally-p1` (Up, healthy); volumes only `finally-data`; images present: `finally`, `finally:dev`, `finally-phase1/3/4/5`, `finally-test-finally`, `finally-test-app` (old). No probe artifacts remain.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.5 + React Testing Library 16.3.3 (frontend); pytest 9.1.1 (backend); Playwright 1.64.1 (E2E) |
| Config file | `frontend/vitest.config.mts`, `frontend/vitest.setup.ts`; `backend/pyproject.toml`; `test/playwright.config.ts` |
| Quick run command | `npm --prefix frontend test` (about 2 s, 374 tests) |
| Full suite command | `npm --prefix frontend test && npm --prefix frontend run typecheck && npm --prefix frontend run build` then the Pattern 1 container gate, then `cd backend && uv run pytest -q` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INT-01 | Price store and merge | unit | `npm --prefix frontend test -- src/lib/priceStore.test.ts src/lib/priceStream.test.ts src/lib/usePrice.test.tsx` | yes |
| INT-01 | Flash triggering | component | `npm --prefix frontend test -- src/components/FlashingPrice.test.tsx` | yes |
| INT-01 | Watchlist add/remove | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx src/lib/useWatchlist.test.tsx` | yes |
| INT-01 | Portfolio revaluation | unit + component | `npm --prefix frontend test -- src/lib/portfolioValue.test.ts src/components/Header.test.tsx src/components/PositionsTable.test.tsx src/lib/pnlSeries.test.ts` | yes |
| INT-01 | Chat rendering and loading | component | `npm --prefix frontend test -- src/components/ChatDock.test.tsx src/components/ChatBubble.test.tsx src/lib/chat.test.ts` | yes |
| INT-01 | Whole suite green | all | `npm --prefix frontend test` expecting `Tests  374 passed (374)` or more, `Test Files  30 passed` | yes |
| INT-02 | Script builds, starts, stays idempotent, stop keeps volume, no `.env` | scripted integration | Worktree procedure (Option B): `FINALLY_IMAGE=... FINALLY_CONTAINER=... FINALLY_PORT=... FINALLY_VOLUME=... scripts/start_mac.sh --no-open` then `curl -sf .../api/health` immediately returns 200 (after the Gap 1 fix) | no automated file; plan task with commands |
| INT-02 | `bash -n` on scripts | static | `bash -n scripts/start_mac.sh && bash -n scripts/stop_mac.sh` | yes |
| INT-02 | Browser opens to working app | manual | Human UAT: run the script on a free port from the main checkout, confirm the browser lands on a working app | manual-only (agent cannot touch `.env` or port 8000) |
| INT-03 | All 10 specs pass, specs unchanged | E2E | Pattern 1 full-suite command, then the `SPECS_UNCHANGED` guard | yes |
| INT-03 | Compose path | E2E | `npm --prefix test run test:docker` (after exit-code fix); read `playwright exited with code 0` | yes (unproven) |
| Regression | Backend | unit | `cd backend && uv run pytest -q` expecting 145 passed | yes |

### Sampling Rate
- **Per task commit:** `npm --prefix frontend test` (doc/script tasks: `bash -n scripts/*.sh`).
- **Per wave merge:** `npm --prefix frontend test && npm --prefix frontend run typecheck`.
- **Phase gate:** full suite + build, container gate with 10 passed, backend 145 passed, `SPECS_UNCHANGED`, then `/gsd-verify-work` with the human UAT items.

### Wave 0 Gaps
None for test code: no new test files are needed, INT-01 is covered by existing files, and the E2E harness exists. Non-test prerequisites: `npm --prefix frontend ci` and `npm --prefix test ci` if `node_modules` are missing (worktrees have none; the main checkout does); fix `test:docker` exit status before relying on it.

## Security Domain

`security_enforcement` is enabled in `.planning/config.json` (ASVS level 1, block on high).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single-user, no login (PLAN) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single user |
| V5 Input Validation | minimal | Script option parsing is a fixed `case` allow-list with exit 1 on unknown (start_mac.sh:14-20); all variable expansions are quoted |
| V6 Cryptography | no | None added |
| V14 Configuration / secrets | yes | `.env` is dockerignored and passed only at runtime via `--env-file`; gate containers get only `LLM_MOCK=true` |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret leakage into image layers or logs | Information disclosure | `.dockerignore` lists `.env` [VERIFIED]; scripts never echo env values |
| Agent run reads or forwards the user's `.env` | Information disclosure | Worktree without `.env`; no `env_file` in `test/docker-compose.test.yml` [VERIFIED] |
| Unauthenticated app reachable on the LAN (`-p 8000:8000` binds 0.0.0.0) | Elevation of privilege | Accepted: PLAN §11 specifies this mapping and the user excluded Docker hardening. Gate containers use `127.0.0.1` |
| Gate weakens E2E specs | Tampering | `SPECS_UNCHANGED` guard |
| Supply chain on install | Tampering | `npm ci` from lockfiles only; no new packages |

## Sources

### Primary (HIGH confidence, read or run this session)
- `scripts/start_mac.sh`, `stop_mac.sh`, `start_windows.ps1`, `stop_windows.ps1`, `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.env.example`, `README.md`
- `test/docker-compose.test.yml`, `test/package.json`, `test/playwright.config.ts`, `test/README.md`, `test/tests/*.spec.ts`, `test/tests/helpers.ts`, `test/.gitignore`
- `.planning/phases/05-ai-chat/05-06-PLAN.md` and `05-06-SUMMARY.md` (proven gate commands and results), `04-07-SUMMARY.md`, `03-05-SUMMARY.md`, `.planning/research/PITFALLS.md` (Pitfall 12)
- `frontend/package.json`, test names in `frontend/src/lib/*.test.ts*` and `frontend/src/components/*.test.tsx`
- Runs: `npm --prefix frontend test` (x3), `npm --prefix frontend run typecheck`, `bash -n`, `docker compose config`, and a full `start_mac.sh`/`stop_mac.sh` probe in a throwaway `.env`-less worktree (container `finally-r6probe` on `127.0.0.1:8011`, throwaway volume; removed)

### Secondary / Tertiary
- None. No web search was needed: no new library is introduced.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing new, all pins read from lockfile-backed manifests.
- Architecture / gate flow: HIGH, the primary path was proven in three prior phase gates and the script path was exercised this session.
- Pitfalls: HIGH, each one reproduced or read in the source.
- Windows script behavior: LOW, unverified (A1).

**Research date:** 2026-10-16
**Valid until:** 30 days (stable; invalidated only by edits to Dockerfile, scripts or specs)
