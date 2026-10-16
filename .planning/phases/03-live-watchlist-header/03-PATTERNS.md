# Phase 3: Live Watchlist & Header - Pattern Map

**Mapped:** 2026-10-16
**Files analyzed:** 27 (13 new source, 6 modified source, 8 new/modified tests)
**Analogs found:** 22 / 27 (5 have no in-repo analog; use 03-RESEARCH.md sketches)

All analog paths are git-tracked (checked with `git ls-files` in `frontend/`). Prior art at `5681c3a` is NOT an analog (it uses `setPrices(frame)` in top-level state, forbidden by LIVE-01).

## File Classification

| New/Modified File (under `frontend/`) | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/lib/priceStore.ts` (new) | store | pub-sub | none; RESEARCH "Store" sketch | no analog |
| `src/lib/priceStream.ts` (new) | service | streaming | `src/test/harness.test.tsx` L14-24 (effect lifecycle), RESEARCH "Connection manager" | partial |
| `src/lib/usePrice.ts` (new) | hook | pub-sub | none; RESEARCH "Hook with server snapshot" | no analog |
| `src/lib/portfolioValue.ts` (new) | utility | transform | `src/lib/format.ts` (small pure module) | role-match |
| `src/lib/useWatchlist.ts` (new) | hook | CRUD | `src/components/Header.tsx` L25-33 (fetch via `request`) | role-match |
| `src/lib/usePortfolio.ts` (new) | hook | request-response | `src/components/Header.tsx` L25-33 | exact (extract) |
| `src/components/Watchlist.tsx` (new) | component | CRUD | `src/components/Panel.tsx` + `Header.tsx` (alert pattern) | role-match |
| `src/components/WatchlistRow.tsx` (new) | component | pub-sub | `Header.tsx` `Figure` (small cell component) | partial |
| `src/components/FlashingPrice.tsx` (new) | component | event-driven | none; RESEARCH "Flash element" | no analog |
| `src/components/Sparkline.tsx` (new) | component | transform | `src/test/harness.test.tsx` L3, L31-33 (Recharts usage) | partial |
| `src/components/ConnectionDot.tsx` (new) | component | request-response | `Header.tsx` L56-62 (existing dot) | exact (extract) |
| `src/components/Header.tsx` (mod) | component | pub-sub | itself | n/a |
| `src/components/Panel.tsx` (mod) | component | n/a | itself | n/a |
| `src/components/Dashboard.tsx` (mod) | component | n/a | itself | n/a |
| `src/app/globals.css` (mod) | config | n/a | itself L18 | n/a |
| `src/lib/format.ts` (mod, WR-01) | utility | transform | itself L5 | n/a |
| `vitest.setup.ts` (mod) | config | n/a | itself L48-51 | n/a |
| `src/test/fixtures.ts` (new) | test util | n/a | `Header.test.tsx` L8-12 `stubPortfolio` | partial |
| `src/lib/{priceStore,priceStream,portfolioValue}.test.ts` (new) | test | n/a | `src/lib/api.test.ts` | role-match |
| `src/components/{Watchlist,FlashingPrice,Sparkline}.test.tsx` (new) | test | n/a | `src/components/Header.test.tsx` | exact |
| `src/components/Header.test.tsx`, `Dashboard.test.tsx` (mod) | test | n/a | themselves | n/a |

## Pattern Assignments

### `src/lib/usePortfolio.ts` + `src/components/Header.tsx` (hook / component, request-response)

**Analog:** `src/components/Header.tsx` (current).

**Imports + fetch pattern** (Header.tsx L3-6, L25-33). Move into `usePortfolio()`; return `{ portfolio, failed, refresh }` (expose `refresh` per RESEARCH Pattern 6):
```tsx
import { useEffect, useState } from "react";
import { request } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { testIds } from "@/lib/testIds";
...
const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
const [failed, setFailed] = useState(false);
useEffect(() => {
  request<PortfolioSummary>("/api/portfolio").then(setPortfolio).catch(() => setFailed(true));
}, []);
```
Change `PortfolioSummary` to the full shape: `cash_balance`, `total_value`, `positions: { ticker, quantity, current_price, ... }[]`.

**Edits to Header (keep everything else, testids, `Figure`, alert markup L41-45 unchanged):**
- L37-39: `<span>` wordmark becomes `<h1 className="text-lg font-semibold leading-tight text-text">` with same children.
- L48: `show(portfolio?.total_value)` becomes `show(liveTotal)` where `liveTotal` is `undefined` until portfolio loads, else `liveTotalValue(portfolio, getPrice)`. Subscribe via one version-counter `useSyncExternalStore` (RESEARCH Pattern 6).
- L56-62: replace the hard-coded dot with `<ConnectionDot />`.

**Alert pattern to copy for the Watchlist load/add errors** (Header.tsx L41-45):
```tsx
<span role="alert" className="shrink-0 whitespace-nowrap text-[11px] text-down">
  Portfolio unavailable. Reload the page to try again.
</span>
```
(Watchlist errors use `break-words`, not `whitespace-nowrap`; Body size not 11px.)

### `src/components/ConnectionDot.tsx` (component, request-response)

**Analog:** Header.tsx L56-62 (the shipped dot). Replace with UI-SPEC "Connection dot" markup:
```tsx
<span role="status" data-testid={testIds.connectionStatus} data-status={status}
  title={label} className={`relative size-2.5 shrink-0 rounded-full ${color}`}>
  <span className="sr-only">{label}</span>
</span>
```
Use a literal lookup map `{ connected: "bg-up", reconnecting: "bg-accent", disconnected: "bg-down" }` and labels `Connected`/`Reconnecting`/`Disconnected`. Drop `aria-label`. Status comes from `useConnectionStatus()` in `usePrice.ts`.

### `src/components/Panel.tsx` (modify: a11y landmark)

**Analog:** itself, L9-17. Add `useId()`; `section` gets `aria-labelledby={id}`, `h2` gets `id={id}`:
```tsx
<section data-testid={testId} className={`flex min-h-0 flex-col border border-line bg-panel ${className}`}>
  <header className="flex h-8 shrink-0 items-center border-b border-line px-2">
    <h2 className="truncate text-[11px] font-semibold text-muted">{title}</h2>
```
Panel has no `"use client"`; it is imported only by client `Dashboard`, so `useId` is fine (it works on server too).
Watchlist content must be `flex h-full min-h-0 flex-col` inside the `overflow-y-auto` body div (L15), form `shrink-0`, list `min-h-0 flex-1 overflow-y-auto`.

### `src/components/Dashboard.tsx` (modify: layout + stream mount)

**Analog:** itself. Exact class changes (L10, L13, L15, L23):
```tsx
<div className="flex h-screen min-w-[1280px] flex-col bg-surface text-text">          // was 1024
<main className="grid min-h-0 min-w-0 flex-1 grid-cols-[320px_minmax(0,1fr)] gap-px"> // was minmax(300px,340px)_1fr
<div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_224px] grid-rows-[...unchanged] gap-px">
<aside className="w-[320px] shrink-0">                                                // was 360
```
Replace L14 `<Panel title="Watchlist" testId={testIds.watchlist} />` with `<Watchlist />` (which renders the Panel with the same title and testId). Add `useEffect(() => connectPriceStream(), []);` (file already has `"use client"`; add `import { useEffect } from "react"`). `connectPriceStream` returns its cleanup.

### `src/lib/priceStream.ts` (service, streaming)

**Analog:** `src/test/harness.test.tsx` L14-24 for the effect/cleanup shape, plus the test double `vitest.setup.ts` L16-42. The double supports property handlers only (`onopen`, `onmessage`, `onerror`) and calls `onerror()` with no argument, so do not read the event arg. Copy the RESEARCH "Connection manager" block (L329-354) verbatim; URL must be exactly `"/api/stream/prices"` (harness test L49 asserts it). Statuses: OPEN 1, CONNECTING 0, CLOSED 2 (`EventSource.OPEN` etc. resolve on the stub via `globalThis.EventSource = FakeEventSource`).

### `src/lib/priceStore.ts` and `src/lib/usePrice.ts` (store/hook, pub-sub): NO ANALOG

Nothing in the tree uses `useSyncExternalStore` or a module singleton. Use RESEARCH "Store" (L277-310) and "Hook with server snapshot" (L316-323). Rules: `getServerSnapshot` mandatory (static-export prerender), stable `subscribe` via `useCallback([ticker])`, return the stored immutable entry, `reset()` exported for tests, clear-ticker function for remove (Pitfall 10). Follow codebase conventions: `"use client"` only on hooks/components, `@/` alias, docstring on each export, `UPPER_SNAKE` constants (`HISTORY_LIMIT`).

### `src/lib/portfolioValue.ts` (utility, transform)

**Analog:** `src/lib/format.ts` (short, pure, documented, `@/`-free). Single exported function with a one-line docstring:
`liveTotalValue(portfolio, getPrice) = cash_balance + sum(quantity * (getPrice(ticker) ?? position.current_price))`. Unit test as in `format.test.ts`.

### `src/lib/useWatchlist.ts` (hook, CRUD)

**Analog:** `Header.tsx` fetch effect (above) and `request()` in `src/lib/api.ts`:
```ts
export class ApiError extends Error { constructor(message: string, readonly status: number) ... }
export async function request<T>(path: string, init?: RequestInit): Promise<T>   // L8
```
Calls: `request<{tickers: Entry[]}>("/api/watchlist")`; add: `request("/api/watchlist", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ ticker }) })`; remove: `request(\`/api/watchlist/${encodeURIComponent(ticker)}\`, { method: "DELETE" })`, then always refetch. Distinguish `ApiError` (show `.message`, except 404 on remove shows nothing) from other errors (`Request failed. Try again.`). Seed the store by passing the REST payload keyed by ticker to `mergeFrame`.

### `src/components/Watchlist.tsx` and `WatchlistRow.tsx` (components, CRUD/pub-sub)

**Analog:** `Panel.tsx` (wrap in `<Panel title="Watchlist" testId={testIds.watchlist}>`) and `Header.tsx` `Figure` (small local presentational component plus tokens). Class strings come from UI-SPEC "Row anatomy": row `flex h-7 items-center gap-1 px-2`; ticker `min-w-0 flex-1 truncate font-semibold text-text`; change cell `figures w-16 shrink-0 whitespace-nowrap text-right` with `text-up|text-down|text-muted`; `ul aria-label="Watchlist tickers"`. Use `formatPrice` / `formatPercent` from `@/lib/format` (percent takes a fraction: `(price - open) / open`). All testids via `testIds.watchlistRow(t)`, `testIds.watchlistPrice(t)`, `testIds.watchlistRemove(t)`, `testIds.watchlistAddInput`, `testIds.watchlistAddButton` (already defined at `testIds.ts` L11-12, L29-31; add none). Wrap row in `React.memo`. Input `onChange` uppercases; no `maxLength`. States: loading text, `role="alert"` load error, empty state, per UI-SPEC copy table.

### `src/components/FlashingPrice.tsx` (component, event-driven): NO ANALOG

Copy RESEARCH "Flash element" (L360-363) plus UI-SPEC: `data-flash` attribute while flashing, `FLASH_HOLD_MS = 50`, literal class lookup, `motion-reduce:bg-transparent motion-reduce:transition-none`. Element carries `data-testid={testIds.watchlistPrice(ticker)}`, contents only `formatPrice(price)` or `--`.

### `src/components/Sparkline.tsx` (component, transform)

**Analog (import/usage only):** `src/test/harness.test.tsx` L3, L31-33:
```tsx
import { Line, LineChart, ResponsiveContainer } from "recharts";
<LineChart data={points}><Line dataKey="v" isAnimationActive={false} /></LineChart>
```
Differences required by UI-SPEC: no `ResponsiveContainer`; `<LineChart width={64} height={20} accessibilityLayer={false} margin={{top:0,right:0,bottom:0,left:0}}>`, hidden `YAxis domain={["dataMin","dataMax"]}`, `Line dot={false} strokeWidth={1.5}`, stroke `var(--color-up|down|muted)`. Under 2 points render an empty `64x20` div. Wrapper `aria-hidden="true" title="Since page load"`. jsdom renders the svg (harness test L41-44).

### `src/app/globals.css` (modify)

Analog L18: `html, body { height: 100%; background: var(--color-surface); color: var(--color-text); }`. Add `color-scheme: dark;` to that rule.

### `src/lib/format.ts` (modify, WR-01)

Line 5: `const cents = (n: number) => Math.round(n * 100) / 100 + 0;`. Per RESEARCH, drop the pre-round and only suppress negative zero; update the `format.test.ts` cases that lock old tie behavior (L12-24, e.g. `formatCurrency(0.005)` is `"$0.01"`, `-0.004` is `"$0.00"`, `-0.006` is `"-$0.01"`; negative-zero guard must stay).

### `vitest.setup.ts` (modify)

Analog L48-51; add store reset:
```ts
afterEach(() => {
  cleanup();
  FakeEventSource.instances = [];
  resetPriceStore();   // import from "@/lib/priceStore"
});
```
Check that `@/` alias resolves in the setup file (vitest config); otherwise use a relative `./src/lib/priceStore`.

### Tests

**Component test analog:** `src/components/Header.test.tsx`. Patterns to copy:
- Fetch stub (L8-12): `vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as Response)` with `vi.stubGlobal("fetch", ...)`; `afterEach(() => vi.unstubAllGlobals())`.
- Pending request: `vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))`.
- Assertions via `screen.getByTestId(testIds.x).textContent`, `waitFor`, `findByRole("alert")`, `toHaveBeenCalledWith("/api/portfolio", undefined)`.
- Updates required: stubs gain `positions: []` (L8, L25, L35, L71); replace test L41-48 ("starts disconnected", asserts `aria-label`) with `reconnecting` initial and `data-status` transitions via `FakeEventSource`.

**EventSource driving analog:** `src/test/harness.test.tsx` L1-6, L46-60:
```tsx
import type { FakeEventSource } from "../../vitest.setup";
const Fake = globalThis.EventSource as unknown as typeof FakeEventSource;
act(() => Fake.instances[0].emit({ AAPL: 1 }));
source.open(); source.fail(); source.fail(true);
```
Wrap emits/open/fail in `act()`. For flash/recreate-delay use `vi.useFakeTimers()` + `act(() => vi.advanceTimersByTime(...))` (RESEARCH Pitfall 8).

**Pure-lib test analog:** `src/lib/api.test.ts` (L1-16: `stubFetch` helper, `afterEach` unstub, `describe/it`; vitest globals are on, no `vitest` import needed there).

**Dashboard.test.tsx:** the fetch stub never resolves (L6-9), so tests stay valid; test at L26-30 ("no watchlist row testids") stays true while loading. Add an `h1` assertion `getByRole("heading", { level: 1 })`. The panel heading query `getByRole("heading", { name: "Watchlist" })` (L15) still matches only the `h2`.

**`src/test/fixtures.ts` (new):** builders `makeFrame()` / `makePortfolio()` modeled on the inline body in `Header.test.tsx` L25. Frame entry shape: `{ticker, price, previous_price, open_price, timestamp, change, change_percent, direction}`.

## Shared Patterns

### Fetch + error text
**Source:** `src/lib/api.ts` L1-13. **Apply to:** `usePortfolio`, `useWatchlist`. Never add another fetch wrapper; `ApiError.message` is the backend `{"error"}` text, render as JSX text only.

### Test ids
**Source:** `src/lib/testIds.ts`. **Apply to:** every component and test. Never string-literal an id; no new ids this phase; nothing but rows may use the `watchlist-row-` prefix.

### Number formatting
**Source:** `src/lib/format.ts` L17-21 (`formatCurrency`, `formatPrice`, `formatPercent` takes a fraction). **Apply to:** header, rows. Numeric testid elements hold only the bare formatted number; labels in siblings (Header `Figure`, L15-22).

### Design tokens and typography
**Source:** `src/app/globals.css` L3-20. Use `text-up|down|muted|accent`, `bg-up/25`, `bg-surface`, `border-line`, `bg-submit`, `.figures`; no raw hex, no `font-medium`. Full literal Tailwind class strings only.

### Client component convention
`"use client"` first line (Dashboard.tsx L1, Header.tsx L1); `@/` alias imports; docstring one-liner above each exported component (`/** Top bar: ... */`).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/priceStore.ts` | store | pub-sub | No external store exists; use RESEARCH L277-310 |
| `src/lib/usePrice.ts` | hook | pub-sub | No `useSyncExternalStore` use yet; RESEARCH L316-323 |
| `src/components/FlashingPrice.tsx` | component | event-driven | No transition/timer component yet; RESEARCH L360-363 + UI-SPEC |
| `src/lib/priceStream.ts` (lifecycle logic) | service | streaming | Only the test double exists; RESEARCH L329-354 |
| `src/test/fixtures.ts` | test util | n/a | Only inline stubs exist |

## Metadata

**Analog search scope:** `frontend/src/**`, `frontend/vitest.setup.ts` (16 tracked source/test files; all read except `layout.tsx`, `page.tsx`, `testIds.test.ts`, `format.test.ts` bodies).
**Pattern extraction date:** 2026-10-16
