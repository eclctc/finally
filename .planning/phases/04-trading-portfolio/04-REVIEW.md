---
phase: 04-trading-portfolio
reviewed: 2026-10-16T19:30:00Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - frontend/src/components/ChartTooltip.tsx
  - frontend/src/components/Dashboard.test.tsx
  - frontend/src/components/Dashboard.tsx
  - frontend/src/components/Header.test.tsx
  - frontend/src/components/Header.tsx
  - frontend/src/components/Heatmap.test.tsx
  - frontend/src/components/Heatmap.tsx
  - frontend/src/components/MainChart.test.tsx
  - frontend/src/components/MainChart.tsx
  - frontend/src/components/PnlChart.test.tsx
  - frontend/src/components/PnlChart.tsx
  - frontend/src/components/PositionRow.tsx
  - frontend/src/components/PositionsTable.test.tsx
  - frontend/src/components/PositionsTable.tsx
  - frontend/src/components/Sparkline.test.tsx
  - frontend/src/components/Sparkline.tsx
  - frontend/src/components/TradeBar.test.tsx
  - frontend/src/components/TradeBar.tsx
  - frontend/src/components/Watchlist.test.tsx
  - frontend/src/components/Watchlist.tsx
  - frontend/src/components/WatchlistRow.tsx
  - frontend/src/lib/api.ts
  - frontend/src/lib/format.test.ts
  - frontend/src/lib/format.ts
  - frontend/src/lib/formatTime.test.ts
  - frontend/src/lib/formatTime.ts
  - frontend/src/lib/pnlSeries.test.ts
  - frontend/src/lib/pnlSeries.ts
  - frontend/src/lib/portfolioValue.test.ts
  - frontend/src/lib/portfolioValue.ts
  - frontend/src/lib/priceStore.test.ts
  - frontend/src/lib/priceStore.ts
  - frontend/src/lib/usePortfolio.test.tsx
  - frontend/src/lib/usePortfolio.ts
  - frontend/src/lib/usePortfolioHistory.test.tsx
  - frontend/src/lib/usePortfolioHistory.ts
  - frontend/src/lib/usePrice.test.tsx
  - frontend/src/lib/usePrice.ts
  - frontend/src/lib/useWatchlist.ts
  - frontend/src/test/fixtures.ts
findings:
  critical: 0
  warning: 5
  info: 8
  total: 13
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-16T19:30:00Z
**Depth:** standard
**Files Reviewed:** 40
**Status:** issues_found

## Summary

Reviewed the Phase 4 frontend (trade bar, positions table, heatmap, main chart, P&L chart, shared portfolio and history hooks, price-store series) against the backend contracts in `backend/app/routes/portfolio.py`, `backend/app/services/portfolio.py` and `backend/app/routes/watchlist.py`. The response shapes line up: trade returns `{trade, portfolio}`, history is `{snapshots: [{total_value, recorded_at}]}`, and the `recorded_at` regex trim handles both fractional and whole-second ISO strings. `npm --prefix frontend run typecheck` is clean and all 278 tests pass in isolation (3 of 3 runs, about 1.5 s each). I found no security issues. Server error text is rendered as text only, the one `querySelector` built from a ticker only sees server-validated `^[A-Z]{1,5}$` values, and the DELETE path uses `encodeURIComponent`.

The unreproduced full-suite failure is now reproduced. When 8 to 20 vitest processes run concurrently, `Dashboard > selects the first watchlist ticker on a fresh load` failed in about 27 of 34 runs. Two `Watchlist` tests also failed intermittently (WR-01, WR-02). The production code has no critical defect. The main product risk is the trade-failure path (WR-04), where a lost response invites a duplicate order.

No structural (fallow) findings or external reviewer evidence were provided.

## Warnings

### WR-01: Dashboard test "selects the first watchlist ticker on a fresh load" races an effect-synced render (reproduced flake)

**File:** `frontend/src/components/Dashboard.test.tsx:91-102` (cause in `frontend/src/components/TradeBar.tsx:47-52`)
**Issue:** The test waits for `main-chart[data-ticker="AAPL"]`, then asserts synchronously that `trade-ticker` has value `AAPL`. The trade input is not set in the same render. `TradeBar` copies `selectedTicker` into `ticker` state from a `useEffect`, so the input updates one render after the chart attribute. `waitFor` resolves on the first commit that shows `data-ticker`, and the next assertion runs before the effect and its re-render have flushed.

I reproduced this with concurrent runs: `npx vitest run` ×14 failed 11 times, and `vitest run Watchlist.test.tsx Dashboard.test.tsx` ×20 failed 16 times. The failure is always `expected element toHaveValue("AAPL")`, received `""`. It passes when the machine is idle, so it looks like the one-off 241-test failure the executor saw.

**Fix:** Fix the cause in the component and keep the test meaningful. Adjust state during render instead of in an effect, which also removes the ref in WR-03:

```tsx
const [seenSelection, setSeenSelection] = useState<string | null>(null);
if (selectedTicker !== seenSelection) {
  setSeenSelection(selectedTicker);
  if (selectedTicker !== null && (seenSelection !== null || ticker === "")) setTicker(selectedTicker);
  setMessage(null);
}
```

Also make the test robust: `await waitFor(() => expect(screen.getByTestId(testIds.tradeTicker)).toHaveValue("AAPL"))`.

### WR-02: Store-driven Watchlist and Dashboard tests assert synchronously after `act` on timing they do not control

**File:** `frontend/src/components/Watchlist.test.tsx:151-156`, `:460-471`; `frontend/src/components/Dashboard.test.tsx:124-166`; `frontend/src/components/FlashingPrice.tsx:12`
**Issue:** There are two distinct races.

1. **Flash tint has a real 50 ms lifetime.** `FLASH_HOLD_MS = 50` runs on a real timer, but `orders the row cells ...` (line 467) asserts `data-flash="up"` after unrelated synchronous work with real timers. Under CPU load more than 50 ms can pass, the timer clears the flash, and the test fails with `data-flash` null. I reproduced this.
2. **Late store subscription.** `watchApiList`/`watchAapl` end with `await findByTestId(row)`. The rows are committed by a fetch resolution outside `act`, so their `useSyncExternalStore` subscriptions may not have run yet when `streamTick`'s `act(() => mergeFrame(...))` fires. The assertion then sees the placeholder. I reproduced `shows a negative change one cent below the open in text-down`: the received class was `text-muted` while `textContent` still matched `/^-/`, which is exactly the `"--"` placeholder.

The same pattern appears in `streams a live price into its watchlist row` (Dashboard.test.tsx:145-162) and the other `streamTick` tests; they just have not failed yet.

**Fix:** Settle the row before streaming: `await act(async () => {})` after the `findBy`, or assert with `await waitFor(...)`. For the flash test, use `vi.useFakeTimers()` or assert inside `waitFor`, since a 50 ms real-time window is not a stable assertion target:

```tsx
await act(async () => {}); // flush the row's subscription effect
streamTick("AAPL", 195, 190);
await waitFor(() => expect(cells[1]).toHaveAttribute("data-flash", "up"));
```

### WR-03: `TradeBar` selection sync reads and writes a mutable ref inside a state updater

**File:** `frontend/src/components/TradeBar.tsx:44,47-52`
**Issue:** The updater passed to `setTicker` reads `hadSelection.current`, and the effect sets `hadSelection.current = true` on the next line. Updaters must be pure. It works today only because React happens to evaluate the updater eagerly, while the ref is still `false`. If React defers the updater to render (the fiber already has pending work, or StrictMode double-invokes it), the ref is already `true` and the "typed text survives the first selection" rule silently breaks, overwriting what the user typed.

**Fix:** Drop the ref and derive "first selection" from state, as in the WR-01 snippet (`seenSelection === null`).

### WR-04: A failed trade request tells the user to "Try again" without checking whether it filled

**File:** `frontend/src/components/TradeBar.tsx:74-76`, `frontend/src/components/Dashboard.tsx:20,25-31`
**Issue:** `request()` rejects with a non-`ApiError` for any `fetch` rejection or unparseable 2xx body, and `errorMessage` maps that to `"Request failed. Try again."`. A timeout or connection drop after the server has committed the order (the backend writes cash, position, trade and snapshot in one unit) produces exactly this message. The user retries and the order executes twice. Nothing reloads the portfolio on that path either, so the header and positions stay stale for up to 30 s (`POLL_MS`). `usePortfolio().refresh` is exposed for this purpose but `Dashboard` never uses it.

**Fix:** Have `Dashboard` pass a refresh callback, and call it when the failure is not an `ApiError` (an `ApiError` means the server rejected the order):

```tsx
// TradeBar catch
if (!(err instanceof ApiError)) onUncertain();
// Dashboard
const { portfolio, failed, setPortfolio, refresh } = usePortfolio();
<TradeBar selectedTicker={selectedTicker} onFilled={handleFilled} onUncertain={refresh} />
```

### WR-05: One failed watchlist reload replaces an already loaded list with "Reload the page"; reloads are unordered

**File:** `frontend/src/components/Watchlist.tsx:28-34`, `frontend/src/lib/useWatchlist.ts:15-24,40,63`
**Issue:** `load()` sets `loadFailed` on any failure, and `WatchlistList` checks `loadFailed` before `tickers`. After a successful add or remove, a single failed follow-up GET (add and remove both call `load()`) hides the whole list behind "Watchlist unavailable. Reload the page to try again." even though `tickers` is populated. `usePortfolio` and `usePortfolioHistory` deliberately avoid this (`failed` only while nothing has loaded); the watchlist does not. In addition, `load` has no latest-request guard, so two overlapping loads (add, then quickly remove) can resolve out of order and leave a stale list until the next add or remove. Nothing polls the watchlist, so a stale list persists.

**Fix:** Mirror the other hooks: expose `loadFailed && tickers === null`, and add the same `useRef` generation guard to `load`.

## Info

### IN-01: Quantity parsing accepts hex, binary and octal literals

**File:** `frontend/src/components/TradeBar.tsx:54-56,66`
**Issue:** `Number(quantity)` interprets `"0x10"` as 16, `"0b11"` as 3 and `"0o7"` as 7, and the buttons enable (the test list only covers `1e3` and `0.25`). The user sees `0x10` in the box and buys 16 shares. The estimate matches the sent value, so there is no mismatch, but typed intent is silently reinterpreted.
**Fix:** Gate on a decimal pattern: `const validQuantity = /^\d*\.?\d+(e\d+)?$/i.test(quantity.trim()) && amount > 0;` (keep `1e3` if that case is wanted).

### IN-02: `formatQuantity` rounds small fractional positions to "0"

**File:** `frontend/src/lib/format.ts:15`, used in `frontend/src/components/PositionRow.tsx:21` and `frontend/src/components/TradeBar.tsx:72`
**Issue:** The backend accepts any positive quantity (only `> 0` is validated). Buying `0.00001` shares shows `Qty 0` in the table and `Filled BUY 0 AAPL` in the trade line, next to a non-zero value.
**Fix:** Use `maximumSignificantDigits` or raise `maximumFractionDigits` (for example 8), or show `<0.0001` below the display floor.

### IN-03: Hardcoded "Start $10,000" label duplicates `STARTING_CASH`

**File:** `frontend/src/components/PnlChart.tsx:26-31`
**Issue:** The baseline reference line uses `STARTING_CASH`, but its label repeats the figure as a literal, so the two can drift.
**Fix:** `value: \`Start ${formatCurrency(STARTING_CASH)}\``.

### IN-04: "Last 10 min" and "Since page load" captions assume 500 ms ticks

**File:** `frontend/src/components/MainChart.tsx:58`, `frontend/src/components/Sparkline.tsx:22`, `frontend/src/lib/priceStore.ts:6`
**Issue:** `HISTORY_LIMIT = 1200` equals 10 minutes only for the simulator. With the Massive source polling every 15 s, 1,200 points is about 5 hours and the label is false. The sparkline title still says "Since page load" while it now plots only the last 300 points.
**Fix:** Derive the label from the series (`series.at(-1).t - series[0].t`), or reword it to "Last N points". Update the sparkline title.

### IN-05: Heatmap "no click or hover handlers" test cannot fail

**File:** `frontend/src/components/Heatmap.test.tsx:106-111`
**Issue:** React attaches handlers by event delegation at the root, so `tile.onclick` and `tile.onmouseenter` stay `null` even when an `onClick` is added to the `<g>`. This is the same vacuous-pass pattern as the earlier Phase 1 WR-03.
**Fix:** Assert the behaviour: `await user.click(tile)` and check that no state change or callback occurred. Alternatively, drop the test.

### IN-06: Dashboard test claims the P&L chart redraws after a trade but never checks it

**File:** `frontend/src/components/Dashboard.test.tsx:228-255`
**Issue:** The only chart assertion (`recharts-curve` count 1) runs before the trade. After the trade the test checks that `/api/portfolio/history` was fetched twice, not that the chart updated.
**Fix:** Return a longer history from the second GET and assert the tail or point count changed, or rename the test to what it verifies.

### IN-07: `usePortfolioHistory` imports `POLL_MS` from `usePortfolio`; the generation-guard logic is duplicated

**File:** `frontend/src/lib/usePortfolioHistory.ts:4,14-35`, `frontend/src/lib/usePortfolio.ts:5,15-42`
**Issue:** The history hook depends on a sibling hook module for a shared constant, and both hooks carry near-identical poll, latest-request guard and `failed` logic.
**Fix:** Move `POLL_MS` to a small shared module (or `api.ts`), and consider a `usePolledResource(path, map)` helper. The `setPortfolio` supersede step can stay specific to the portfolio hook.

### IN-08: Trade result live regions are mounted together with their text

**File:** `frontend/src/components/TradeBar.tsx:124-133`
**Issue:** `role="alert"` and `role="status"` paragraphs are inserted into the DOM already containing their text. Several screen readers do not announce content that arrives with a newly created live region, so the fill and error lines may go unspoken.
**Fix:** Keep one always-mounted `<p role="status" aria-live="polite">` and swap its text and colour class by `message.kind`. This keeps `trade-error` as the testid on the same node.

---

_Reviewed: 2026-10-16T19:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
