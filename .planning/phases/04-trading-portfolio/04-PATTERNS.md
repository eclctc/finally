# Phase 4: Trading & Portfolio - Pattern Map

**Mapped:** 2026-10-16
**Files analyzed:** 31 (14 new source, 11 modified source, 6 new tests plus modified tests)
**Analogs found:** 29 / 31 (all analog paths verified git-tracked via `git ls-files`; all under `/Users/brett/Projects/finally/frontend/`)

All paths below are relative to `frontend/`. Recharts-specific excerpts (Treemap, LineChart axes) have no in-repo analog beyond `Sparkline`; use 04-RESEARCH.md Pattern 4/5 and 04-UI-SPEC.md for those.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/priceStore.ts` (M) | store | event-driven | itself (`applyTick`, `getHistory`) | exact (self) |
| `src/lib/usePrice.ts` (M, add `useTickerSeries`) | hook | pub-sub | `useTickerHistory` in same file | exact |
| `src/components/Sparkline.tsx` (M, slice 300) | component | transform | itself | exact (self) |
| `src/lib/format.ts` (M, add `formatSignedCurrency`, clocks, `signClass`) | utility | transform | itself (`formatCurrency`, `noNegativeZero`) | exact |
| `src/lib/portfolioValue.ts` (M, add `livePosition`) | utility | transform | `liveTotalValue` same file | exact |
| `src/lib/pnlSeries.ts` (N) | utility | transform | `src/lib/portfolioValue.ts` (pure helper + doc comment) | role-match |
| `src/lib/usePortfolio.ts` (M) | hook | request-response + poll | itself; `src/lib/useWatchlist.ts` for `load` + `useEffect` | exact |
| `src/lib/usePortfolioHistory.ts` (N) | hook | request-response + poll | `src/lib/usePortfolio.ts` | exact |
| `src/components/Dashboard.tsx` (M) | component (layout/state owner) | request-response | itself | exact (self) |
| `src/components/Header.tsx` (M, props instead of hook) | component | pub-sub | itself | exact (self) |
| `src/components/Watchlist.tsx` (M, selection props + default effect) | component | event-driven | itself | exact (self) |
| `src/components/WatchlistRow.tsx` (M, interactive row) | component | event-driven | itself | exact (self) |
| `src/components/MainChart.tsx` (N) | component | pub-sub (store) | `src/components/Sparkline.tsx` + `WatchlistRow.tsx` hooks | role-match |
| `src/components/TradeBar.tsx` (N) | component | request-response (POST) | `src/components/Watchlist.tsx` add form + `src/lib/useWatchlist.ts` `add` | role-match |
| `src/components/PositionsTable.tsx`, `PositionRow.tsx` (N) | component | pub-sub | `src/components/Watchlist.tsx` (states) + `WatchlistRow.tsx` (memo row) | role-match |
| `src/components/Heatmap.tsx`, `HeatmapTile.tsx` (N) | component | transform | `src/components/Sparkline.tsx` (Recharts mount) | partial |
| `src/components/PnlChart.tsx`, `ChartTooltip.tsx` (N) | component | pub-sub | `Sparkline.tsx` + `Header.tsx` (`usePriceVersion` + `liveTotalValue`) | role-match |
| `src/test/fixtures.ts` (M, add builders) | test util | n/a | itself | exact |
| `src/lib/usePortfolio.test.tsx` (N) | test | n/a | `src/components/Header.test.tsx` (fetch stub, timers) | role-match |
| `src/components/{TradeBar,PositionsTable,MainChart,PnlChart,Heatmap}.test.tsx`, `src/lib/pnlSeries.test.ts` (N) | test | n/a | `Watchlist.test.tsx`, `Sparkline.test.tsx` | role-match |
| Modified tests: `priceStore.test.ts`, `usePrice.test.tsx`, `Watchlist.test.tsx`, `Header.test.tsx`, `Dashboard.test.tsx`, `Sparkline.test.tsx`, `format.test.ts` | test | n/a | themselves | exact |

## Pattern Assignments

### `src/lib/priceStore.ts` (store, event-driven) - modify

**Analog:** itself. Current code to change:

`priceStore.ts` lines 6-8, 29, 40-44, 103-104:
```typescript
export const HISTORY_LIMIT = 300;
export const EMPTY_HISTORY: readonly number[] = Object.freeze([]);
const histories = new Map<string, readonly number[]>();
function applyTick(ticker: string, next: { price: number; openPrice: number; timestamp: number }, flash: Flash) {
  entries.set(ticker, { ...next, flash });
  histories.set(ticker, [...(histories.get(ticker) ?? []), next.price].slice(-HISTORY_LIMIT));
  notify(tickerListeners.get(ticker));
}
export const getHistory = (ticker: string) => histories.get(ticker) ?? EMPTY_HISTORY;
```
Change to `{ t: next.timestamp * 1000, price }` points, `HISTORY_LIMIT = 1200`, add `SPARKLINE_POINTS = 300`, `PricePoint`, `EMPTY_SERIES`, `getSeries` (RESEARCH Pattern 1). `resetPriceStore` (lines 130-138) already clears `histories`; unchanged. WR-03: `clearTicker` (86-92) is the optional fix site.

### `src/lib/usePrice.ts` (hook, pub-sub) - add `useTickerSeries`

**Analog:** `useTickerHistory`, lines 21-25:
```typescript
export function useTickerHistory(ticker: string): readonly number[] {
  const subscribe = useCallback((listener: () => void) => subscribeTicker(ticker, listener), [ticker]);
  return useSyncExternalStore(subscribe, () => getHistory(ticker), () => EMPTY_HISTORY);
}
```
Copy for `useTickerSeries` using `getSeries`/`EMPTY_SERIES`. Keep `useTickerHistory` returning `number[]` via `useMemo(() => series.map(p => p.price), [series])`. Import block (lines 1-13) is the barrel style to extend.

### `src/components/Sparkline.tsx` (transform) - modify (IN-04)

Lines 8-17 hold `strokeFor` and `data`. Slice first: `const recent = useMemo(() => history.slice(-SPARKLINE_POINTS), [history])`, then feed `recent` to `data`, `strokeFor`, and the `history.length >= 2` check. Test: add a 400-point case to `Sparkline.test.tsx` (pattern at lines 27-41, `lineOf(container)` stroke assertions).

### `src/lib/format.ts` (utility) - add formatters and `signClass`

**Analog:** lines 6-22:
```typescript
const noNegativeZero = (n: number) => (Math.abs(n) < 0.005 ? 0 : n);
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatCurrency = (n: number) => currency.format(noNegativeZero(n));
export const formatPercent = (fraction: number) => percent.format(fraction);
```
Add `formatSignedCurrency` (`signDisplay: "exceptZero"`, wrapped with `noNegativeZero`), `formatClock`, `formatDateClock`, and `signClass(value, displayed)` per RESEARCH "Formatters to add" and Pitfall 5. Keep the header comment rule: bare en-US numbers, fixed locale. Tests extend `format.test.ts`.

### `src/lib/portfolioValue.ts` (utility, transform) - add `livePosition`

**Analog:** `liveTotalValue`, lines 25-34 (pure function, `livePrice` fallback to `position.current_price`, doc comment). Add `livePosition(position, livePrice)` returning `{ price, marketValue, pnl, pnlFraction }` (RESEARCH Pattern 7). Types `PortfolioPosition`/`Portfolio` (lines 2-19) are reused unchanged. Extend `portfolioValue.test.ts`.

### `src/lib/pnlSeries.ts` (utility, transform) - new

**Analog:** `portfolioValue.ts` style (pure, doc-commented, exported constants). Contents from RESEARCH Pattern 8: `STARTING_CASH`, `PNL_POINTS`, `ValuePoint`, `downsample`, `buildPnlSeries`. Tail value must come from `liveTotalValue(portfolio, (t) => getEntry(t)?.price)` so it equals the header.

### `src/lib/usePortfolio.ts` (hook, request-response + poll) - modify

**Analog (current):** lines 6-22 (see file). Replace `useEffect(refresh, [refresh])` with a block body, add `POLL_MS`, `generation` ref, `setPortfolio`, derived `failed: failedLoad && portfolio === null`. Full code is in RESEARCH Pattern 2. Async-load idiom to copy from `useWatchlist.ts` lines 19-32:
```typescript
const load = useCallback(async () => {
  try {
    const { tickers: list } = await request<{ tickers: FrameEntry[] }>("/api/watchlist");
    ...
    setLoadFailed(false);
  } catch {
    setLoadFailed(true);
  }
}, []);
useEffect(() => {
  load();
}, [load]);
```

### `src/lib/usePortfolioHistory.ts` (hook, request-response + poll) - new

**Analog:** the new `usePortfolio` (same shape: state `T | null`, `refresh`, 30 s `setInterval` cleared on unmount). Map `snapshots.map(s => ({ t: Date.parse(s.recorded_at), value: s.total_value }))`. Import `request` from `./api`. Same silent-background-failure rule.

### `src/components/Dashboard.tsx` (layout/state owner) - modify

**Analog:** itself, lines 11-34. Keep `useEffect(() => connectPriceStream(), [])` and the grid classes; add `useState<string | null>` selection, call `usePortfolio()` and `usePortfolioHistory()`, pass props. Replace the empty `Panel`s (lines 21-25) while keeping the testids on Panels for Heatmap/P&L/Positions:
```tsx
<Panel title="Heatmap" testId={testIds.heatmap} />
<Panel title="P&L" testId={testIds.pnlChart} className="col-span-2" />
<Panel title="Positions" testId={testIds.positionsTable} className="col-span-3" />
```
`Panel title="Chart"` has no testid; `main-chart` goes on an inner wrapper (UI-SPEC deviation 8). `Panel.tsx` is NOT changed (lines 3-25; body is `min-h-0 flex-1 overflow-y-auto`).

### `src/components/Header.tsx` - modify

**Analog:** itself. Delete `usePortfolio()` call (line 24); accept `{ portfolio, failed }: { portfolio: Portfolio | null; failed: boolean }`. Keep `usePriceVersion()` (line 25), `liveTotalValue` use (line 26), `Figure` and the `failed &&` alert (lines 34-38) and testids exactly.

### `src/components/WatchlistRow.tsx` (event-driven) - modify

**Analog:** itself, lines 13-16 `changeColor` (replace with shared `signClass(change, formatPercent(change))`, closes WR-04), line 30 `li`, lines 40-50 remove button. Add props `selected`, `onSelect`; `li` gets `tabIndex={0}`, `onClick`, `onKeyDown` (Enter/Space only when `event.target === event.currentTarget`), `aria-current`, selected classes; remove button `onClick={(e) => { e.stopPropagation(); onRemove(ticker); }}`. Keep `memo(...)` (line 25); callbacks passed in must be stable.

### `src/components/Watchlist.tsx` - modify

**Analog:** itself. Add props `selectedTicker`, `onSelect`; thread to `WatchlistList` (lines 18-42) then `WatchlistRow` (line 38). Add the default/fallback effect from RESEARCH Pattern 3 next to the existing `useEffect` (lines 58-64). Do not lift `useWatchlist`. `handleRemove` uses `useCallback` (77-83), the pattern for stable callbacks.

### `src/components/MainChart.tsx` (component, pub-sub) - new

**Analog:** `Sparkline.tsx` (Recharts import line 4, `useMemo` data, `isAnimationActive={false}`, `strokeWidth={1.5}`, `dot={false}`, `var(--color-*)` strokes) and `WatchlistRow.tsx` lines 26-28 (store hooks per ticker). Split into outer wrapper (always mounted, `data-testid={testIds.mainChart}`, `data-ticker`) and `MainChartBody` taking a non-null ticker. Chart specifics from UI-SPEC "Main Chart Contract" and RESEARCH Pattern 4. Empty/loading lines use `py-12 text-center text-muted`, as `WatchlistEmpty` (Watchlist.tsx lines 9-16).

### `src/components/TradeBar.tsx` (component, request-response) - new

**Analog:** `Watchlist.tsx` add form for input/button classes and error line, and `useWatchlist.ts` for request + error mapping.

Class constants (`Watchlist.tsx` lines 44-47):
```typescript
const INPUT_CLASS =
  "h-7 min-w-0 flex-1 border bg-surface px-2 text-text placeholder:text-muted focus-visible:outline-2 outline-primary";
const BUTTON_CLASS =
  "h-7 bg-submit px-4 font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 outline-primary";
```
Input attrs and error line (`Watchlist.tsx` lines 90-120): `autoComplete="off"`, `autoCapitalize="characters"`, `spellCheck={false}`, `setDraft(event.target.value.toUpperCase())`, `<p role="alert" className="break-words px-2 pb-2 text-down">{error}</p>`. Border switching: `error ? "border-down" : "border-line focus:border-primary"`. Use `flex-1` buttons, `type="button"`, no `<form>` (D-03).

Error mapping (`useWatchlist.ts` lines 7-9, 38-50):
```typescript
const NETWORK_ERROR = "Request failed. Try again.";
const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : NETWORK_ERROR);
await request("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker }) });
... catch (err) { setError(errorMessage(err)); return false; } finally { setAdding(false); }
```
Export or share `errorMessage` rather than duplicating it. POST body/response shape and the `submit(side)` skeleton are in RESEARCH Pattern 6; ticker-prefill effect in Pitfall 2 (`hadSelection` ref). Focus management: `inputRef.current?.focus()` pattern from `Watchlist.tsx` line 74.

### `src/components/PositionsTable.tsx` / `PositionRow.tsx` (component, pub-sub) - new

**Analog:** `Watchlist.tsx` `WatchlistList` states (lines 25-42: `loadFailed` alert, `null` loading line, empty state, populated), and `WatchlistRow.tsx` (memo row subscribed with `useTickerPrice(ticker)`, `figures`, `whitespace-nowrap`). Alert/loading copy classes to copy:
```tsx
<p role="alert" className="break-words px-2 py-2 text-down">...</p>
<p className="px-2 py-2 text-muted">Loading watchlist...</p>
```
Row component: `memo`, `const entry = useTickerPrice(position.ticker)`, `livePosition(position, entry?.price)`, color via `signClass`. `<tr data-testid={testIds.positionRow(ticker)}>`. No click handler, no hover. Sort with `localeCompare`. Sticky head per RESEARCH Pattern 7.

### `src/components/Heatmap.tsx` / `HeatmapTile.tsx` - new

**Analog (partial):** `Sparkline.tsx` for Recharts import and `isAnimationActive={false}`; no Treemap analog exists. Use RESEARCH Pattern 5 and "Treemap tile renderer" / `tileFill` code verbatim. First task is the blocking spike test (`Heatmap.test.tsx`). Use nested `<svg>` for label clipping (not clipPath), `style={{ fill }}`.

### `src/components/PnlChart.tsx` / `ChartTooltip.tsx` - new

**Analog:** `Header.tsx` lines 25-26 for tail value:
```tsx
usePriceVersion();
const total = portfolio ? liveTotalValue(portfolio, (ticker) => getEntry(ticker)?.price) : undefined;
```
plus `Sparkline.tsx` Line props. `ChartTooltip` as a plain component (testable without hover).

## Test patterns

### Fixtures (`src/test/fixtures.ts`, lines 1-34)
Builders are plain arrow functions with doc comments; `jsonResponse(body, status)` at line 33 is the fetch-stub primitive:
```typescript
export const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;
```
Add `makePortfolio`, `makePosition`, `makeTradeResponse`, `makeSnapshot` here (Header.test.tsx lines 14-26 currently defines `AAPL_POSITION` and `makePortfolio` locally; move them).

### Component/fetch tests (`Watchlist.test.tsx` lines 1-24, `Header.test.tsx` lines 1-37)
```typescript
const stubWatchlist = (...entries) => vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ tickers: entries }))));
const streamTick = (ticker, price, openPrice) => act(() => mergeFrame(makeFrame(makeFrameEntry(ticker, price, 2, openPrice))));
afterEach(() => vi.unstubAllGlobals());   // Header adds vi.useRealTimers()
```
Pending state: `vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))`. Use `waitFor`, `findBy*`, `within(...)`, `userEvent`. For TradeBar include an `<img onerror>` text-node XSS test (Phase 3 T-03-11 style). Sparkline Probe pattern (`Sparkline.test.tsx` lines 10-15) is the template for store-driven chart tests.

### Existing tests that must change
Per RESEARCH impact table: `priceStore.test.ts` (limit 1200, `getSeries`), `usePrice.test.tsx` (`EMPTY_SERIES`), `Watchlist.test.tsx` (imports `EMPTY_HISTORY, getHistory` at line 5; 26 standalone renders need a `renderWatchlist()` helper with selection state), `Header.test.tsx` (prop fixtures replace fetch stubs; move fetch-count tests to `usePortfolio.test.tsx`), `Dashboard.test.tsx` (main-chart testid now always mounted; use `getAllByText` for the doubled loading line).

## Shared Patterns

### Backend request and error text
**Source:** `src/lib/api.ts` lines 1-13 (`ApiError`, `request<T>`). **Apply to:** `usePortfolio`, `usePortfolioHistory`, `TradeBar`. Never add a new fetch wrapper; backend `{"error"}` arrives as `ApiError.message`.

### Live store subscription
**Source:** `src/lib/usePrice.ts` (`useTickerPrice`, `useTickerSeries`, `usePriceVersion`). **Apply to:** `PositionRow`, `MainChart`, `PnlChart`, `Header`, `TradeBar` estimate. Per-ticker hooks for rows; `usePriceVersion` for aggregates.

### Live revaluation
**Source:** `src/lib/portfolioValue.ts` `liveTotalValue`. **Apply to:** Header, PnlChart tail, Heatmap values. One function so they match to the cent.

### Rounded-value color rule
**Source:** new `signClass` in `format.ts`. **Apply to:** `WatchlistRow` change cell, `PositionRow` P&L and P&L %, chart caption, P&L tooltip `vs start`.

### Panel and testids
**Source:** `src/components/Panel.tsx` (unchanged), `src/lib/testIds.ts` (all ids exist; add none). Panel testids stay on the three Panels; `main-chart` on the inner wrapper.

### Styling tokens
Tailwind token classes only (`bg-surface`, `bg-panel`, `border-line`, `text-muted`, `text-up`, `text-down`, `bg-submit`, `outline-primary`), `figures` for numbers, `whitespace-nowrap`; chart colors as `var(--color-*)` strings (see `Sparkline.tsx` line 11-12). No raw hex.

### Comments and style (project CLAUDE.md)
Short one-line `/** */` doc comments on exported functions/components, `"use client"` at top of components that use hooks, `@/` alias imports, no emojis.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/Heatmap.tsx` / `HeatmapTile.tsx` | component | transform | No Treemap or custom-SVG renderer exists; use RESEARCH Pattern 5 (spiked against recharts 3.10.1) |
| `src/components/MainChart.tsx` / `PnlChart.tsx` axis/tooltip/ReferenceLine config | component | pub-sub | Only the hidden-axis Sparkline exists; use UI-SPEC chart tables and RESEARCH Pattern 4 |

## Metadata

**Analog search scope:** `frontend/src/{components,lib,test}` (all 34 tracked source files listed via `git ls-files`)
**Files read:** Dashboard, Header, Panel, Watchlist, WatchlistRow, Sparkline, usePortfolio, useWatchlist, priceStore, usePrice, portfolioValue, format, api, fixtures, plus excerpts of Header.test, Watchlist.test, Sparkline.test
**Pattern extraction date:** 2026-10-16
