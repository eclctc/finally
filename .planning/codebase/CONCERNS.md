---
last_mapped_commit: 065e01660f2a51736d8dd3bf782db951debb2449
last_mapped_at: 2026-10-16
---
# Codebase Concerns

**Analysis Date:** 2026-10-16

## Summary

- The `frontend/` directory is gone. The working tree has an empty `frontend/` folder, so the Docker build fails at stage 1 and the UI does not exist. This is the single largest issue.
- The backend is functionally complete. Its 103 pytest tests pass (`cd backend && uv run pytest`).
- Main risks are the absence of any authentication on a LAN-exposed container, races around `await` points in the watchlist and chat paths, non-atomic chat turns, and a few scaling limits in SQLite and the SSE stream.
- `planning/ISSUES.md` lists no open issues. Its only details entry is a resolved test-harness problem (service host "app" hit HSTS preload; `setOffline` does not cut an open SSE stream). Both were fixed in `test/`.

## Missing Frontend (Critical)

**Frontend source is absent:**
- Issue: `frontend/` exists on disk as an empty directory. No `package.json`, no `src/`, no Next.js config.
- Git state: the files were removed in commit `065e016` ("Start of GSD process", 564 files changed, including `frontend/package.json`, `frontend/next.config.ts`, `frontend/vitest.config.mts`). `git status` reports a clean tree, so the deletion is committed. The previous frontend is recoverable from `5681c3a`.
- Impact:
  - `Dockerfile` line 4 (`COPY frontend/package.json frontend/package-lock.json ./`) fails, so `scripts/start_mac.sh` and `scripts/start_windows.ps1` cannot build the image.
  - `backend/app/main.py` lines 69-70 skip the static mount when `STATIC_DIR` is absent, so `/` returns 404 and the app is API-only.
  - `README.md` "Development" section (`cd frontend && npm test`) and the E2E suite in `test/tests/*.spec.ts` (which assume the UI at `http://localhost:8000`) cannot run.
  - Frontend requirements in `planning/PLAN.md` section 10 (watchlist grid, flash animations, Recharts charts, treemap, chat panel, `EventSource` client) have no implementation.
- Fix approach: restore `frontend/` from `5681c3a` (`git checkout 5681c3a -- frontend`) or rebuild it under the GSD phase process. Then rebuild the image and re-run the Playwright suite in `test/`.

## Build and Packaging Debt

**Root `pyproject.toml` contradicts the backend project:**
- Issue: `pyproject.toml` declares `requires-python = ">=3.14"`, `[project.scripts] finally = "finally:main"` (no `finally` module exists), and a `uv_build` backend. `.python-version` at the root says `3.14`. The real app lives in `backend/pyproject.toml` (Python 3.12) and the `Dockerfile` uses `python:3.12-slim`.
- Files: `pyproject.toml`, `.python-version`, `backend/pyproject.toml`, `backend/.python-version`.
- Impact: confusing `uv` behavior at the root, and a root `.venv` (Python 3.14 layout) and `backend/.venv` (3.12) coexist. A warning appeared during `uv run pytest` about `VIRTUAL_ENV` not matching the project environment path.
- Fix approach: delete the root `pyproject.toml` (or reduce it to a placeholder) and the root `.python-version`, and remove the stray venv.

**Unpinned container base images and tooling:**
- Issue: `Dockerfile` uses `node:22-slim`, `python:3.12-slim`, and `ghcr.io/astral-sh/uv:latest` with no digest or version pin. Dependency ranges in `backend/pyproject.toml` (`fastapi>=0.143.2`, `litellm>=1.105.1`, `massive>=2.8.0`) are lower bounds only; reproducibility depends on `backend/uv.lock`, which the Dockerfile does honor via `--frozen`.
- Fix approach: pin `uv` to a version tag and consider pinning base image digests.

**Container runs as root:**
- Issue: `Dockerfile` has no `USER` directive, so the app and the SQLite volume run as root.
- Fix approach: create an unprivileged user and `chown` `/app/db`.

## Security Considerations

**No authentication on a network-exposed service:**
- Risk: `Dockerfile` line 26 runs uvicorn on `0.0.0.0:8000`, and `scripts/start_mac.sh` publishes `-p 8000:8000`. Anyone on the local network can read the portfolio, place trades, change the watchlist, and call `POST /api/chat`, which spends the operator's OpenRouter credit.
- Files: `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/chat/router.py`, `scripts/start_mac.sh`.
- Current mitigation: none. The spec (PLAN.md section 2) explicitly calls for no login. This is acceptable for localhost but not for a LAN or cloud deployment.
- Recommendations: bind to `127.0.0.1` in the start scripts for local use, add a per-request rate limit on `POST /api/chat`, and require an auth token before any cloud deployment (the `deploy/` stretch goal).

**Raw upstream error text returned to clients:**
- Risk: `backend/app/chat/llm.py` line 38 wraps any exception as `LLMError(f"LLM request failed: {exc}")`, and `backend/app/chat/router.py` line 29 returns `str(exc)` in the 502 body. LiteLLM and OpenRouter errors can include request metadata or provider detail.
- Current mitigation: none beyond the wrapper string.
- Recommendations: log the full exception server-side and return a fixed message such as `"LLM request failed"`.

**LLM output drives trades without caps:**
- Risk: `backend/app/chat/service.py` lines 55-56 execute every entry in `reply.watchlist_changes` and `reply.trades`. There is no limit on count per turn, no per-trade notional cap, and no confirmation. Prompt injection through pasted text in chat, or a model hallucination, can trade up to the full cash balance and add many watchlist tickers in one turn. The mitigation is that the money is simulated.
- Recommendations: cap trades and watchlist changes per turn (for example 5 each) in `ChatReply` schema validation or in `handle_chat_message`, and surface the cap in the response.

**API key handling is correct but unverified in the image:**
- `.dockerignore` excludes `.env`, and `.gitignore` excludes `.env`. `.env` is passed via `--env-file` at runtime only. No key was found in tracked files. The `.env` file itself was not read during this analysis, per the forbidden-files rule.

## Correctness and Bugs

**Watchlist add race (check-then-insert across an `await`):**
- Symptoms: two concurrent `POST /api/watchlist` calls for the same new ticker can both pass the `is_watched` check, both await the market source, and then the second `INSERT` raises `sqlite3.IntegrityError` on the `UNIQUE (user_id, ticker)` constraint, which is not mapped and returns HTTP 500.
- Files: `backend/app/services/watchlist.py` lines 24-28 (`is_watched`, then `await source.add_ticker`, then `insert_watchlist_row`); `backend/app/db/schema.sql` line 12.
- Trigger: concurrent adds of an identical ticker, or a chat turn adding a ticker the user also adds manually. Not reproduced; identified by reading the code.
- Workaround: none. The fix is to catch `IntegrityError` in `add_to_watchlist` and treat it as already watched, or use `INSERT ... ON CONFLICT DO NOTHING`.

**Chat turns are not atomic:**
- Symptoms: each trade commits independently. `backend/app/services/portfolio.py` line 28 (`with conn:`) commits on exit, so a trade succeeds and persists even if a later action in the same turn raises. `apply_trade` and `apply_watchlist_change` only catch `ValidationError`, `NotFoundError`, and `MarketDataError` (`backend/app/chat/service.py` line 14). Any other exception (for example a SQLite error on a later trade) propagates to a 500, leaving earlier trades executed while no chat row is stored. The next turn's history then does not show those trades.
- Files: `backend/app/chat/service.py` lines 55-59; `backend/app/services/portfolio.py` lines 28-33.
- Fix approach: run the whole turn inside one transaction (no nested commits), or record the chat row before executing actions.

**Unhandled exceptions in the LLM path produce 500s, not 502s:**
- Symptoms: `backend/app/chat/llm.py` line 39 (`return parse_reply(response.choices[0].message.content)`) sits outside the `try` on lines 28-38. An empty `choices` list raises `IndexError`, which is not mapped and returns HTTP 500 instead of the spec's 502.
- Files: `backend/app/chat/llm.py` lines 28-39.
- Fix approach: move the response extraction into the `try`, or guard `response.choices`.

**Massive free-tier mode silently freezes prices:**
- Symptoms: after the first `NOT_AUTHORIZED` response, `MassiveDataSource` switches to end-of-day closes (`backend/app/market/massive_source.py` lines 107-117, 133-140). Prices then update only every 30 minutes at most and are previous-day closes. `change` and `change_percent` become zero between refreshes, and the UI shows no mode indicator. The only signal is `mode: "end_of_day"` in `GET /api/health`.
- Files: `backend/app/market/massive_source.py`; `backend/app/routes/health.py`.
- Impact: the user sees "live" prices that do not move on the free plan. This is by design in the source but not surfaced to the user.

**Inconsistent price source at add time (Massive):**
- Issue: `_lookup_price` uses `get_previous_close_agg` (`backend/app/market/massive_source.py` line 147). The poll uses the snapshot endpoint (`_fetch_snapshot_prices`, lines 119-122). A newly added ticker's first price is the previous close, and the first poll then replaces it with a current price, so the first `change` after add can be a large artificial jump.
- Fix approach: seed from the same snapshot path used by polling.

**Session open resets on remove and re-add:**
- Issue: `PriceCache.remove` drops the entry (`backend/app/market/cache.py` lines 43-45), so a ticker removed and re-added gets a new `open_price`. The spec defines open as "first price seen since backend start," so re-adding should not reset it.
- Impact: daily change % baseline changes unexpectedly after watchlist edits.

**Silent zero-fallback in position valuation:**
- Issue: `position_summary` falls back to `avg_cost` when no cached price exists (`backend/app/services/portfolio.py` line 76). A market-data outage therefore shows zero unrealized P&L with no warning. The `execute_trade` path enforces prices exist, but valuation does not.
- Fix approach: return `current_price: null` and exclude that position from totals, or flag it.

**Massive zero or missing prices drop silently:**
- Issue: `_fetch_snapshot_prices` drops tickers whose price is falsy (`backend/app/market/massive_source.py` line 122). Those tickers keep their last cached price with no log entry.

**Mock keyword matching is substring-based:**
- Issue: `backend/app/chat/mock.py` lines 9, 15, 21 test `"buy"`, `"sell"`, `"add"` as substrings, so "address" triggers an add of PYPL and "padding" triggers the add branch. Acceptable for deterministic E2E tests (spec section 9), but it can break a test that types ordinary words.

## Performance Bottlenecks

**Portfolio history returns an unbounded series:**
- Problem: `GET /api/portfolio/history` returns every snapshot within the 7-day retention window (`backend/app/routes/portfolio.py` lines 45-49; `backend/app/db/repository.py` lines 121-126). At one snapshot per 30 s plus one per trade, that is roughly 20,000 rows per response.
- Improvement path: downsample on the server (for example one point per 5 minutes) or add a `since` parameter.

**Missing indexes on hot queries:**
- Problem: `portfolio_snapshots` is filtered by `(user_id, recorded_at)` on every insert (retention `DELETE`, `backend/app/db/repository.py` lines 116-118) and `list_snapshots` sorts by `recorded_at`. `chat_messages` is sorted by `created_at` per user (`repository.py` line 143). `db/schema.sql` declares no secondary indexes.
- Improvement path: `CREATE INDEX IF NOT EXISTS idx_snapshots_user_time ON portfolio_snapshots(user_id, recorded_at)` and the same for `chat_messages(user_id, created_at)`.

**Chat history grows without bound:**
- Problem: `chat_messages` is never pruned. Only the last 20 rows are read per turn (`backend/app/chat/service.py` line 13), so the table grows indefinitely with no user-visible effect.

**Blocking SQLite I/O on the event loop:**
- Problem: `record_snapshots_forever` (`backend/app/main.py` lines 37-38) and the `async def trade` route (`backend/app/routes/portfolio.py` lines 33-42) run synchronous `sqlite3` calls on the asyncio loop. The chat route holds an open connection across the network LLM call (`backend/app/chat/router.py` lines 23-27).
- Impact: small with 10 tickers and a local file DB, but any slow disk or lock wait stalls SSE streaming for all clients.
- Improvement path: use `def` routes (FastAPI threadpool) or `asyncio.to_thread` for DB work, and open the connection only after the LLM reply returns.

**SSE sends the full price map on every tick:**
- Problem: `backend/app/market/stream.py` lines 22-25 serializes all cached tickers whenever `cache.version` changes. With the simulator, `version` changes every 0.5 s, so each connected client receives the full payload twice per second. Each client also copies the cache dict every tick (`cache.all()`).
- Impact: linear in tickers and clients. Acceptable for one user.

**No cap on tracked tickers:**
- Problem: any string matching `^[A-Z]{1,5}$` is accepted by the simulator (`backend/app/market/simulator.py` lines 41-47, `_random_profile`). Each added ticker enlarges the GBM step, the SSE payload, and the watchlist. Chat can add an unbounded number per turn.
- Fix approach: cap watchlist size (for example 50) in `add_to_watchlist`.

## Scaling Limits

**Single process, single worker, SQLite:**
- Current capacity: one uvicorn worker (`Dockerfile` line 26, `--workers 1`), one SQLite file in WAL mode, default 5 s busy timeout.
- Limit: correctness depends on the single process. `execute_trade` (`backend/app/services/portfolio.py` lines 12-33) reads cash and position, then writes, without holding a write lock across the reads. It is safe only because the sync body has no `await` between read and write on one event loop. Adding a second worker or moving any write off the loop would corrupt cash and positions.
- Scaling path: keep single-worker, or move to `BEGIN IMMEDIATE` transactions around every trade before scaling out.

**In-memory cache and snapshots reset on restart:**
- Current capacity: `PriceCache` (`backend/app/market/cache.py`) lives only in process memory. On restart, prices reseed from `KNOWN_TICKERS` (`backend/app/market/seed_prices.py`) and session open prices reset. Snapshots resume at the next 30 s tick.
- Limit: the P&L chart has gaps across restarts and the simulator prices jump back to seed values.

## Fragile Areas

**Schema evolution has no migration path:**
- Files: `backend/app/db/schema.sql` (all `CREATE TABLE IF NOT EXISTS`), `backend/app/db/connection.py` lines 52-56.
- Why fragile: `init_db` runs `executescript(schema)` only. Any column or constraint change will not apply to an existing `finally-data` volume, and seeding runs only when `users_profile` is empty (`_seed_defaults`, lines 59-71).
- Safe modification: add a `schema_version` table and numbered migration scripts before changing any table.

**Path assumptions across environments:**
- Files: `backend/app/db/connection.py` line 15 (`REPO_ROOT = parents[3]`), `backend/app/main.py` lines 23-27 (`.env` at `BACKEND_DIR.parent`, `STATIC_DIR` default), `.dockerignore` line 13 (`backend/static`).
- Why fragile: these depend on the source layout. In the container, `load_dotenv` resolves to `/.env` (absent), and configuration comes from `--env-file` instead.
- Safe modification: keep environment variables as the only configuration channel (`FINALLY_DB_PATH`, `STATIC_DIR`).

**Dual repository and test contracts drift:**
- Files: `planning/TEAM.md` and `planning/PLAN.md` describe a frontend that is no longer present; `README.md` documents `cd frontend && npm test`.
- Why fragile: contributors follow docs that point at missing paths.

## Test Coverage Gaps

**Backend suite passes but does not cover concurrency or partial failure:**
- What's tested: 103 tests pass across `backend/tests/chat`, `db`, `market`, `routes`, and `services`.
- Not verified: no test was found in the file list for concurrent watchlist adds, chat turns that fail midway, or the `IndexError` path in `chat/llm.py`. Coverage was not measured.
- Risk: the races and atomicity gaps above can ship unnoticed.
- Priority: High for the watchlist race and chat atomicity.

**Frontend and E2E coverage is unrunnable:**
- What's not tested: every UI behavior in `test/tests/` (`fresh-start`, `watchlist`, `trading`, `chat`, `portfolio-charts`, `sse-reconnect`) depends on a frontend that does not exist.
- Risk: the spec's E2E scenarios cannot be verified.
- Priority: High, blocked on the missing frontend.

## Dependencies at Risk

**`litellm` as a large transitive surface:**
- Risk: `backend/pyproject.toml` depends on `litellm>=1.105.1`, a broad package that pulls many transitive dependencies. `chat/llm.py` uses only `acompletion`.
- Impact: upgrade and supply-chain exposure for a single function call.
- Migration plan: call the OpenRouter HTTP API directly with `httpx` (already a dev dependency) if LiteLLM features are not needed.

**Test warning from Starlette:**
- Risk: pytest emits `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead` (`backend/.venv/.../fastapi/testclient.py`). Expect breakage when the transitive pin changes.
- Migration plan: follow the warning when upgrading FastAPI or Starlette.

**`massive` client is synchronous:**
- Risk: `backend/app/market/massive_source.py` wraps every call in `asyncio.to_thread`. Correct but adds thread contention on each poll.

## Missing Critical Features

**No frontend (see above).**

**No realized P&L (by design):**
- Problem: PLAN.md section 7 excludes realized P&L in v1. `trades` retains the data needed later.

**No order or trade confirmation UI path in the backend:**
- Problem: auto-executed chat trades are shown only via the `actions` array in the response. Without the frontend, no inline confirmation exists anywhere.

## Working Tree and Repository Hygiene

- `planning/ISSUES.md` contains an empty table and only a resolved "Details" note. No open items.
- Gitignored caches exist on disk (`backend/.pytest_cache/`, `backend/**/__pycache__/`, `test/playwright-report/`, `test/test-results/`). They are not tracked, so no action is needed beyond local cleanup.
- Two virtualenvs (`/.venv` and `backend/.venv`) exist on disk. Only `backend/.venv` is used by the project.
- No `TODO`, `FIXME`, `HACK`, or `XXX` markers were found in `backend/app/`, `test/tests/`, or `planning/*.md`.

---

*Concerns audit: 2026-10-16*
