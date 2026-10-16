# Pitfalls Research

**Domain:** Live AI trading workstation UI (Next.js static export + Recharts + SSE) added to an existing FastAPI backend, shipped as one Docker container, verified by an existing Playwright suite
**Researched:** 2026-10-16
**Confidence:** MEDIUM-HIGH. Project-specific pitfalls (E2E contract, backend concerns) are HIGH: derived by reading `test/tests/*.spec.ts`, `test/docker-compose.test.yml`, `Dockerfile`, `backend/app/**`, `CONCERNS.md`. Library-behaviour pitfalls (Recharts 3, Next 16, Tailwind 4, jsdom) are MEDIUM: web search returned no authoritative Treemap/animation guidance, so those rest on documented API behaviour and common practice and should be verified with a quick spike.

Phase names used below are suggested roadmap slices: **Backend hardening**, **Frontend scaffold + Docker**, **Live data UI** (SSE, header, watchlist, sparklines, main chart), **Portfolio + trading UI** (trade bar, positions, heatmap, P&L), **Chat UI**, **E2E integration**.

---

## Critical Pitfalls

### Pitfall 1: Building the UI without the E2E selector/format contract in hand

**What goes wrong:**
The Playwright suite is the definition of done, and it encodes far more than `data-testid` names. A UI that "looks right" fails the suite on formatting and structure. Concrete traps found in the specs:

- `readNumber()` strips everything except `[0-9.-]` and parses the rest. So the element carrying `watchlist-price-AAPL`, `cash-balance`, `total-value` must contain ONLY that number. A label ("Cash: $10,000.00"), a delta ("$190.12 +0.4%"), a unit ("10K"), or a unicode minus corrupts the parsed value (digits of the delta get concatenated). Abbreviated formatting ("$10.0K") breaks `toBe(10000)`.
- `fresh-start` asserts `watchlist.locator('[data-testid^="watchlist-row-"]')` has count 10. Any nested element whose testid starts with `watchlist-row-` (for example `watchlist-row-AAPL-sparkline`) inflates the count. Name sub-elements `watchlist-spark-AAPL`, `watchlist-price-AAPL`, etc.
- `watchlist-row-{T}`, `position-row-{T}`, `watchlist-remove-{T}` need the ticker uppercase and exact. `main-chart` needs `data-ticker`, `connection-status` needs `data-status` in `connected | reconnecting | disconnected`, `chat-message` needs `data-role`, `chat-action` needs `data-status` in `ok | failed`.
- `trade-ticker` must be pre-filled with the selected ticker (`toHaveValue("NVDA")` after a row click).
- `chat-loading` must be ABSENT (count 0), not merely hidden, once the reply lands.
- `trade-error` must be visible after a rejected trade and must be fed from the backend's `{"error": ...}` body (400s here are not FastAPI's default `detail`).

**Why it happens:**
The full testid table lives in `planning/TEAM.md` section 5 (the test README points there), and the previous frontend that satisfied it was deleted. A fresh build from PLAN.md section 10 alone never sees these constraints.

**How to avoid:**
Make the contract a first-class input before any component is written: copy the TEAM.md section 5 table plus the format rules above into the frontend phase's UI-SPEC/CONTEXT. Put every testid in one constants module (`testIds.ts`) so components and Vitest tests share it. Add a Vitest smoke test per testid-bearing component that runs `parseNumber` semantics on rendered text.

**Warning signs:**
First E2E run fails on `readNumber` returning `NaN`/wrong values while the UI visibly looks correct; row count off by a few.

**Phase to address:** Frontend scaffold + Docker (define contract), then every UI phase (enforce).

---

### Pitfall 2: Deriving watchlist rows (or truth) from the SSE payload, and replacing instead of merging

**What goes wrong:**
The SSE map contains the UNION of watchlist tickers and held positions (PLAN section 6), so keying rows off SSE shows unwatched held tickers as watchlist rows and survives a "remove". Separately, the `sse-reconnect` spec injects a fake first event containing ONLY `AAPL` (price 1.0, timestamp 0). A client that replaces its whole price map with each event drops every other ticker's price, and a client that ignores events with an "older" timestamp (timestamp 0) never shows price 1 and never recovers cleanly.

**Why it happens:**
It is the shortest code path: one stream, render what arrives.

**How to avoid:**
Rows come from `GET /api/watchlist` (and refetch after add/remove/chat); prices come from SSE and are MERGED per ticker into a store (`prices[ticker] = update`). Never filter by timestamp or version; last write wins. Rows with no price yet render a placeholder (`--`), not `0`.

**Warning signs:**
Watchlist shows a row after the user removed it while still holding it; other rows blank after the reconnect test's first event; fresh-start row count flaky after any trade.

**Phase to address:** Live data UI.

---

### Pitfall 3: SSE connection-status logic that fights EventSource's built-in reconnect

**What goes wrong:**
`sse-reconnect.spec.ts` requires: first connection delivers one event then closes (`retry: 500`) -> status `reconnecting`; reconnect attempts are aborted with `connectionrefused` -> status stays `reconnecting` (not flipped to `disconnected`); then the route passes through -> `connected` and real prices (>100) replace the fake `1.0`. Typical failures:

- Mapping every `onerror` to `disconnected`. With native EventSource, an error while `readyState === CONNECTING` means the browser is retrying; only `CLOSED` is terminal. Map: `onopen` -> connected, `onerror` + `CONNECTING` -> reconnecting, `onerror` + `CLOSED` -> disconnected (and then schedule a manual new `EventSource`).
- Setting `connected` on the first message instead of `onopen` (or the reverse, with a watchdog timer that declares `disconnected` after a few quiet seconds; the simulator also pauses sends when the cache version is unchanged, only a 15 s keepalive comment, which EventSource does not surface).
- Adding a cache-busting query string or an absolute `http://localhost:8000` URL. The test intercepts the glob `**/api/stream/prices`; a `?t=123` suffix does not match and the test silently talks to the real stream, then "fails" waiting for price 1.
- Not closing the EventSource on unmount. In dev, React StrictMode double-mounts effects and opens two connections; production export does not, so the bug hides until dev tuning.

**Why it happens:**
Developers write reconnect logic by hand because the three-colour status dot looks like it needs custom state.

**How to avoid:**
Use native EventSource at the relative URL `/api/stream/prices` with no params; derive status purely from `onopen`/`onerror`/`readyState`. Single module-level connection manager (store), not a per-component hook, with `close()` in cleanup. Unit test the status mapping with a stubbed EventSource class (jsdom has none).

**Warning signs:**
Dot flickers red during the test, or the test's `serverMode = "up"` step never reaches `connected`.

**Phase to address:** Live data UI (build), E2E integration (verify).

---

### Pitfall 4: Whole-tree re-render at 2 Hz and unbounded sparkline buffers

**What goes wrong:**
The simulator bumps the cache every ~500 ms and the backend sends the full 10+ ticker map each time. Putting prices in one `useState`/Context re-renders the header, watchlist, Treemap, P&L chart, positions table and chat panel twice a second; Recharts SVG re-layout makes the UI janky and the CSS flash animations stutter. Separately, sparkline history appended on every tick is 7,200 points/hour/ticker; never trimmed, memory and render cost grow all session (and keep growing in background tabs).

**Why it happens:**
Naive "state at the top, props down" pattern; sparklines are "just an array".

**How to avoid:**
- Store prices outside React (module store + `useSyncExternalStore`) with per-ticker selectors so a row re-renders only when its ticker changes. Memoize rows (`React.memo`).
- Ring-buffer histories (for example last 300 points for sparklines; main chart reads the same buffer). Start buffers for ALL watched tickers at page load, not on selection, so clicking a ticker shows its history since load.
- Recompute portfolio-derived views (treemap, positions, header total) from the store at a throttled ~1 s cadence, not per tick.
- Sparkline: `isAnimationActive={false}`, `dot={false}`, no axes, no tooltip.

**Warning signs:**
React Profiler shows commits on every tick for components unrelated to prices; CPU > 20 percent idle; tab memory climbing.

**Phase to address:** Live data UI (store design is hard to retrofit); Portfolio + trading UI (throttling).

---

### Pitfall 5: Recharts specifics: animation restarts, zero-size containers, Treemap quirks

**What goes wrong:** (MEDIUM confidence; verify with a spike)

- Recharts animates on every data change by default. With data arriving twice a second, lines "redraw" constantly and the Treemap rectangles tween permanently. Set `isAnimationActive={false}` on every Line/Area/Treemap.
- `ResponsiveContainer` inside a flex/grid cell without a concrete height renders at 0x0 (console warning "width(0) and height(0)") and the chart is empty; same inside a collapsed or `display:none` chat/side panel. Give chart wrappers an explicit height (`h-full min-h-0` on every flex ancestor, or fixed px) and render charts only when visible.
- Treemap with empty data, or with zero/NaN `size` (a position with no cached price, or market value 0), can throw or draw degenerate rects. Render an explicit empty state when there are no positions; filter non-positive sizes.
- The E2E spec needs `heatmap.locator("svg rect").first()` visible and the text "JPM" in the heatmap. A custom Treemap `content` that renders a zero-size root rect FIRST (depth 0) makes `.first()` hidden; a label renderer that skips text when a cell is "too small" drops "JPM". Skip the depth-0 rect, and always emit the label (clip it with `clipPath`/`overflow` instead of omitting it).
- P&L chart spec needs `svg path.recharts-curve`: use a `Line` or `Area` with a real path. With a single snapshot a path may not draw; the spec relies on a trade having created at least one snapshot, so seed/refetch history after load and after each trade.
- Tutorials and LLM-recalled snippets are often Recharts 2 (activeIndex, `Customized`, old ref patterns). The old frontend pinned `recharts ^3.10.1`; consult v3 docs, not memory.
- Flat sparkline data (all equal values) with `domain=['dataMin','dataMax']` yields a zero-height domain and a collapsed line; use `['auto','auto']` with padding.

**How to avoid:** Build a shared `chartDefaults` (animation off, margins, explicit heights). Spike Treemap with custom content and live P&L colours first; add a Vitest test that sets explicit `width`/`height` on charts (ResponsiveContainer measures 0 in jsdom, see Pitfall 13).

**Warning signs:** Empty chart boxes with console warnings; E2E `heatmap` visible but `svg rect` check fails.

**Phase to address:** Portfolio + trading UI.

---

### Pitfall 6: Stale UI after trades and chat actions (no single refresh path)

**What goes wrong:**
Trades come from three places (trade bar, chat auto-execution, API in tests). The chat E2E expects `position-row-AAPL` to appear after the AI buys. If the chat panel only appends the reply, positions/cash/watchlist stay stale until reload. Likewise the header `total-value` fed only by REST is stale between fetches, but a client-only recompute can drift from backend rounding.

**Why it happens:**
Each panel fetches its own data; nothing invalidates them.

**How to avoid:**
One `refreshPortfolio()`/`refreshWatchlist()` entry point called after: manual trade success, any chat response containing actions (watchlist OR trade, including failed ones is harmless), watchlist add/remove. Use the `portfolio` returned by `POST /api/portfolio/trade` directly. Between refreshes, compute market value as `quantity * live price` from the store, reconciled to the server value on each refetch. Use the server's `cash_balance` as-is (never recompute cash client-side). The trade E2E asserts cash from the UI moves in the right direction and `heldQuantity === 2` on the server, so a double submit (Enter plus click, double click) must be prevented: disable the buttons while a request is in flight.

**Warning signs:**
Chat says "bought 1 AAPL" but the positions table is empty until refresh.

**Phase to address:** Portfolio + trading UI, Chat UI.

---

### Pitfall 7: Static-export build and container mismatches

**What goes wrong:**

- `output: 'export'` is incompatible with `rewrites`/server features. The previous config handled this by setting `output: 'export'` only outside dev and adding a dev-only `/api` rewrite. Keep that split, or the production build errors out (or silently ignores the rewrite).
- `next dev` proxying `/api/stream/prices` through Next's rewrite can buffer/compress SSE (the old config set `compress: false` for this) and Next's rewrite proxy has a timeout (reported ~30 s by default; MEDIUM confidence), so SSE appears to "randomly disconnect" in dev only. Develop against the built export served by uvicorn (`STATIC_DIR=frontend/out`), or confirm the proxy behaviour in a spike.
- Any `window`, `localStorage`, `EventSource`, or `toLocaleString`-dependent output during prerender breaks `next build` or causes hydration mismatches (Node ICU vs browser formatting). Keep all live data behind `"use client"` + `useEffect`/`useSyncExternalStore` with a server snapshot, and format with a fixed locale (`en-US`) and fixed fraction digits.
- Docker `npm ci` fails if the lockfile is out of sync, or if a lockfile generated on macOS lacks the linux native optional packages (swc, lightningcss, Tailwind oxide, rollup). Generate/verify the lockfile with `npm ci` in the `node:22-slim` image, on the architectures you intend to build (arm64 Mac and amd64 CI).
- `.dockerignore` already excludes `frontend/node_modules`, `.next`, `out` (good: host macOS binaries would otherwise overwrite the container's modules via `COPY frontend/ ./`). Do not remove those lines.
- Vitest/jest-dom type declarations and test files inside the Next project are type-checked by `next build`; a missing `types` entry or a test-only global breaks the production build. Exclude test files in `tsconfig.json` or keep Vitest types explicit.
- Next 16 and Tailwind 4: Tailwind v4 is CSS-first (`@import "tailwindcss"` + `@theme { --color-accent: #ecad0a; ... }`). A v3-style `tailwind.config.js` is silently ignored, so custom colours "don't work". Use the officially documented PostCSS/Next integration rather than reproducing the old config's turbopack loader rule unless verified.
- Starlette `StaticFiles(html=True)` serves `index.html` for `/` and directory paths; the app is a single page so this is enough, but a typo in an `/api/...` path falls through to the static mount and returns the static 404, not the JSON error shape. Not worth fixing; do not add client routes (`/portfolio`) that would 404 on refresh.

**How to avoid:** First frontend milestone is a "walking skeleton": a trivial page that builds in Docker, is served at `:8000`, and passes a health E2E (page loads, connection dot exists). Prove `docker build` before any feature work.

**Warning signs:** `docker build` fails at stage 1; `/` returns 404 JSON (static dir missing); hydration warnings in the console.

**Phase to address:** Frontend scaffold + Docker.

---

### Pitfall 8: Backend "atomic chat turn" fix that creates a worse bug (write-lock held across the LLM call)

**What goes wrong:**
CONCERNS flags non-atomic chat turns. The tempting fix, wrapping the whole turn in one transaction, has traps:

- If `BEGIN` happens before `await generate_reply(...)`, the SQLite write lock is held for the full LLM latency (seconds). The 30 s snapshot task and manual trades then hit `database is locked` after the 5 s busy timeout, producing 500s. Open the transaction only AFTER the LLM returns.
- `execute_trade` uses `with conn:`, which COMMITS on exit. Nesting it inside an outer transaction does not give atomicity; the inner commit ends it. Either remove inner commits (callers own the transaction) or use SAVEPOINTs.
- The product rule is partial success: a trade failing VALIDATION must not roll back sibling trades (it becomes a `failed` action, per PLAN section 9). Atomicity here only means "unexpected exceptions do not leave executed trades without a stored chat row". Do not roll back validation failures.
- Note the current ordering stores the user and assistant rows only at the very end, after all actions; the smallest fix that meets the goal is to insert the chat rows in the same transaction as the actions (after the LLM call), with per-action SAVEPOINTs. Keep it simple: no retry framework, no generic wrapper.

**How to avoid:** Write the failing test first (inject a fake source/trade that raises `sqlite3.OperationalError` on the second action and assert both the trade state and chat row are consistent). Prove current behaviour before changing it.

**Warning signs:** Intermittent `database is locked` in logs when chatting; chat history missing turns that executed trades.

**Phase to address:** Backend hardening.

---

### Pitfall 9: Race fixes that cannot be reproduced or leave side effects behind

**What goes wrong:**
The watchlist add race (check `is_watched` -> `await source.add_ticker` -> insert -> `IntegrityError` -> 500) is hard to reproduce through a synchronous `TestClient`; a fix without a failing test is a guess. Also catching `IntegrityError` alone leaves the second request having already called `source.add_ticker` (idempotent, fine) but a concurrent REMOVE during the await can leave the source tracking a ticker that is no longer in the DB.

**How to avoid:**
Reproduce first with `asyncio.gather` of two `add_to_watchlist` calls against a fake `MarketDataSource` whose `add_ticker` does `await asyncio.sleep(0)`; observe the 500/IntegrityError; then fix with `INSERT ... ON CONFLICT DO NOTHING` (no exception handling needed) and return the same success shape. Add a test for add-while-remove ordering (DB is source of truth; re-sync source after insert). Also cap watchlist size (50) in the same change since chat can add unbounded tickers.

**Phase to address:** Backend hardening.

---

### Pitfall 10: LLM 502 path: incomplete mapping and over-sanitising

**What goes wrong:**

- `response.choices[0].message.content` sits outside the `try`. Besides `IndexError` on empty `choices`, there is `AttributeError` when `message` is None and the reasoning-only case: gpt-oss can return reasoning with `content` null; `parse_reply` handles `None` but nothing handles a missing `choices`/`message`. Hidden cases: finish_reason `length` (truncated JSON -> pydantic error, already mapped), refusal text, non-JSON prose.
- Sanitising by replacing every message with "LLM request failed" also hides the actionable local-config case ("OPENROUTER_API_KEY is not set"), which is safe to show and which PLAN section 9 says must be an inline error. Keep fixed, safe messages per category (missing key, upstream failure, malformed output) and log the full exception server-side with `logger.exception`.
- A `try/except Exception` that wraps parse AND action execution would convert real bugs to 502 and mask them. Keep the `try` around only the extraction and parse.
- No timeout on `acompletion`: a hung upstream holds the request and the DB connection indefinitely. Pass a request timeout so the failure surfaces as a 502 instead of a spinner forever.
- Existing chat tests monkeypatch around this path; update them when moving code, and add cases: `choices=[]`, `message=None`, `content=""`, non-JSON, JSON with wrong shape.

**Phase to address:** Backend hardening.

---

### Pitfall 11: Capping chat actions in the schema throws away the whole reply

**What goes wrong:**
Putting `max_length` on `ChatReply.trades`/`watchlist_changes` makes pydantic reject a model reply with 6 trades, so the user gets a 502 and zero execution. It also changes the JSON schema sent as `response_format`; strict-mode structured outputs on some providers reject unsupported keywords such as `maxItems` (LOW confidence for Cerebras specifics; check before relying on it).

**How to avoid:**
Enforce the cap in `handle_chat_message`: execute the first N (5) of each, append `failed` actions ("skipped: per-turn limit of 5") for the rest so the user and the next-turn history both see it. Keep the schema untouched.

**Phase to address:** Backend hardening.

---

### Pitfall 12: E2E harness state assumptions

**What goes wrong:**

- `fresh-start` requires a pristine DB (total value exactly 10000, 10 rows). The `features` project depends on it, and DB state persists across tests in one run (tmpfs only resets between compose runs). Re-running `npx playwright test` against a live container fails `fresh-start` for non-bug reasons. Always use `npm run test:docker` (it ends with `down -v`) for the gate; for local reruns restart the container.
- Tests are order-dependent through shared state (chat buys 1 AAPL, charts buy JPM, trading mutates MSFT/NVDA/AMZN). Project order is chat, portfolio-charts, sse-reconnect, trading, watchlist. Leftover positions affect heatmap sizes (see label rule in Pitfall 5).
- `LLM_MOCK` substring matching: any test or UI string containing "buy", "sell", or "add" inside another word ("address", "padding", "seller") triggers a mock action. Do not add helper text sent as chat messages (for example example-prompt chips containing those substrings).
- First run is slow: compose builds the Node and Python stages, then `npm ci` runs in the Playwright container; health retries allow ~60 s. A cold CI build may exceed it: raise `retries`, not test timeouts.
- Host port 8010 vs in-network `http://finally:8000`: do not hardcode origins in the frontend. All fetches must be relative (`/api/...`).
- The service must not be named `app` (HSTS preload, already fixed). Keep that comment.
- Bind-mounted `.:/e2e` makes `npm ci` and reports write root-owned files into the repo (`playwright-report/`, `test-results/`, `node_modules` volume shadowing). They are gitignored; just do not commit them.
- The Playwright image tag (`v1.64.1-noble`) must equal the `@playwright/test` pin (1.64.1). Bumping one without the other produces browser-not-found errors.

**Phase to address:** E2E integration.

---

## Moderate Pitfalls

### Pitfall 13: jsdom gaps break Vitest + RTL tests

**What goes wrong:** jsdom has no `EventSource`, `ResizeObserver` (Recharts `ResponsiveContainer` needs it and otherwise renders nothing at 0x0), or `Element.scrollIntoView` (chat auto-scroll throws `TypeError`). CSS animations/transitions do not run, so "flash" tests that wait for visual change hang.
**Prevention:** A single `vitest.setup.ts` that stubs `EventSource` (controllable test double), `ResizeObserver`, and `scrollIntoView`. Test the flash by asserting the class/`data-direction` attribute and using fake timers, not visual change. Give charts explicit `width`/`height` props in tests.
**Phase:** Frontend scaffold + Docker (setup), all UI phases (use).

### Pitfall 14: Price flash animation that fires once or never

**What goes wrong:** Re-adding a CSS class that is already present does not restart the animation, so only the first tick flashes. Comparing formatted strings (rounded to 2 dp) flashes on non-changes or misses real ones; flashing on `direction: "flat"` or on the first value or after reconnect (the `1.0` placeholder to a real price) looks broken. Per-tick `setTimeout` class removal leaks timers (about 20 per second across 10 rows).
**Prevention:** Compare raw numeric price to previous raw price; key the price `<span>` on a tick counter (or use `animation` with `key` remount) so the keyframe restarts with no timers; skip flat/initial; wrap in `prefers-reduced-motion`. Keep the animation on an inner element if the testid element must stay stable. Daily-change colour (vs open) and flash colour (vs previous tick) are separate concerns.
**Phase:** Live data UI.

### Pitfall 15: Wrong baseline for daily change and misread timestamps

**What goes wrong:** The SSE `change_percent` is vs the PREVIOUS TICK. Using it for the watchlist "daily change %" column shows noise around zero. The spec: compute `(price - open_price) / open_price`. `timestamp` is Unix SECONDS (float); `new Date(timestamp)` yields 1970. Backend baselines also move: `PriceCache.remove` drops the open price so a removed and re-added ticker gets a new open (CONCERNS).
**Prevention:** One `dailyChangePercent(update)` helper with unit tests; multiply timestamps by 1000; decide whether to fix the re-add open reset in Backend hardening (cheap: keep the open in the cache after remove) or accept it.
**Phase:** Live data UI, Backend hardening.

### Pitfall 16: Error body shape and chat failure UX

**What goes wrong:** Frontend code reads `detail` (FastAPI default) instead of `error`; unhandled non-JSON responses (static 404 HTML) crash `res.json()`. On 502, the user's typed message is cleared though nothing was stored, forcing retype. Double submit while loading creates duplicate turns. LLM markdown/HTML rendered with `dangerouslySetInnerHTML` is an injection vector (prompt injection from pasted text).
**Prevention:** One `api.ts` wrapper: returns `{ok, data}` or throws `ApiError(error)`; handles non-JSON; used by every panel. Render LLM text as plain text. Keep input on failure, disable send while loading, show `chat-error` inline (spec: no retry).
**Phase:** Chat UI, Portfolio + trading UI.

### Pitfall 17: No chat history endpoint

**What goes wrong:** The API has only `POST /api/chat`; `chat_messages` are stored but cannot be read back, so after a page reload the panel is empty while the LLM still sees the last 20 messages. The chat spec counts messages before and after, so it tolerates either, but users will perceive lost history.
**Prevention:** Decide explicitly in the Chat UI phase: accept session-only history (spec as written, simplest) or add `GET /api/chat/history`. Do not discover it mid-build.
**Phase:** Chat UI (decision), Backend hardening if added.

### Pitfall 18: P&L chart payload and time axis

**What goes wrong:** `/api/portfolio/history` returns the full 7-day window, potentially ~20,000 rows; rendering them as SVG points is slow. A category axis with irregular spacing (30 s snapshots plus trade bursts) distorts time. The chart is static unless refetched, so it never shows the live value. Missing index on `(user_id, recorded_at)` makes each insert's prune query scan the table.
**Prevention:** Downsample (backend `since`/bucket param, or client bucketing to ~300 points); numeric/time x-axis (`type="number" scale="time"`); refetch history every 30 s and after each trade; add the index in Backend hardening.
**Phase:** Portfolio + trading UI, Backend hardening.

### Pitfall 19: Valuation silently falls back to avg_cost

**What goes wrong:** `position_summary` uses `avg_cost` when no cached price exists, so an outage shows zero P&L with no signal; the heatmap shows a flat grey cell and the header total looks healthy. Related: Massive free tier freezes at end-of-day closes and the UI shows "live" prices that never move (only `GET /api/health` reports `mode`).
**Prevention:** Decide per CONCERNS: return `current_price: null` and flag it, or leave and show a "stale" marker. Surface `mode` from `/api/health` as a small badge in the header when not live.
**Phase:** Backend hardening (null price), Live data UI (badge).

### Pitfall 20: Event loop blocking from synchronous SQLite

**What goes wrong:** `async def trade`, the chat route, and the snapshot loop run sync `sqlite3` on the loop. With a local file it is fine, but any lock wait stalls SSE for all clients, which shows as a frozen UI and a `reconnecting` blip. Combined with Pitfall 8 it can become visible.
**Prevention:** Keep single worker and WAL; where touching the code anyway, prefer `def` routes or `asyncio.to_thread`. Do not add a second worker (trade correctness relies on no `await` between read and write in `execute_trade`). Do not over-engineer: only fix if measured.
**Phase:** Backend hardening (low priority).

---

## Minor Pitfalls

### Pitfall 21: LAN exposure
`scripts/start_mac.sh` publishes `-p 8000:8000` with no auth; anyone on the network can trade and spend the OpenRouter credit. Cheap mitigation within scope: publish as `127.0.0.1:8000:8000`. (Docker hardening itself is out of scope.)

### Pitfall 22: Untyped boundaries
SSE and REST shapes are the contract. Define one `types.ts` (`PriceUpdate`, `Portfolio`, `Position`, `ChatResponse`, `ChatAction`) mirroring `PriceUpdate.to_dict()`, `get_portfolio`, and the `actions` list, so a backend rename fails the build.

### Pitfall 23: Number formatting
Negative zero ("-0.00"), colouring by sign of a rounded value, and `Intl.NumberFormat` locale differences. Use one `formatMoney`/`formatPercent` with fixed `en-US`, round before sign checks.

### Pitfall 24: Chat panel layout
Collapsible chat must not unmount its message list or the in-flight request; auto-scroll should only follow when the user is at the bottom; keep `chat-panel` in the DOM (visible) at the E2E viewport (1600x1000) by default (collapsed-by-default would fail `toBeVisible`).

### Pitfall 25: Stale static assets after rebuild
`docker run` reuses the image; the start script only rebuilds with `--build`. During development remind yourself to pass `--build`, or you will "fix" bugs that are already fixed.

### Pitfall 26: Unbounded `chat_messages` and missing indexes
Harmless for v1 but add `CREATE INDEX IF NOT EXISTS` for `portfolio_snapshots` and `chat_messages` together with the other hardening schema change; schema has no migration path, and `CREATE TABLE IF NOT EXISTS` will not alter an existing volume (indexes via `IF NOT EXISTS` do apply).

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Backend hardening | Atomic-turn fix holds write lock across LLM call (8) | Open transaction after LLM returns; savepoint per action; test first |
| Backend hardening | Race unreproducible (9) | `asyncio.gather` test with fake async source, then `ON CONFLICT DO NOTHING` |
| Backend hardening | 502 mapping incomplete or over-sanitised (10) | Move extraction in `try`; fixed safe messages, log full exception; timeout |
| Backend hardening | Schema-level caps reject whole reply (11) | Cap in service, record skipped as failed actions |
| Frontend scaffold + Docker | Contract lost (1); export/dev mismatch, lockfile, Tailwind v4 config (7); jsdom gaps (13) | Walking skeleton builds in Docker first; testid constants; vitest.setup.ts |
| Live data UI | Rows from SSE, replace-not-merge (2); status vs reconnect (3); re-render storm (4); flash (14); baseline (15) | External store with selectors, ring buffers, native EventSource, raw-price compare |
| Portfolio + trading UI | Recharts animation/size/Treemap quirks (5); stale refresh (6); P&L payload (18) | chartDefaults, explicit heights, single refresh path, downsample |
| Chat UI | Error shape/UX (16); history decision (17); mock substring (12); layout (24) | `api.ts` wrapper, keep input on failure, plain-text render |
| E2E integration | Order-dependent state, fresh DB, timing (12) | Gate with `npm run test:docker`; fix UI, not tests, unless a spec is wrong (then change deliberately) |

## Sources

- `/Users/brett/Projects/finally/test/tests/*.spec.ts`, `helpers.ts`, `playwright.config.ts`, `docker-compose.test.yml` (HIGH, primary evidence)
- `/Users/brett/Projects/finally/planning/TEAM.md` section 5 via `git show 5681c3a:planning/TEAM.md` (testid contract) (HIGH)
- `/Users/brett/Projects/finally/.planning/codebase/CONCERNS.md`, `backend/app/chat/{llm,service,router}.py`, `backend/app/market/{stream,router}.py`, `backend/app/routes/*.py`, `Dockerfile`, `.dockerignore` (HIGH, read directly)
- Prior frontend config at commit `5681c3a` (`frontend/next.config.ts`, `package.json`) for the export/dev split and dependency versions (HIGH)
- [Next.js static exports guide](https://nextjs.org/docs/pages/guides/static-exports) (MEDIUM; confirms plain-folder output and `trailingSlash` behaviour)
- [Recharts 3 Treemap typings](https://unpkg.com/browse/recharts@3.10.1/types/chart/Treemap.d.ts) and [Area typings](https://app.unpkg.com/recharts@3.10.1/files/types/cartesian/Area.d.ts) (MEDIUM; `isAnimationActive` exists on Area; Treemap animation and live-data performance guidance was NOT found, so Pitfall 5 items are LOW-MEDIUM until spiked)
- Next dev rewrite proxy timeout, Tailwind v4 CSS-first config, jsdom missing APIs: general knowledge, MEDIUM, not re-verified this session
