---
phase: 03-live-watchlist-header
reviewed: 2026-10-16T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - frontend/src/app/globals.css
  - frontend/src/components/ConnectionDot.tsx
  - frontend/src/components/Dashboard.test.tsx
  - frontend/src/components/Dashboard.tsx
  - frontend/src/components/FlashingPrice.test.tsx
  - frontend/src/components/FlashingPrice.tsx
  - frontend/src/components/Header.test.tsx
  - frontend/src/components/Header.tsx
  - frontend/src/components/Panel.tsx
  - frontend/src/components/Sparkline.test.tsx
  - frontend/src/components/Sparkline.tsx
  - frontend/src/components/Watchlist.test.tsx
  - frontend/src/components/Watchlist.tsx
  - frontend/src/components/WatchlistRow.tsx
  - frontend/src/lib/format.test.ts
  - frontend/src/lib/format.ts
  - frontend/src/lib/portfolioValue.test.ts
  - frontend/src/lib/portfolioValue.ts
  - frontend/src/lib/priceStore.test.ts
  - frontend/src/lib/priceStore.ts
  - frontend/src/lib/priceStream.test.ts
  - frontend/src/lib/priceStream.ts
  - frontend/src/lib/usePortfolio.ts
  - frontend/src/lib/usePrice.test.tsx
  - frontend/src/lib/usePrice.ts
  - frontend/src/lib/useWatchlist.ts
  - frontend/src/test/fixtures.ts
  - frontend/vitest.setup.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-16
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

The live price store, SSE client, watchlist and header are small, consistent with the approved UI-SPEC and the backend contract (SSE frame shape, REST watchlist null-price fields, 404 on remove, `^[A-Z]{1,5}$` validation). I found no security problems: error text is rendered as text nodes (and a test covers it), the DELETE path is encoded, and the only `querySelector` built from user input is reachable only after the backend has validated the ticker.

No blockers. The issues are four behavioral warnings, all on the mutation and removal paths (a transient reload failure hides a healthy list, overlapping mutations race, removing a held ticker blanks its live price, and a rounded-zero change is colored as a move), plus four minor items. Tests are generally meaningful. I found no vacuous assertions in the files reviewed.

## Warnings

### WR-01: A failed list reload after a successful add or remove replaces the whole list with the "unavailable" alert

**File:** `frontend/src/lib/useWatchlist.ts:19-28, 44, 67` and `frontend/src/components/Watchlist.tsx:26-32`
**Issue:** `load()` swallows every error and sets `loadFailed = true`. `add()` and `remove()` both call `load()` after the mutation has already succeeded on the server. If that one follow-up GET fails (a network blip or a 500), `WatchlistList` returns the "Watchlist unavailable. Reload the page to try again." alert and unmounts every row, even though `tickers` still holds the last good list. `add()` also returns `true` in that case, so the draft is cleared and `scrollTarget` is set for a row that is no longer rendered. The copy tells the user to reload, which is the only recovery. `loadFailed` only clears on the next successful load, and nothing triggers one.
**Fix:** Treat `loadFailed` as a first-load state only. Keep showing the last good list when a refresh fails.
```ts
// useWatchlist.ts: in load()'s catch
} catch {
  setTickers((current) => { if (current === null) setLoadFailed(true); return current; });
}
```
A simpler option is to render the alert in `WatchlistList` only when `tickers === null && loadFailed`, and check `tickers` before `loadFailed`.

### WR-02: Overlapping add and remove calls race on a single `removing` slot and on unordered `load()` responses

**File:** `frontend/src/lib/useWatchlist.ts:17, 56-70, 19-28`
**Issue:** There are two related races.
1. `removing` holds one ticker. Click remove on A, then on B while A's DELETE and reload are pending. `remove(B)` sets `removing = B`. When A's `finally` runs it sets `removing = null`, so B's button is re-enabled while B's DELETE is still in flight. The spec requires the button to stay disabled until its own DELETE settles. A second click sends a duplicate DELETE. The 404 is swallowed, so this is only cosmetic.
2. `adding` and `removing` are independent, so a remove can run while an add is in flight. Every mutation ends with `load()`, and `load()` applies whichever response resolves last. A GET issued before a later mutation completes can resolve after the newer GET and call `setTickers` with a stale list. The row for the just-added or just-removed ticker then flickers or reappears until the next load. Nothing later corrects it.
**Fix:** Use a `Set<string>` for in-flight removals, and ignore stale `load()` results with a monotonically increasing request id.
```ts
const loadId = useRef(0);
const load = useCallback(async () => {
  const id = ++loadId.current;
  try {
    const { tickers: list } = await request<{ tickers: FrameEntry[] }>("/api/watchlist");
    if (id !== loadId.current) return;
    ...
```

### WR-03: Removing a held ticker from the watchlist wipes its live price, so the header total reverts to the stale API price

**File:** `frontend/src/lib/priceStore.ts:86-92`, `frontend/src/lib/useWatchlist.ts:62-64`, `frontend/src/lib/portfolioValue.ts:29-32`
**Issue:** `clearTicker` deletes the price entry for any removed ticker. The backend keeps pricing a removed ticker that is still held (`remove_from_watchlist` only stops the source when there is no position, and `tracked_tickers` includes positions). `liveTotalValue` falls back to `position.current_price`, which is the value fetched at page load (the portfolio is fetched once). Between `clearTicker` and the next SSE frame that carries the ticker, the header "Portfolio value" jumps to a stale figure. SSE frames are only sent when the cache version changes, so with the simulator this lasts about 0.5 s. With the Massive source (poll every 15 s) it can last up to 15 s. The ticker's price history is lost too. The same store will back the Phase 4 positions table, which would show stale prices in the same window.
**Fix:** Keep the live entry and let the stream own it. Only drop the sparkline history on removal (the spec's "no line across the gap" goal), for example by adding `clearHistory(ticker)` that resets `histories` and notifies, and leave `entries` alone. Alternatively, `remove()` could skip clearing the entry when the portfolio holds the ticker.

### WR-04: The daily-change cell colors a value that rounds to 0.00% as a gain or loss

**File:** `frontend/src/components/WatchlistRow.tsx:13-16, 37`
**Issue:** `changeColor` compares the raw fraction to 0, while `formatPercent` rounds to two percentage decimals and drops the sign for a rounded zero (`format.test.ts` asserts `formatPercent(-0.00001) === "0.00%"`). A change of +0.002% renders as "0.00%" in `text-up` (green). Near the session open, small moves like this are common, so the text and color disagree on the most visible rows. The UI-SPEC says zero change uses `muted`. The existing test only covers an exactly equal price and open.
**Fix:** Decide the color from the displayed value.
```ts
const changeColor = (change?: number) => {
  const shown = change === undefined ? 0 : Math.round(change * 10000) / 10000; // two percent decimals
  if (shown === 0) return "text-muted";
  return shown > 0 ? "text-up" : "text-down";
};
```
Add a test such as `streamTick("AAPL", 100.002, 100)` expecting `text-muted`.

## Info

### IN-01: The store keeps `flash` on the entry indefinitely, so a remounted price cell re-flashes a stale tick

**File:** `frontend/src/lib/priceStore.ts:14, 41`, `frontend/src/components/FlashingPrice.tsx:22-28`
**Issue:** `entry.flash` is state of one tick, but it stays in the store until the next tick. `FlashingPrice` re-derives its flash from `entry` on mount. Any remount of a row replays the last flash. One case is `WatchlistList` swapping between the list and the alert (see WR-01), which unmounts all rows. Another is a row's key changing.
**Fix:** Skip the flash when the entry's timestamp is not recent, or keep the flash out of the persisted entry and pass it as a transient (for example, compare against the previous `entry` held in a ref inside `FlashingPrice`).

### IN-02: `usePortfolio().refresh` cannot be reached from other components

**File:** `frontend/src/lib/usePortfolio.ts:5-22`, `frontend/src/components/Header.tsx:24`
**Issue:** The doc comment says Phase 4 calls `refresh()` after a trade, but state lives in a per-call `useState`. `Header` is the only caller, and it discards `refresh`. A trade bar calling `usePortfolio()` would get its own independent state, and the header cash and total would not update. This will bite in Phase 4.
**Fix:** When Phase 4 is planned, lift the portfolio into a shared store or context (as `priceStore` does) rather than a hook-local state.

### IN-03: `scrollTarget` can stay set when the added row never renders

**File:** `frontend/src/components/Watchlist.tsx:53, 58-64, 70-73`
**Issue:** The effect clears `scrollTarget` only when it finds the row. If `add()` succeeds but the row is absent (see WR-01), the target stays set. The next `tickers` change, such as removing an unrelated ticker, then scrolls to a ticker the user added earlier. This is a minor side effect of the same root cause as WR-01.
**Fix:** Clear `scrollTarget` unconditionally at the end of the effect, or fixing WR-01 makes this unreachable.

### IN-04: The sparkline color compares the first and last points of a sliding 300-point window

**File:** `frontend/src/components/Sparkline.tsx:8-13`, `frontend/src/lib/priceStore.ts:6, 42`
**Issue:** The tooltip says "Since page load", but once a ticker has more than `HISTORY_LIMIT` ticks the first point is the oldest retained one. At roughly 2 ticks/s that is after about 2.5 minutes. The stroke color then reflects the last 150 s, not the net move since load.
**Fix:** Either rename the tooltip (for example "Recent ticks"), or keep the first price separately in the store for the color decision.

---

_Reviewed: 2026-10-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
