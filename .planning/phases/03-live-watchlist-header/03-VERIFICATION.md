---
phase: 03-live-watchlist-header
verified: 2026-10-16T21:10:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/03-live-watchlist-header/03-01-PLAN.md"
  - ".planning/phases/03-live-watchlist-header/03-01-SUMMARY.md"
  - ".planning/phases/03-live-watchlist-header/03-02-PLAN.md"
  - ".planning/phases/03-live-watchlist-header/03-02-SUMMARY.md"
  - ".planning/phases/03-live-watchlist-header/03-03-PLAN.md"
  - ".planning/phases/03-live-watchlist-header/03-03-SUMMARY.md"
  - ".planning/phases/03-live-watchlist-header/03-04-PLAN.md"
  - ".planning/phases/03-live-watchlist-header/03-04-SUMMARY.md"
  - ".planning/phases/03-live-watchlist-header/03-05-PLAN.md"
  - ".planning/phases/03-live-watchlist-header/03-05-SUMMARY.md"
  - "frontend/src/app/globals.css"
  - "frontend/src/components/ConnectionDot.tsx"
  - "frontend/src/components/Dashboard.tsx"
  - "frontend/src/components/FlashingPrice.tsx"
  - "frontend/src/components/Header.tsx"
  - "frontend/src/components/Panel.tsx"
  - "frontend/src/components/Sparkline.tsx"
  - "frontend/src/components/Watchlist.tsx"
  - "frontend/src/components/WatchlistRow.tsx"
  - "frontend/src/lib/format.ts"
  - "frontend/src/lib/portfolioValue.ts"
  - "frontend/src/lib/priceStore.ts"
  - "frontend/src/lib/priceStream.ts"
  - "frontend/src/lib/usePortfolio.ts"
  - "frontend/src/lib/usePrice.ts"
  - "frontend/src/lib/useWatchlist.ts"
covered_digest: "v3:sha256:ee20fa5b592c7244939e110715546355322fe32527881115457532038e4bfe84"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Flash paint: open http://127.0.0.1:8010 in a desktop browser and watch the watchlist"
    expected: "A changed price cell tints green (up) or red (down) for ~50 ms and fades over about 500 ms. Rows that did not change do not flash. With macOS Reduce Motion on, nothing is painted."
    why_human: "Unit tests prove the data-flash attribute and the class swap (49 ms present, 50 ms absent). Whether the browser actually paints and animates the transition-colors duration-500 fade is a rendering fact jsdom cannot see."
  - test: "Sparklines and connection dot: watch sparklines fill; run `docker stop finally-p3`, then `docker start finally-p3`"
    expected: "Sparklines start empty and fill in, colored green, red or gray by net move. The dot is green, turns yellow within a few seconds of the stop, then returns to green with prices resuming after the start."
    why_human: "Real-browser EventSource reconnection timing and SVG rendering. (Playwright sse-reconnect covers a faked CLOSED path; a real container stop is the manual check.)"
  - test: "1280x720 fit: resize the window to 1280x720"
    expected: "The 10 default rows and the add form fit the watchlist panel without scrolling; Chart and Heatmap cells are each at least about 200px wide; header total/cash never wrap."
    why_human: "Layout geometry and text wrapping need a real layout engine (SUMMARY human_judgment items in 03-02, 03-03, 03-04, 03-05)."
  - test: "Add and remove in the browser: type `dis`, press Enter; type `toolongx`, press Add; remove DIS with its x"
    expected: "DIS row appears; a red inline error reads `Invalid ticker: 'TOOLONGX'`; DIS row disappears and focus returns to the add input."
    why_human: "Focus and scroll-into-view behavior and visual error styling in a real browser (the Playwright test covers add/remove but not the 400 text or focus)."
---

# Phase 3: Live Watchlist & Header Verification Report

**Phase Goal:** As a trader, I want to watch live prices stream into my watchlist, so that I can follow the market at a glance. (Mode: mvp; goal is a valid user story.)
**Verified:** 2026-10-16
**Status:** human_needed
**Re-verification:** No, initial verification

## User Flow Coverage (MVP mode)

| Step | Expected | Evidence | Status |
|------|----------|----------|--------|
| Open the app | One EventSource opens to `/api/stream/prices`; dot is yellow until `open` | `Dashboard.tsx` `useEffect(() => connectPriceStream(), [])`; `priceStore.ts` initial status `reconnecting`; `priceStream.ts` `onopen -> connected` | VERIFIED |
| See the watchlist | Exactly the REST tickers (10 on fresh DB), each with ticker, price, daily change vs session open | `useWatchlist.ts` loads `/api/watchlist`; `WatchlistRow.tsx` `dailyChange = (price - openPrice)/openPrice`; Playwright `fresh-start` re-run by me against `finally-p3`: passed | VERIFIED |
| Watch prices tick | Changed cells flash and fade; sparklines fill | `FlashingPrice.tsx` (50 ms hold, `duration-500` fade), `Sparkline.tsx` 64x20 Recharts line from store history; unit tests pass | VERIFIED in code; paint is human item |
| Check the header | Cash `$10,000.00`, total at live prices, dot reflects stream | `Header.tsx` `liveTotalValue(...)` with `usePriceVersion()`; `ConnectionDot.tsx` `useConnectionStatus()`; live `/api/portfolio` returns cash 10000.0 | VERIFIED |
| Add / remove a ticker | Row appears/disappears without reload; 400 shows inline | `useWatchlist.ts` add/remove + reload; `Watchlist.tsx` error slot `role="alert"`; Playwright "adding and removing" passed (orchestrator) | VERIFIED |
| Outcome: follow the market at a glance | All of the above visible on one screen | 138 vitest tests pass (re-run), typecheck clean, container serving the build | VERIFIED (visual judgment pending) |

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Fresh load shows exactly the 10 default tickers; each row has ticker, live price, daily change vs session open; a no-price row shows a placeholder | VERIFIED | `Watchlist.tsx` renders one `WatchlistRow` per REST ticker; `WatchlistRow.tsx` computes change on raw values and shows `--` when no entry; `FlashingPrice` shows `--` without entry. Tests: "renders a placeholder price and change for a REST entry without a price", `priceStore` "skips an entry with a null price". `fresh-start.spec.ts` passed live against `finally-p3`. Live `/api/watchlist` returns 10 entries. |
| 2 | Price flashes green on uptick, red on downtick, fades ~500 ms; sparkline fills progressively from page load | VERIFIED (paint = human item) | `priceStore.flashFor` compares raw prices (first value and equal price give null); `FlashingPrice` sets `data-flash` for `FLASH_HOLD_MS = 50` then idle class `transition-colors duration-500 ease-out`, `motion-reduce` variants present. Tests: 49 ms/50 ms boundary, equal price with sticky `direction: up` no flash, reduced motion paints nothing. `Sparkline` renders the 64x20 box, line only with >= 2 points; history capped at 300 (tests 300/301). |
| 3 | A partial frame updates only its rows; others keep last price; held-not-watched tickers never get a row | VERIFIED | `mergeFrame` iterates frame entries only and notifies per ticker; rows come only from `useWatchlist` REST list; tests "notifies only the ticker that appears in the frame", `usePrice` "re-renders only the probe whose ticker is in the frame", Watchlist ordering/held-only tests. |
| 4 | Dot green when connected, yellow while reconnecting, red only when CLOSED, back to green after recreate; header shows cash and live total | VERIFIED | `priceStream.ts`: `onerror` maps readyState (CONNECTING -> reconnecting, CLOSED -> disconnected), CLOSED schedules one `setTimeout(open, 1000)`, cleanup clears timer. Messages never set status. Tests: "reports disconnected on CLOSED and recreates the stream after exactly 1000 ms", "creates no stream after cleanup with a recreate timer pending", "keeps reconnecting when a message arrives before open". `Header` total = cash + sum(qty x live price, fallback API price); tests "revalues the total at live prices while cash stays the same", "ignores the API total_value". |
| 5 | Add a ticker (uppercased, 400 inline) and remove a ticker, without reload | VERIFIED | `Watchlist.tsx` uppercases on change, posts trimmed value, shows `ApiError.message` verbatim in a `role="alert"` slot; `useWatchlist.remove` sends `DELETE /api/watchlist/{encodeURIComponent}`, clears store entry, reloads. Tests for uppercase/post, disabled-while-pending, 404 idempotency, encoding, reload-keeps-prices. Playwright "adding and removing" passed (orchestrator run). |

**Score:** 5/5 roadmap truths verified (0 behavior-unverified: every state-transition/cancellation truth has a named passing test).

### PLAN must_haves spot-check

All PLAN truths were checked against code: single `EventSource` with relative URL; module-level store read via `useSyncExternalStore` with server snapshots (build exits 0); repeated-timestamp no-op; lower-timestamp still replaces; precision kept raw and rounded only at render (`format.ts` Intl-only with `noNegativeZero`); `seedPrices` never overwrites streamed entries; `ConnectionDot` has `role="status"`, `data-status`, `title`, sr-only text, no `aria-label`; wordmark is the sole `h1`; `Panel` uses `useId` + `aria-labelledby`; `color-scheme: dark` in `globals.css`; `min-w-[1280px]` and 320/224/320 columns in `Dashboard.tsx`; `FlashingPrice` classes `bg-up/25`/`bg-down/25` with `transition-none`. All test-tier prohibitions are enforced by passing tests (no fabricated price for unpriced rows; no flash on equal/repeat/first; dot never `connected` from a message; held position never valued at 0; remove sends only DELETE + GET).

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `frontend/src/lib/priceStore.ts` | VERIFIED | Substantive (entries, 300-cap history, flash, status, version, per-ticker subscriptions), wired via `usePrice.ts`, `priceStream.ts`, `useWatchlist.ts`, `Header.tsx` |
| `frontend/src/lib/priceStream.ts` | VERIFIED | `connectPriceStream` called from `Dashboard` effect; `mergeFrame(JSON.parse(...))` |
| `frontend/src/lib/usePrice.ts` | VERIFIED | four `useSyncExternalStore` hooks, all with server snapshots |
| `frontend/src/lib/useWatchlist.ts` | VERIFIED | load/add/remove/error/pending, used by `Watchlist.tsx` |
| `frontend/src/lib/portfolioValue.ts`, `usePortfolio.ts` | VERIFIED | used by `Header.tsx`; `refresh` exposed |
| `frontend/src/components/{Watchlist,WatchlistRow,FlashingPrice,Sparkline,Header,ConnectionDot,Panel,Dashboard}.tsx` | VERIFIED | all substantive and composed in `Dashboard` |
| `frontend/src/app/globals.css` | VERIFIED | `color-scheme: dark` present |

### Key Link Verification

| From | To | Status |
|------|----|--------|
| `Dashboard` -> `connectPriceStream` | WIRED (`useEffect(() => connectPriceStream(), [])`) |
| `priceStream` -> `mergeFrame` | WIRED (`mergeFrame(JSON.parse(event.data))`) |
| `WatchlistRow` -> `useTickerPrice`/`useTickerHistory` | WIRED |
| `Watchlist` -> `useWatchlist` -> `/api/watchlist` -> `seedPrices` | WIRED |
| `useWatchlist.remove` -> `clearTicker` | WIRED |
| `Header` -> `liveTotalValue` + `usePriceVersion` | WIRED |
| `ConnectionDot` -> `useConnectionStatus` | WIRED |
| `WatchlistRow` -> `FlashingPrice`, `Sparkline`, remove button | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| `WatchlistRow` price/change | `entry` | SSE frames via `mergeFrame` + REST seed | Live `/api/stream/prices` emits keyed frames with `ticker, price, open_price, timestamp` (curl-confirmed on :8010) | FLOWING |
| `Sparkline` | `history` | store history from frames | yes | FLOWING |
| `Header` total/cash | `portfolio` + store prices | `/api/portfolio` (curl: cash 10000.0) + store | yes | FLOWING |
| `ConnectionDot` | status | EventSource open/error | yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full frontend suite | `npx vitest run` (frontend) | 13 files, 138 passed | PASS |
| Typecheck | `npm --prefix frontend run typecheck` | clean | PASS |
| Fresh-start E2E vs running container | `BASE_URL=http://127.0.0.1:8010 npx playwright test fresh-start.spec.ts -g "fresh start"` | 1 passed | PASS |
| Health / SSE shape | `curl :8010/api/health`, `curl -N :8010/api/stream/prices` | status ok; `retry: 1000` plus keyed ticker frames | PASS |
| sse-reconnect and add/remove E2E | not re-run (they mutate the running container); orchestrator reports 3/3 passed | | Accepted from orchestrator |

### Probe Execution

Step 7c: SKIPPED (no probe scripts declared by this phase).

### Requirements Coverage

| Requirement | Plans | Status | Evidence |
|-------------|-------|--------|----------|
| LIVE-01 one EventSource, per-ticker merge, outside React state | 03-01 | SATISFIED | `priceStream.ts`, `priceStore.ts`, `usePrice.ts` |
| LIVE-02 dot via `data-status`; disconnected only when CLOSED; recreate | 03-01, 03-03 | SATISFIED | `ConnectionDot.tsx`, `priceStream.ts`, stream tests |
| LIVE-03 REST rows, price, daily change vs open, placeholder | 03-01, 03-04 | SATISFIED | `useWatchlist.ts`, `WatchlistRow.tsx`, `Watchlist.tsx` |
| LIVE-04 flash green/red fading ~500 ms | 03-02 | SATISFIED (paint is human item) | `FlashingPrice.tsx` |
| LIVE-05 capped-history sparkline | 03-02 | SATISFIED | `Sparkline.tsx`, `HISTORY_LIMIT = 300` |
| LIVE-06 add ticker, uppercased, inline 400 | 03-05 | SATISFIED | `Watchlist.tsx`, `useWatchlist.add` |
| LIVE-07 remove ticker | 03-05 | SATISFIED | `WatchlistRow.tsx`, `useWatchlist.remove` |
| LIVE-08 header live total and cash | 03-03 | SATISFIED | `Header.tsx`, `portfolioValue.ts` |

All eight IDs appear in plan frontmatter (03-01: 01-03; 03-02: 04-05; 03-03: 02, 08; 03-04: 03; 03-05: 06-07) and in REQUIREMENTS.md mapped to Phase 3. No orphaned requirements. REQUIREMENTS.md checkboxes/traceability still read "Pending" for LIVE-01..08; this is a bookkeeping update for the orchestrator after the human items clear, not a code gap.

### Code review warnings vs must-haves

| Finding | Defeats a must-have? | Judgment |
|---------|----------------------|----------|
| WR-01 failed reload after a successful add/remove replaces the list with the alert | No. The must-have error state concerns the initial load; this is a transient-failure edge after a successful mutation. | Advisory; real robustness defect worth fixing in a follow-up (render alert only when `tickers === null`). |
| WR-02 single `removing` slot, unordered `load()` | No. Cosmetic double-DELETE (404 swallowed) and rare stale list under overlapping mutations. | Advisory. |
| WR-03 `clearTicker` on a still-held ticker drops its live price | No. Header falls back to API `current_price` (the prohibition against valuing at zero holds) and the next frame refills the entry. | Advisory; becomes more relevant in Phase 4 when positions exist. |
| WR-04 change color from the unrounded value | No. Plan and tests specify exact-equality coloring; a value rounding to `0.00%` may be tinted. | Advisory, cosmetic. |

### Anti-Patterns Found

None. `grep` for TBD/FIXME/XXX/TODO/HACK across `frontend/src` returned nothing. No stubs, hardcoded empty render paths, or console-only handlers in the phase's files.

### Human Verification Required

See `human_verification` in frontmatter (4 items): flash paint and Reduce Motion, sparkline fill and real `docker stop/start` dot transitions, 1280x720 fit plus header figures not wrapping, and add/remove/400/focus in a real browser. `finally-p3` is still running on :8010 for this purpose; afterwards run `docker rm -f finally-p3`.

### Gaps Summary

No gaps. Every roadmap success criterion and every LIVE requirement is implemented, wired, fed by real data, and covered by passing tests; the running container serves the live stream the UI consumes. Status is `human_needed` solely because visual/real-browser checks (animation paint, layout fit, real container-stop reconnect) cannot be verified programmatically.

---

_Verified: 2026-10-16_
_Verifier: Claude (gsd-verifier)_
