# Phase 4: Trading & Portfolio - Research

**Researched:** 2026-10-16
**Domain:** Frontend-only React 19 / Next.js 16 static export. Recharts 3.10.1 charts (main line chart, P&L line chart, Treemap heatmap), a trade bar, a positions table, and a shared portfolio source lifted into `Dashboard`. The backend is complete and is not modified.
**Confidence:** HIGH. The Treemap and LineChart contracts were exercised against the installed `recharts@3.10.1` in jsdom with the same 800x400 `ResizeObserver` stub as `vitest.setup.ts`. The backend response shapes and E2E selectors were read from source. MEDIUM for real-browser pixel behavior (not run: nested-`<svg>` clipping, sticky `<thead>`); both are covered by the approved UI-SPEC backstops.

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase (the user chose "Continue without context"). The locked inputs are the APPROVED UI design contract `.planning/phases/04-trading-portfolio/04-UI-SPEC.md` (status: approved 2026-10-16). Treat its D-01 and D-02 and every "user-confirmed" item as locked, and the rest of the spec as the approved contract.

### Locked Decisions
- **D-01 (confirmed by user):** Select the first watchlist ticker by default; the Trade ticker is prefilled from it.
- **D-02 (confirmed by user):** The store keeps timestamped `{t, price}` points capped at `HISTORY_LIMIT` 1,200 (10 min). The caption reads `Since page load` until full, then `Last 10 min`. The sparkline shows the last 300 points.
- User-confirmed (04 and 05 UI-SPEC, CLAUDE.md): the main chart keeps 1,200 timestamped points (10 min); the sparkline shows the last 300; Phase 4 has no row highlight and no `Panel` change; Phase 5 adds the `Panel` `actions` prop and `data-ai-changed`; the Heatmap Treemap `<rect>` spike is a BLOCKING first task of the heatmap plan.
- Stack (CLAUDE.md, PLAN.md): Next.js static export, Tailwind 4 tokens, Recharts only, TypeScript 7 with no ESLint, no new npm package.

### Claude's Discretion
- Shared state mechanism: "a context provider, or props; the implementation is the planner's choice" (04-UI-SPEC "Shared state placement").
- Everything else is specified by 04-UI-SPEC; this research recommends the least-churn implementation of it.

### Deferred Ideas (OUT OF SCOPE)
- Clicking a position row to select it (D-08). Enter-to-submit in the trade bar (D-03). Server-side history bucketing (DATA-V2-01). Realized P&L (PORT-V2-01). Heatmap tile interaction beyond the native `<title>`. Any Phase 5 chat work, including `data-ai-changed` and the `Panel` `actions` prop.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRADE-01 | Clicking a watchlist row selects it; the main chart shows price since page load with tooltips and `data-ticker` | `{t,price}` series in the store (Pattern 1), `MainChart` LineChart contract (Pattern 4), selection state + default/fallback rule (Pattern 3) |
| TRADE-02 | Selecting a ticker fills the trade bar's ticker field | TradeBar fill rule and the default-selection race (Pitfall 2) |
| TRADE-03 | Buy/sell a (fractional) quantity; buttons disabled in flight | TradeBar behavior (Pattern 6), trade request/response shape |
| TRADE-04 | A rejected trade shows the backend `{"error"}` inline | `request()`/`ApiError` already carry the backend text; verbatim error texts listed |
| TRADE-05 | After a trade, cash, positions and P&L update without reload | Use `response.portfolio` directly + `refreshHistory()` + stale-response guard (Pattern 2, Pitfall 1) |
| PORT-01 | Positions table, live price, unrealized P&L, % change, row disappears on close | `livePosition` pure helper, `PositionRow`, sort and sticky head (Pattern 7) |
| PORT-02 | Recharts Treemap heatmap of labeled `<rect>`s colored by P&L, with empty state | Treemap spike results and tile renderer (Pattern 5) |
| PORT-03 | P&L line chart from `/api/portfolio/history`, ~300 point downsample, tooltips, $10,000 baseline | `downsample`, series construction, LineChart contract (Pattern 8) |
| PORT-04 | Live tail point; history and portfolio refresh every 30 s | Live tail from `liveTotalValue`, 30 s poll in the hooks (Pattern 2) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Source: `/Users/brett/.claude/CLAUDE.md`, `/Users/brett/Projects/finally/CLAUDE.md`, `/Users/brett/Projects/finally/.claude/CLAUDE.md`.

- Be simple and incremental; do not over-engineer or program defensively; use exception handling only when needed.
- Short, clearly named functions and modules; docstring-style comments, sparing inline comments; no emojis in code, tests or logging.
- Frontend: TypeScript 7, **no ESLint**, Recharts for all charts, Tailwind 4 tokens, no new npm package (04-UI-SPEC "Registry Safety").
- Check commands: `npm --prefix frontend test`, `npm --prefix frontend run typecheck`, `npm --prefix frontend run build`, `cd backend && uv run pytest`. Do not use the auto-detected root `pyproject.toml`.
- Use `/usr/bin/grep` for GNU flags (shell `grep` may be ugrep). Never read or print `.env`.
- Do not stop the container `finally-p1` on :8000. Frontend dev port 3000 is busy locally; use `-p 3100`.
- Backend tests (145) must keep passing; this phase does not touch `backend/`.
- All file-changing work goes through a GSD command (this research is read-only apart from this file).
- GSD attribution lines on commits: end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Summary

Phase 4 is a pure-frontend phase on a stable base: 138 Vitest tests, typecheck and the Phase 3 store already pass (re-run this session: 13 files, 138 tests, about 1 s; `tsc --noEmit` clean). The backend already returns everything needed: `POST /api/portfolio/trade` returns `{trade, portfolio}`, `GET /api/portfolio/history` returns `{snapshots}`. No new package is required; `recharts@3.10.1` is installed and locked.

The single real technical risk, the Treemap custom renderer, is **resolved by a spike run this session**: the Recharts 3.10.1 `content` function receives the node props including your extra data fields; the root (`depth 0`, `name ""`) is passed to `content` too and must return an empty `<g>`; a `<rect>` returned from `content` is the first `svg rect` inside the heatmap (Treemap emits no `clipPath` or `defs` rect). The LineChart, by contrast, **does** emit a `clipPath` `<rect>` first, which is harmless because the E2E specs only look for `path.recharts-curve` in charts and `svg rect` in the heatmap. The planner must still make the spike a committed Vitest test as the first heatmap task (UI-SPEC gate), but it is expected to pass.

The real design risks are in state wiring, not charts: (1) a stale in-flight `GET /api/portfolio` overwriting the post-trade portfolio, (2) the default-selection effect overwriting a ticker the user (or Playwright `fill`) has just typed in the trade bar, (3) `Header` and `Watchlist` tests that render the components standalone and must be updated when they gain props, and (4) the store's `number[]` history becoming `{t, price}[]`, which touches three test files. Each has a cheap, concrete fix below.

**Primary recommendation:** Lift the portfolio and history hooks into `Dashboard` and pass them to `Header`, `TradeBar`, `PositionsTable`, `Heatmap` and `PnlChart` as plain props (all are direct children, so no context is needed); change the store to `{t, price}` at 1,200 points first (pure, unit-tested); build the Treemap spike test before any other heatmap work; and guard `refresh()` with a generation counter so a trade response is never overwritten by an older GET.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Execute a trade, validate cash/shares/ticker, record snapshot | API / Backend | — | `execute_trade_and_sync` already does it atomically; the client only submits and displays the error text |
| Live price series, selection, per-position revaluation | Browser / Client | — | Prices stream over SSE into the module-level store; P&L, % and tile areas are derived on the client at the live price |
| Portfolio and history fetch + 30 s poll | Browser / Client | API / Backend | Client polls two GETs; backend owns the data |
| P&L history downsampling and live tail | Browser / Client | — | Decided: client-side (DATA-V2-01 defers server bucketing) |
| Chart rendering (Line, Treemap) | Browser / Client | — | Recharts SVG, mounted only after data loads, so static prerender emits no chart |
| Static asset delivery | CDN / Static (FastAPI `StaticFiles`) | — | Unchanged from Phase 1 |
| Persistence of trades, positions, snapshots | Database / Storage | — | SQLite via backend; untouched |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.10.1 | `LineChart`, `Treemap`, `ResponsiveContainer`, `ReferenceLine`, `ReferenceDot`, `Tooltip` | Locked by PLAN.md ("Recharts only"); installed and in lockfile [VERIFIED: `frontend/package-lock.json` `"node_modules/recharts"` `"version": "3.10.1"`; `frontend/node_modules/recharts/package.json`] |
| react / react-dom | 19.3.1 | UI, `useSyncExternalStore` | Existing [VERIFIED: `frontend/package.json`] |
| next | 16.4.2 | Static export (`output: "export"`) | Existing |
| tailwindcss | 4.3.3 | Token classes (`bg-surface`, `text-up`, ...) | Existing; tokens in `src/app/globals.css` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest 5.0.5, @testing-library/react 16.3.3, user-event 14.6.8, jsdom 30.1.3 | as installed | Unit and component tests | All Phase 4 tests [VERIFIED: `frontend/package.json`] |
| @playwright/test 1.64.1 (in `test/`) | installed | Phase gate E2E against a rebuilt container | Final plan only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Props from `Dashboard` | React context | Every consumer is a direct child of `Dashboard`, so props are simpler and make `Header` tests trivial (no provider). Use context only if Phase 5 needs deep access. |
| Inline `style={{ fill }}` on tile `<rect>` | `fill` attribute | Both work in jsdom (verified `style.fill` keeps `color-mix(...)`). Inline style removes any doubt about CSS functions in presentation attributes. |

**Installation:** none. Do not install or upgrade anything.

**Version verification:** `recharts` resolved 3.10.1 from `frontend/node_modules/recharts/package.json` (`"version": "3.10.1"`) and lockfile. No registry query needed since no package is added.

## Package Legitimacy Audit

No external package is installed or upgraded in this phase, so the audit is not applicable.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none added) | — | — | — | — | n/a | n/a |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
SSE /api/stream/prices ──> priceStream ──> mergeFrame ──> priceStore (module-level)
                                                          ├─ entries[ticker] {price, openPrice, timestamp, flash}
                                                          └─ series[ticker]  [{t, price}] cap 1,200   <-- NEW shape
GET /api/watchlist ──> useWatchlist (inside Watchlist) ──> tickers, seedPrices
                                   │
                          default / fallback selection  ──> Dashboard.selectedTicker
                                                                  │
 Dashboard ──────────────────────────────────────────────────────┼──────────────────────────┐
   usePortfolio()        GET /api/portfolio  (mount + every 30 s)  │                          │
   usePortfolioHistory() GET /api/portfolio/history (mount + 30 s) │                          │
   │ portfolio, failed, refresh, setPortfolio │ history, failed, refresh                      │
   ├─> Header        (portfolio, failed)  -> total-value (liveTotalValue), cash-balance       │
   ├─> TradeBar      (selectedTicker, setPortfolio, refreshHistory)                           │
   │      click Buy/Sell ─> POST /api/portfolio/trade ─> {trade, portfolio}                   │
   │         ok  : setPortfolio(response.portfolio); refreshHistory(); "Filled ..." line      │
   │         400 : trade-error = backend {"error"} text                                       │
   ├─> PositionsTable(portfolio) ─ PositionRow ─ livePosition(position, store price)          │
   ├─> Heatmap(portfolio)  ─ live market values ─> Treemap ─ content(tile)=<g><rect/><text/>  │
   ├─> PnlChart(history, portfolio) ─ downsample(300) + live tail ─> LineChart                │
   └─> MainChart(selectedTicker) <── useTickerSeries(ticker) <── priceStore.series  <─────────┘
```

### Recommended Project Structure
```
frontend/src/
├── lib/
│   ├── priceStore.ts          # CHANGE: {t, price} series, HISTORY_LIMIT 1200, SPARKLINE_POINTS 300
│   ├── usePrice.ts            # ADD useTickerSeries; useTickerHistory maps series -> prices
│   ├── usePortfolio.ts        # CHANGE: setPortfolio, 30 s poll, stale guard, failed only without data
│   ├── usePortfolioHistory.ts # NEW: snapshots -> {t,value}[], 30 s poll, refresh
│   ├── portfolioValue.ts      # ADD livePosition(); keep liveTotalValue
│   ├── pnlSeries.ts           # NEW: STARTING_CASH, downsample, buildPnlSeries (pure)
│   ├── format.ts              # ADD formatSignedCurrency, time formatters, signClass
│   └── tradeApi.ts (optional) # postTrade(); or inline in TradeBar
└── components/
    ├── Dashboard.tsx          # CHANGE: owns selection + portfolio + history; passes props
    ├── Header.tsx             # CHANGE: props {portfolio, failed}; no fetch
    ├── Watchlist.tsx, WatchlistRow.tsx  # CHANGE: selection props, default/fallback effect
    ├── MainChart.tsx, TradeBar.tsx, PositionsTable.tsx, PositionRow.tsx,
    ├── Heatmap.tsx (+ HeatmapTile.tsx), PnlChart.tsx, ChartTooltip.tsx
```

### Pattern 1: Store change to `{t, price}` (D-02)
**What:** `histories` becomes `Map<string, readonly PricePoint[]>`; `HISTORY_LIMIT` becomes 1200; the frame `timestamp` is Unix seconds, so `t = timestamp * 1000`.
**Verbatim current code to change:** [VERIFIED: `frontend/src/lib/priceStore.ts:6-8`] `export const HISTORY_LIMIT = 300;` and `export const EMPTY_HISTORY: readonly number[] = Object.freeze([]);`; [VERIFIED: `priceStore.ts` `applyTick`] `histories.set(ticker, [...(histories.get(ticker) ?? []), next.price].slice(-HISTORY_LIMIT));`.
```typescript
export const HISTORY_LIMIT = 1200;       // 10 min at the 500 ms cadence
export const SPARKLINE_POINTS = 300;
export interface PricePoint { t: number; price: number }
export const EMPTY_SERIES: readonly PricePoint[] = Object.freeze([]);

function applyTick(ticker: string, next: {...}, flash: Flash) {
  entries.set(ticker, { ...next, flash });
  const point = { t: next.timestamp * 1000, price: next.price };
  histories.set(ticker, [...(histories.get(ticker) ?? []), point].slice(-HISTORY_LIMIT));
  notify(tickerListeners.get(ticker));
}
export const getSeries = (ticker: string) => histories.get(ticker) ?? EMPTY_SERIES;
```
`usePrice.ts`: add `useTickerSeries(ticker)` identical to `useTickerHistory` but with `getSeries`/`EMPTY_SERIES`. Keep `useTickerHistory` returning `number[]` as `useMemo(() => series.map((p) => p.price), [series])` so `WatchlistRow` and the `Sparkline` prop type stay unchanged. The snapshot passed to `useSyncExternalStore` stays the stable store array (the mapping happens outside it).
**Sparkline (committed requirement, closes IN-04):** slice inside the component: `const recent = history.slice(-SPARKLINE_POINTS)` before drawing and before `strokeFor`. Test with a 400-point prop whose first 100 points would flip the color.
**Cost:** 10 tickers x 2 Hz x a 1,200-element copy is negligible.

### Pattern 2: Lifted portfolio source with 30 s poll and a stale-response guard
**What:** `Dashboard` calls `usePortfolio()` and `usePortfolioHistory()` once. Verbatim current hook: [VERIFIED: `frontend/src/lib/usePortfolio.ts`] `useEffect(refresh, [refresh]);` and `export function usePortfolio() {` returning `{ portfolio, failed, refresh }`.
```typescript
export const POLL_MS = 30_000;

export function usePortfolio() {
  const [portfolio, setPortfolioState] = useState<Portfolio | null>(null);
  const [failedLoad, setFailedLoad] = useState(false);
  const generation = useRef(0);

  /** Trade responses are newer than any GET already in flight. */
  const setPortfolio = useCallback((next: Portfolio) => {
    generation.current += 1;
    setPortfolioState(next);
    setFailedLoad(false);
  }, []);

  const refresh = useCallback(async () => {
    const started = generation.current;
    try {
      const next = await request<Portfolio>("/api/portfolio");
      if (generation.current !== started) return;
      setPortfolioState(next);
      setFailedLoad(false);
    } catch {
      setFailedLoad(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { portfolio, failed: failedLoad && portfolio === null, refresh, setPortfolio };
}
```
Notes: (a) `useEffect(refresh, [refresh])` must NOT be kept once `refresh` returns a promise: React would treat the promise as a cleanup function. Wrap in a block body as above. (b) `failed` is derived (`failedLoad && portfolio === null`), which implements Deviation #3/D-07 (a failed background refresh is silent) in one line. (c) `usePortfolioHistory` is the same shape: state `HistoryPoint[] | null`, mapping `snapshots.map((s) => ({ t: Date.parse(s.recorded_at), value: s.total_value }))`, a 30 s interval, and a returned `refresh` (Phase 5 and the trade call it as `refreshHistory`). A last-request-wins guard (counter compare) is also advisable here for the same reason (trade `refreshHistory()` racing the poll), but the cost of a stale history is only one poll interval.

### Pattern 3: Selection state, default, and fallback
**Where:** `Dashboard` owns `const [selectedTicker, setSelectedTicker] = useState<string | null>(null)`. `Watchlist` keeps `useWatchlist()` (it already owns membership) and gets two new props, `selectedTicker` and `onSelect`. One effect covers both the D-01 default and the "selected ticker removed" fallback:
```typescript
useEffect(() => {
  if (tickers === null) return;
  if (selectedTicker === null || !tickers.includes(selectedTicker)) onSelect(tickers[0] ?? null);
}, [tickers, selectedTicker, onSelect]);
```
`WatchlistRow` gets `selected: boolean` and `onSelect`. Row contract per UI-SPEC: `tabIndex={0}`, `onClick`, `onKeyDown` (Enter or Space only when `event.target === event.currentTarget`), `aria-current={selected ? "true" : undefined}`, remove button calls `event.stopPropagation()`. Keep `memo`; `setSelectedTicker` is a stable callback.
Do **not** lift `useWatchlist` to `Dashboard` in Phase 4: `Watchlist.test.tsx` renders `<Watchlist />` standalone 26 times. Phase 5's UI-SPEC refreshes the watchlist through `useWatchlist.load`; that lift belongs to Phase 5.

### Pattern 4: MainChart (LineChart, time axis)
Verified in jsdom against 3.10.1: `path.recharts-curve` is present on the `Line` (class `recharts-curve recharts-line-curve`); `ReferenceLine ifOverflow="extendDomain"` extended the auto Y domain to include a far-away `y` (ticks `150, 165, 180, 195` for data 190-194 with `y={150}`); `ReferenceLine label={{ value: "Open", position: "insideTopLeft" }}` rendered the text `Open`; `ReferenceDot` rendered; `XAxis type="number" scale="time" domain={["dataMin","dataMax"]}` with a `tickFormatter` rendered formatted labels; the Tooltip `content` function is called with `active`, `payload`, `label`, `coordinate`, `accessibilityLayer`, `activeIndex`. The default `accessibilityLayer` adds `role="application" tabindex="0"` on the `<svg>`.
```tsx
<div data-testid={testIds.mainChart} data-ticker={selectedTicker ?? undefined} className="flex h-full min-h-0 flex-col">
  {selectedTicker && <MainChartBody ticker={selectedTicker} />}   {/* else the "Select a ticker..." line */}
</div>
```
`MainChartBody` calls `useTickerSeries(ticker)` and `useTickerPrice(ticker)`, so it needs a non-null ticker (hooks cannot take null); this is why the body is a separate component. Pass the store array straight to `data` (stable reference between ticks). Y tick format: `formatPrice`; X tick format: `HH:MM:SS` via the formatter in Code Examples. The caption `window text` is `series.length < HISTORY_LIMIT ? "Since page load" : "Last 10 min"`. "Waiting for price data." when `series.length < 2`.
**Test limits in jsdom:** axis tick text renders (verified: labels such as `08:53:20` and `150` appeared as `<text class="recharts-text recharts-cartesian-axis-tick-value">`, in a separate layer, so query `text`, not `.recharts-xAxis .tick-value`). Hover tooltips are not reliably driven in jsdom; unit-test `ChartTooltip` as a plain component with a hand-built `payload` instead.

### Pattern 5: Treemap heatmap with a custom `<rect>` renderer (the research flag)
**Spike result (run this session against the installed 3.10.1, jsdom, 800x400 stub, `ResponsiveContainer` + `Treemap`, `content` as a function):**
- `content` is called for the root and for every leaf. Root: `depth: 0`, `name: ""`, `x:0 y:0 width:800 height:400`, `value` = sum, **no custom fields**. Leaves: `depth: 1`.
- Leaf props include your extra data fields verbatim (`pnlFraction`, `marketValue`) plus `name`, `value`, `x`, `y`, `width`, `height`, `index`, `depth`, `tooltipIndex`, `area`, `root`, `isAnimationActive`. Verbatim key list seen for a leaf: `id,width,height,name,value,pnlFraction,marketValue,children,depth,index,tooltipIndex,area,x,y,root,isAnimationActive,isUpdateAnimationActive`.
- Rendering `<g/>` for `depth 0` and `<g><title/><rect/><text/></g>` for `depth 1` gave `svg rect` count 2 for 2 positions and the **first** `svg rect` was the first tile rect (`<rect x="0" y="0" width="600" height="400" ...>`). The Treemap emits no `clipPath`/`defs` rect (the Surface contains only `<title></title><desc></desc>` then the node groups). Text content was `['JPM','AAPL']`.
- `TreemapNode` types the extras as `unknown` (`[k: string]: unknown`), so cast: `props.pnlFraction as number`. `content` function type is `(props: TreemapNode) => React.ReactElement` [VERIFIED: `recharts/types/chart/Treemap.d.ts` `export type TreemapContentType = ReactNode | ((props: TreemapNode) => React.ReactElement);`].
- Tile `key` is `recharts-treemap-node-${x}-${y}-${name}`, so a tile whose position shifts after a price tick remounts. Harmless with `isAnimationActive={false}`.
- A node with `value <= 0` or NaN is laid out with zero area, so it has a 0-width rect and fails `toBeVisible()`. Market value of a held position is positive, so this is not reachable; keep it in mind if a zero-value position ever appears.
- `Treemap` returns `null` until the measured width and height are positive; Playwright's retrying `toBeVisible()` absorbs that. In jsdom the stub supplies 800x400 immediately.
- Static prerender: `renderToString` of `ResponsiveContainer` + `LineChart` / `Treemap` emits an empty sized `<div>`, no error (verified). Charts also only mount after data loads.
**Do not clip with `<clipPath>`:** its `<rect>` would sit in `<defs>` with an empty bounding box and could become the `.first()` rect (fails `toBeVisible`). Use a nested `<svg x y width height>` (overflow hidden by default) for the text, placed AFTER the tile `<rect>`. Coordinates inside a nested `<svg>` are relative to its own origin, so the ticker `<text>` goes at `(8, 20)` and the percent at `(8, 36)`, not at `x + 8`.
**Fill:** use `style={{ fill }}`; jsdom keeps `color-mix(in srgb, var(--color-up) 20%, var(--color-line))` in `style.fill` (verified).
**Required committed spike test (first heatmap task):** render `Heatmap` with two positions and assert (1) `container.querySelector("svg rect")` is a tile rect with `width > 0`, (2) no rect has `width === 800 && height === 400` for the two-position case (root suppressed), (3) the heatmap text contains each ticker, (4) the P&L `<text>` is absent for a tile smaller than 64x40, (5) the extra fields reach the renderer (fill differs for a gain and a loss).

### Pattern 6: TradeBar
Verified backend contract [VERIFIED: `backend/app/routes/portfolio.py`]: `return {"trade": trade_summary(executed), "portfolio": get_portfolio(conn, cache)}` where `trade_summary` returns the `Trade` dataclass fields except `user_id`; fields of `Trade` [VERIFIED: `backend/app/db/models.py`]: `id, user_id, ticker, side, quantity, price, executed_at`. So the response `trade` has `id, ticker, side, quantity, price, executed_at`. Request body model [VERIFIED: same file]: `class TradeRequest(BaseModel): ticker: str; quantity: float; side: str`.
Error texts (HTTP 400 `{"error": ...}`) [VERIFIED: `backend/app/services/portfolio.py`]: `f"Side must be 'buy' or 'sell', got {side!r}"`, `"Quantity must be greater than zero"`, `f"Unknown ticker: {ticker}"`, `f"Insufficient cash: need ${cost:,.2f}, have ${cash:,.2f}"`, `f"Insufficient shares: selling {quantity:g} {ticker}, hold {held:g}"`. A malformed body gives 400 with a `field: msg` string [VERIFIED: `backend/app/routes/error_handlers.py`]. A `MarketDataError` gives 503 `{"error": "Market data unavailable, try again"}`. The frontend `request()` already turns any `{"error"}` body into `ApiError.message` and maps non-JSON to `Request failed (status)`; a `fetch` rejection (non-`ApiError`) maps to `Request failed. Try again.` (same `errorMessage` rule as `useWatchlist`).
```typescript
async function submit(side: "buy" | "sell") {
  setInFlight(true); setMessage(null);
  try {
    const { trade, portfolio } = await request<TradeResponse>("/api/portfolio/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: ticker.trim(), side, quantity: Number(quantity) }),
    });
    setPortfolio(portfolio);
    refreshHistory();
    setQuantity("");
    setMessage({ kind: "filled", text: `Filled ${trade.side.toUpperCase()} ${formatQuantity(trade.quantity)} ${trade.ticker} @ ${formatPrice(trade.price)}` });
  } catch (err) {
    setMessage({ kind: "error", text: errorMessage(err) });
  } finally {
    setInFlight(false);
    quantityRef.current?.focus();
  }
}
```
- `disabled={inFlight || !canTrade}` on both buttons. React flushes discrete click updates synchronously, so a disabled button cannot fire a second click; no extra ref guard is needed.
- Ticker is sent as typed, trimmed; the backend uppercases (`normalize_ticker` = `strip().upper()`), and the input also uppercases as typed.
- `Number("")` is 0, `Number("1e3")` is 1000, `Number("Infinity")` is not finite, so the rule `Number.isFinite(q) && q > 0` matches UI-SPEC. `Number("0x10")` is 16 (and `Number(" 5 ")` is 5): accepted quirks, not worth defensive code.
- Container is a `div role="group" aria-label="Trade order"`, not a `<form>`; Buy/Sell are `type="button"`; no Enter handling.
- The success line text must come from the response `trade` (price is the backend fill price), rendered as a React text node.

### Pattern 7: PositionsTable / PositionRow / `livePosition`
`PositionRow` subscribes to its own ticker with `useTickerPrice(position.ticker)` (re-renders only on that ticker, like `WatchlistRow`) and uses `entry?.price ?? position.current_price` (partial-price fallback; also tolerates WR-03). Pure helper next to `liveTotalValue` [VERIFIED: `frontend/src/lib/portfolioValue.ts` exports `PortfolioPosition` with fields `ticker, quantity, avg_cost, current_price, market_value, unrealized_pnl, pnl_percent` and `liveTotalValue(portfolio, livePrice)`]:
```typescript
export function livePosition(position: PortfolioPosition, livePrice: number | undefined) {
  const price = livePrice ?? position.current_price;
  const marketValue = position.quantity * price;
  const pnl = marketValue - position.quantity * position.avg_cost;
  return { price, marketValue, pnl, pnlFraction: position.avg_cost === 0 ? 0 : (price - position.avg_cost) / position.avg_cost };
}
```
Sort by ticker ascending with `localeCompare` (the API order is not specified). Sticky head: put `sticky top-0 bg-panel` on the `<th>` cells (sticky on `<th>` is the portable form) and prefer `border-separate border-spacing-0` over `border-collapse`, because borders of sticky cells in a collapsed-border table scroll away with the body [ASSUMED: well-known CSS behavior, not exercised here; the UI-SPEC backstop "header stays pinned" covers it visually].

### Pattern 8: PnlChart series (pure functions)
```typescript
export const STARTING_CASH = 10_000;
export const PNL_POINTS = 300;
export interface ValuePoint { t: number; value: number }

/** Keep the first and last point; indices are distinct whenever n > target. */
export function downsample<T>(items: readonly T[], target = PNL_POINTS): T[] {
  if (items.length <= target) return [...items];
  return Array.from({ length: target }, (_, i) => items[Math.round((i * (items.length - 1)) / (target - 1))]);
}

/** History downsampled, plus a live tail at the header's total (never earlier than the last snapshot). */
export function buildPnlSeries(history: readonly ValuePoint[], totalNow: number | undefined, now: number): ValuePoint[] {
  const points = downsample(history);
  if (totalNow === undefined) return points;
  const lastT = points.at(-1)?.t ?? now;
  return [...points, { t: Math.max(now, lastT), value: totalNow }];
}
```
Verified by brute force: for every `n` from 301 to 20,000 the 300 indices are distinct and include `0` and `n-1` (0 failures). Seven days of 30 s snapshots is 20,160 rows, so the history response can reach roughly 1.5 MB every 30 s (about 75 bytes per row, estimated). Acceptable locally; DATA-V2-01 is the deferred fix. `Date.parse` of the backend timestamp works on 6-digit fractions in V8: `Date.parse("2026-10-16T21:00:59.139123+00:00")` returned `1792184459139` [VERIFIED: node run this session]; the backend timestamp format is `datetime.now(timezone.utc).isoformat()` [VERIFIED: `backend/app/db/connection.py` `now_iso`]. Safari/Firefox parsing of 6-digit fractions was not tested [ASSUMED].
The tail is recomputed on each price tick: `usePriceVersion()` in `PnlChart`, `useMemo` for the downsampled history keyed on `history`, then append the tail per render. Tail value uses `liveTotalValue(portfolio, (t) => getEntry(t)?.price)`, the same function as the header, so the two match to the cent.

### Anti-Patterns to Avoid
- **`useEffect(refresh, [refresh])` with an async `refresh`:** returns a promise as the cleanup function. Use a block body.
- **Seeding the trade ticker with an unconditional effect on `selectedTicker`:** can overwrite typed text (Pitfall 2).
- **`clipPath` for heatmap labels:** puts a `<rect>` in `<defs>` that can be matched by `svg rect`.
- **`border-collapse` with a sticky head:** borders do not stick.
- **Computing color from the unrounded value:** closes WR-04 incorrectly (Pitfall 5).
- **Using the API `unrealized_pnl` / `pnl_percent` for display:** they are a fetch-time snapshot; derive from the live price.
- **Putting `Date.now()` in a store or module scope:** it is only read inside `useMemo` per render.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Squarified treemap layout | Your own packing | Recharts `Treemap` with `content` | Layout, node geometry and `value` summing are done for you |
| Number, currency and signed formatting | `toFixed` / manual sign | `Intl.NumberFormat` (`signDisplay: "exceptZero"`) | Rounding half away from zero; verified `0.001 -> $0.00`, `-0.005 -> -$0.01` |
| Time labels | Manual `padStart` clock math | `Intl.DateTimeFormat` with `hourCycle: "h23"` | Local time, no `24:00` bug (verified `00:05:03`) |
| Request + backend error text | New fetch wrapper | Existing `request<T>()` and `ApiError` in `src/lib/api.ts` | Already maps `{"error"}`; reused by `useWatchlist` |
| Live total | A second revaluation formula | `liveTotalValue` | Tail and header must match to the cent |
| External store subscription | A context re-render per tick | `useSyncExternalStore` hooks | Already the Phase 3 design |

**Key insight:** every hard piece (layout, rounding, error mapping, revaluation) already exists in a library or in Phase 3 code; the work is wiring plus tests.

## Runtime State Inventory

Not a rename/refactor/migration phase: omitted. (Store reshaping affects in-memory module state only; nothing persists client-side, and no database, service, OS, secret or build artifact name changes.)

## Common Pitfalls

### Pitfall 1: A stale GET overwrites the post-trade portfolio
**What goes wrong:** The 30 s poll (or the mount fetch) starts before a trade; its response arrives after `setPortfolio(response.portfolio)` and rewinds cash and positions until the next poll. `selling an entire position removes it` then flaps.
**Why:** Two writers to one state with unordered responses.
**How to avoid:** generation counter in `usePortfolio` (Pattern 2); `setPortfolio` bumps it, `refresh` discards a result whose start generation is stale. Unit-test with a deferred fetch.
**Warning signs:** A closed position reappears for up to 30 s.

### Pitfall 2: Default selection overwrites a typed trade ticker (E2E race)
**What goes wrong:** `trading.spec.ts` does `page.goto("/")`, waits only for cash, then `fill("MSFT")`. If `GET /api/watchlist` settles after the fill, the D-01 default selection effect sets the field to `AAPL`, and the test buys 2 AAPL and fails on `position-row-MSFT`. Portfolio and watchlist fetches race; the window is small but real.
**How to avoid:** Fill the field on every selection change **except** the first selection ever made (null to default), which fills only if the field is still empty:
```typescript
const hadSelection = useRef(false);
useEffect(() => {
  if (selectedTicker === null) return;
  setTicker((typed) => (hadSelection.current || typed === "" ? selectedTicker : typed));
  hadSelection.current = true;
}, [selectedTicker]);
```
Also clear the trade message on a selection change (UI-SPEC). Known limit: clicking the row that is already selected after typing a different ticker does not refill (no state change). Accept it, or have `Dashboard` bump a `selectionNonce` on every click. Flagged in Open Questions.

### Pitfall 3: Standalone component tests break when props are added
**What goes wrong:** `Header.test.tsx` renders `<Header />` 11 times with fetch stubs; `Watchlist.test.tsx` renders `<Watchlist />` 26 times.
**How to avoid:** See "Existing tests that must change". Convert Header tests to pass `portfolio`/`failed` props; give Watchlist tests a `renderWatchlist()` helper that holds selection state. Move the fetch-count assertions (`toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith("/api/portfolio", undefined)`) into a new `usePortfolio.test.tsx`.

### Pitfall 4: Treemap root rectangle and `.first()`
**What goes wrong:** Returning a rect for `depth 0` draws a full-size root rect that is the first `svg rect` and hides tiles; or using the default renderer yields `<path>`, so `svg rect` finds nothing.
**How to avoid:** Pattern 5; test (2) in the spike test asserts there is no full-size rect.

### Pitfall 5: Rounded-value color rule (WR-04)
**What goes wrong:** `-0.004` colors red but shows `$0.00`; float edge cases make `Math.round`/`toFixed` disagree with `Intl` (`Math.round(-0.5)` is `-0` while `Intl` gives `-0.01`).
**How to avoid:** Decide the color from the **formatted text**: the cell is muted when the displayed text contains no digit `1-9`; otherwise the sign of the raw value picks up/down. One helper shared by positions, the chart caption, the `vs start` row and `WatchlistRow` (Deviation #6):
```typescript
export const signClass = (value: number, displayed: string) =>
  !/[1-9]/.test(displayed) ? "text-muted" : value > 0 ? "text-up" : "text-down";
```
Note `WatchlistRow` currently has its own `changeColor` [VERIFIED: `frontend/src/components/WatchlistRow.tsx`] `if (change === undefined || change === 0) return "text-muted";`; replace it with the shared helper. Pin it with a test: `formatPercent(0.00004)` and `formatPercent(-0.00004)` both display `0.00%` [VERIFIED: node run], so both must be `text-muted`, while `0.0123` displays `+1.23%` and is `text-up`.

### Pitfall 6: ResponsiveContainer with no definite height
**What goes wrong:** An unsized parent makes Recharts warn about width/height 0 and render nothing in a real browser (jsdom hides it because the stub reports 800x400).
**How to avoid:** Every chart sits in `relative h-full min-h-0 overflow-hidden` (UI-SPEC). The Panel body is `min-h-0 flex-1 overflow-y-auto`; check the Playwright run with a screenshot at 1280x720.

### Pitfall 7: Recharts clip `<rect>` in LineCharts
`LineChart` renders a `clipPath` `<rect>` first (verified: `<rect x="0" y="8" height="362" width="736">`). The only `svg rect` assertion in the specs is on the heatmap, so this is harmless; do not add a `svg rect` assertion for the line charts.

### Pitfall 8: Store reshaping ripples
`getHistory`/`EMPTY_HISTORY` are used by `priceStore.test.ts`, `usePrice.test.tsx` and `Watchlist.test.tsx` (see table). Do the store change as its own first plan with those tests updated in the same commit so the suite stays green.

### Pitfall 9: Dashboard test asserts the absence of the main-chart testid
`Dashboard.test.tsx` "attaches no watchlist row testids and no main chart testid yet" will fail once `main-chart` is mounted in every state. Update it (UI-SPEC: wrapper always mounted, `data-ticker` omitted when nothing is selected).

## Code Examples

### Treemap tile renderer
```tsx
// Source: spike run against recharts 3.10.1 in this session; UI-SPEC "Heatmap Contract"
import type { TreemapNode } from "recharts"; // type is exported from the package types
function renderTile(props: TreemapNode) {
  if (props.depth === 0) return <g />;
  const { x, y, width, height, name } = props;
  const pnlFraction = props.pnlFraction as number;
  const marketValue = props.marketValue as number;
  const showPercent = width >= 64 && height >= 40;
  return (
    <g>
      <title>{`${name}  ${formatCurrency(marketValue)}  ${formatPercent(pnlFraction)}`}</title>
      <rect x={x} y={y} width={width} height={height} style={{ fill: tileFill(pnlFraction) }}
            stroke="var(--color-surface)" strokeWidth={1} />
      <svg x={x} y={y} width={width} height={height}>
        <text x={8} y={20} fontSize={13} fontWeight={600} fill="var(--color-text)">{name}</text>
        {showPercent && <text x={8} y={36} fontSize={11} fill="var(--color-text)">{formatPercent(pnlFraction)}</text>}
      </svg>
    </g>
  );
}
// <Treemap data={data} dataKey="value" nameKey="name" isAnimationActive={false} content={renderTile} />
```
`TreemapNode` is re-exported from the package root [VERIFIED: `frontend/node_modules/recharts/types/index.d.ts:98` `export type { Props as TreemapProps, TreemapNode, TreemapContentType } from './chart/Treemap';`].

### Tile fill (UI-SPEC color rule)
```typescript
export function tileFill(pnlFraction: number): string {
  const mix = 40 * Math.min(Math.abs(pnlFraction) / 0.05, 1);
  if (mix === 0) return "var(--color-line)";
  const side = pnlFraction > 0 ? "up" : "down";
  return `color-mix(in srgb, var(--color-${side}) ${mix}%, var(--color-line))`;
}
```

### Formatters to add to `format.ts`
```typescript
const signedCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", signDisplay: "exceptZero" });
export const formatSignedCurrency = (n: number) => signedCurrency.format(noNegativeZero(n));

const clock = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const dateClock = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
export const formatClock = (t: number) => clock.format(t);          // 14:32:05
export const formatDateClock = (t: number) => dateClock.format(t);  // Oct 16, 14:32:05
```
Verified in node: `formatSignedCurrency` outputs `+$12.34`, `-$12.34`, `$0.00` (for 0, 0.001, -0.001), `-$0.01` (for -0.005), `+$1,234.50`; `clock.format(new Date(2026,9,16,0,5,3))` is `00:05:03`; `dateClock` gives `Oct 16, 14:32:05`; `hour12: false` also gave `00:05:03` here but `hourCycle: "h23"` is the portable form. The P&L X axis uses `HH:MM` (`{hour, minute, hourCycle}`) under 24 h and `{month:"short", day:"numeric"}` (`Oct 16`) otherwise (also verified).

### Chart tooltip as a plain component (testable without hover)
```tsx
export function ChartTooltip({ active, payload, title, rows }: ...) {
  if (!active || !payload?.length) return null;
  ...
}
// <Tooltip isAnimationActive={false} cursor={{ stroke: "var(--color-line)" }}
//          content={(p) => <PnlTooltip active={p.active} payload={p.payload} />} />
```
Recharts passes `payload[0].payload` as the data row (`{t, price}` or `{t, value}`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Treemap default content renders `<path>` (Rectangle) | Pass `content` as a function returning SVG; root (`depth 0`) is also passed | Recharts 3.x | Must suppress the root; nodes carry your data fields |
| Recharts 2 chart `isAnimationActive` default true | Set `isAnimationActive={false}` explicitly (Treemap default is `"auto"`) | Recharts 3 | Avoids transform animation on tiles |
| Recharts 3 `accessibilityLayer` default true | Keep it for the two main charts; sparkline sets it false | Recharts 3 | `svg role="application" tabindex="0"` |

**Deprecated/outdated:** `animationId` on Treemap ("unused prop ... use `key`") [VERIFIED: `types/chart/Treemap.d.ts`]. Do not pass it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `position: sticky` on `<th>` with `border-separate border-spacing-0` keeps header borders pinned in Chromium/Safari/Firefox | Pattern 7 | Header border scrolls away; cosmetic, covered by the UI-SPEC backstop |
| A2 | Firefox/Safari parse 6-digit-fraction ISO timestamps (`...59.139123+00:00`) in `Date.parse` | Pattern 8 | History points would be `NaN` in that browser. Cheap hedge: `Date.parse(s.replace(/(\.\d{3})\d+/, "$1"))` or test in Safari. V8 verified. |
| A4 | Nested `<svg>` clips label text to the tile in real Chromium (default `overflow: hidden` for nested svg) | Pattern 5 | Labels could paint over neighbors; backstop item "labels clipped to their own tile" catches it at UAT |
| A5 | The history payload for a full week is about 1.5 MB (75 bytes x 20,160 rows) | Pattern 8 | Slower 30 s poll on a long-running DB; DATA-V2-01 is the planned fix |
| A6 | Playwright can drive the container exactly as in Phase 3 (`finally-phase3` image, `127.0.0.1:8010`, tmpfs DB, `LLM_MOCK=true`) | Validation Architecture | The E2E gate command needs adjusting |

## Open Questions (RESOLVED)

1. **Re-clicking the already-selected row after typing another ticker**
   - What we know: the UI-SPEC fills the field when the selection "changes"; clicking the same row changes nothing.
   - What's unclear: whether the user expects a refill.
   - Recommendation: accept for Phase 4; if wanted, bump a `selectionNonce` in `Dashboard` on every click and key the fill effect on it (Pitfall 2 rule stays).
   - **RESOLVED:** accepted for Phase 4. Re-clicking the selected row does not refill the field (04-02-PLAN Task 2 and Flagged Assumptions); a `selectionNonce` can be added later if wanted.

2. **WR-03 (`clearTicker` on removing a held ticker)**
   - What we know: the stream keeps sending a held ticker after it leaves the watchlist (backend tracks watchlist plus positions); the store entry returns on the next frame, so the cost is a sub-second fallback to `current_price` and a restarted main-chart series. UI-SPEC marks the fix "recommended, not blocking".
   - Recommendation: defer, or do it cheaply by passing a `heldTickers` set into `useWatchlist` only if a plan has spare capacity. Do not let it block.
   - **RESOLVED:** deferred. Positions and heatmap fall back to the API `current_price` until the next frame restores the entry (about 500 ms), so nothing shows `--` (04-02-PLAN Flagged Assumptions; 04-04 and 04-05 `livePosition` fallback). Stays open as WR-03 in 03-REVIEW-DISPOSITION.md.

3. **Heatmap data when a position has no live price**
   - `livePosition` falls back to `current_price`, so every tile always has a positive value. No open issue; listed for the planner's completeness.
   - **RESOLVED:** no action needed; `livePosition` falls back to `current_price` (04-04-PLAN must_haves).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | Vitest, Next build, Playwright | yes | v26.9.0 (local); Dockerfile build stage uses Node 22 | — |
| npm + `frontend/node_modules` | all frontend work | yes | recharts 3.10.1, vitest 5.0.5 present | — |
| TypeScript | typecheck | yes | `tsc --noEmit` ran in 0.2 s, clean | — |
| uv + backend deps | `cd backend && uv run pytest` | yes | uv 0.12.3 | — |
| Docker | rebuilt container for the E2E gate | yes | 29.8.2 | — |
| Playwright + Chromium | trading / portfolio-charts / watchlist specs | yes | `@playwright/test` in `test/node_modules`; `~/Library/Caches/ms-playwright` has chromium-1243/1248 | Phase 6 owns the full suite |
| Running container `finally-p1` | must not be touched | yes (port 8000) | — | build the Phase 4 image under a new name and run on `127.0.0.1:8010` |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. Note that no `finally-p3` container is running (`docker ps` shows only `finally-p1`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.5 + React Testing Library 16.3.3 + jest-dom 7.0.1 (jsdom 30.1.3) [VERIFIED: `frontend/package.json`]; Playwright 1.64.1 in `test/` for the phase gate |
| Config file | `frontend/vitest.config.mts` (`environment: "jsdom"`, `globals: true`, `setupFiles: ["./vitest.setup.ts"]`, alias `@` to `./src`); `vitest.setup.ts` stubs `ResizeObserver` at 800x400, `EventSource`, `scrollIntoView`, and calls `resetPriceStore()` after each test |
| Quick run command | `npm --prefix frontend test -- <touched test file>` |
| Full suite command | `npm --prefix frontend test && npm --prefix frontend run typecheck && npm --prefix frontend run build` (baseline today: 13 files, 138 tests, about 1 s; typecheck about 0.2 s) |
| Backend check | `cd backend && uv run pytest` (145 tests; unchanged, run once at the phase gate) |
| E2E gate | rebuild the image from the unchanged Dockerfile, run it with `-p 127.0.0.1:8010:8000 --tmpfs /app/db -e LLM_MOCK=true`, then `cd test && BASE_URL=http://127.0.0.1:8010 npx playwright test trading.spec.ts portfolio-charts.spec.ts watchlist.spec.ts --project=features --reporter=list` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRADE-01 | Row click selects (`aria-current`), default first ticker, fallback after remove; `main-chart[data-ticker]`; line renders at 2+ points; caption `Since page load` / `Last 10 min` | component | `npm --prefix frontend test -- src/components/Watchlist.test.tsx src/components/MainChart.test.tsx` | Watchlist: exists (must change); MainChart: Wave 0 |
| TRADE-01 | Store holds `{t,price}`, cap 1,200, `t = timestamp*1000`; sparkline slices last 300 | unit | `npm --prefix frontend test -- src/lib/priceStore.test.ts src/lib/usePrice.test.tsx src/components/Sparkline.test.tsx` | exist (must change) |
| TRADE-02 | Selection fills `trade-ticker`; first-ever selection does not clobber typed text | component | `npm --prefix frontend test -- src/components/TradeBar.test.tsx` | Wave 0 |
| TRADE-03 | POST body `{ticker, side, quantity}`; fractional `0.25`; both buttons disabled + `aria-busy` in flight; one request on double click; Enter does nothing | component | same | Wave 0 |
| TRADE-04 | Backend 400 text in `trade-error` (`role="alert"`), inputs kept, network failure text, error cleared on edit/next attempt | component | same | Wave 0 |
| TRADE-05 | After success `setPortfolio(response.portfolio)` with no extra GET, `refreshHistory` called, quantity cleared, `Filled BUY 2 MSFT @ 412.30`, focus on quantity; Dashboard integration: header cash and positions update | component + integration | `npm --prefix frontend test -- src/components/TradeBar.test.tsx src/components/Dashboard.test.tsx` | Dashboard exists (extend) |
| TRADE-05 | Stale GET discarded after a trade response | unit (hook) | `npm --prefix frontend test -- src/lib/usePortfolio.test.tsx` | Wave 0 |
| PORT-01 | `livePosition` math; table columns, sort, fallback to `current_price`, row removed when omitted, empty/loading/error states, sign class rule | unit + component | `npm --prefix frontend test -- src/lib/portfolioValue.test.ts src/components/PositionsTable.test.tsx` | portfolioValue test exists (extend); table: Wave 0 |
| PORT-02 | Spike: first `svg rect` is a tile, root suppressed, tickers in text, percent hidden under 64x40, fill differs gain vs loss; empty state mounts no Treemap; `tileFill` unit | component + unit | `npm --prefix frontend test -- src/components/Heatmap.test.tsx` | Wave 0 (BLOCKING first heatmap task) |
| PORT-03 | `downsample` (<=300 unchanged; 20,160 to 300 with first/last kept, distinct); `buildPnlSeries`; `path.recharts-curve` at 2+ points; `Waiting for portfolio history.` below 2; baseline label `Start $10,000`; tooltip component rows | unit + component | `npm --prefix frontend test -- src/lib/pnlSeries.test.ts src/components/PnlChart.test.tsx` | Wave 0 |
| PORT-04 | Tail equals header `total-value`; poll every 30 s (fake timers) for portfolio and history; failed refresh silent when data exists | unit + component | `npm --prefix frontend test -- src/lib/usePortfolio.test.tsx src/components/PnlChart.test.tsx` | Wave 0 |
| All | Static build and prerender safe | build | `npm --prefix frontend run build` | — |
| All | Real browser | e2e | the E2E gate above | specs exist; do not edit |

### Sampling Rate
- **Per task commit:** the quick command on the touched file(s).
- **Per wave merge:** `npm --prefix frontend test && npm --prefix frontend run typecheck`.
- **Phase gate:** full suite + typecheck + build, `cd backend && uv run pytest`, then the E2E gate; then `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `frontend/src/components/Heatmap.test.tsx` — Treemap spike assertions (blocking, first heatmap task), PORT-02
- [ ] `frontend/src/lib/usePortfolio.test.tsx` — poll with `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync(30_000)`, stale guard, silent background failure (TRADE-05, PORT-04). Use a deferred-promise fetch stub.
- [ ] `frontend/src/lib/pnlSeries.test.ts`, `TradeBar.test.tsx`, `PositionsTable.test.tsx`, `MainChart.test.tsx`, `PnlChart.test.tsx`
- [ ] Extend `frontend/src/test/fixtures.ts` with `makePortfolio` / `makePosition` / `makeTradeResponse` / `makeSnapshot` builders (the Header test currently defines `makePortfolio` locally)
- [ ] No framework install needed.

### Existing tests that must change (impact table)

| File | Why | Change |
|------|-----|--------|
| `src/lib/priceStore.test.ts` | History is `{t,price}`; limit 1,200 | The `history` block parametrizes `[299,299] [300,300] [301,300]` and asserts `expect(HISTORY_LIMIT).toBe(300)`; change to 1,199/1,200/1,201 and 1,200; map `getSeries` to prices where it compared to `[100, 101, 99, 99]` and `[190]`; `EMPTY_HISTORY` to `EMPTY_SERIES` in the clear/reset/unknown-ticker tests; add a `t = timestamp*1000` test |
| `src/lib/usePrice.test.tsx` | `EMPTY_HISTORY` identity probe | Probe `useTickerSeries`/`EMPTY_SERIES`; keep a `useTickerHistory` length check |
| `src/components/Watchlist.test.tsx` | New required props (26 renders); `getHistory`/`EMPTY_HISTORY` at lines ~346-389 | Add `renderWatchlist()` harness holding `selectedTicker`; switch to `getSeries`/`EMPTY_SERIES`; add selection, keyboard, remove-does-not-select, default and fallback tests |
| `src/components/Header.test.tsx` | `Header` takes `portfolio`/`failed` props, no fetch | Replace the fetch stubs with prop fixtures in the 11 renders; move "after one request" and "pending" assertions to `usePortfolio.test.tsx`; keep the revalue, no-flash, labels and connection-dot tests as they are |
| `src/components/Dashboard.test.tsx` | `main-chart` testid is now always mounted; "Loading positions..." appears in two panels | Edit the "no main chart testid yet" test; use `getAllByText` for the loading line |
| `src/components/Sparkline.test.tsx` | Public API unchanged | Add a 400-point slice test |
| `src/lib/format.test.ts` | New formatters | Add `formatSignedCurrency`, clock formatters, `signClass` |

### E2E selector map (read from the specs this session; no spec edit is needed)

| Spec line (verbatim) | Requires |
|----------------------|----------|
| `page.getByTestId("trade-ticker").fill(ticker)`; `page.getByTestId("trade-quantity").fill(String(quantity))`; ``page.getByTestId(`trade-${side}`).click()`` | `trade-ticker`, `trade-quantity` inputs (`fill` works on `type="text"`), `trade-buy`, `trade-sell` |
| `page.getByTestId("cash-balance")` read via `readNumber` | header figure holds only the formatted number; updates from the trade response |
| `page.getByTestId("position-row-MSFT")` `toBeVisible()`; `toHaveCount(0)` after a full sell | `position-row-{T}` on the `<tr>`; must disappear when the portfolio omits it |
| `page.getByTestId("positions-table")` `toContainText("MSFT")` | testid stays on the Panel (wrapper) |
| `page.getByTestId("trade-error")` `toBeVisible()` | absent otherwise, present after the rejected sell (`Insufficient shares: selling 1 TSLA, hold 0`) |
| `page.getByTestId("watchlist-row-NVDA").click()`; `main-chart` `toHaveAttribute("data-ticker", "NVDA")`; `trade-ticker` `toHaveValue("NVDA")` | row click; `data-ticker` on the inner wrapper |
| `heatmap` `toBeVisible()`, `toContainText("JPM")`, `heatmap.locator("svg rect").first()` `toBeVisible()` | Panel testid; first rect is a non-empty tile (Pattern 5) |
| `pnlChart.locator("svg path.recharts-curve").first()` `toBeAttached()` | at least 2 points (history from the JPM trade plus the live tail) |
| `chat.spec.ts:21` `position-row-AAPL` visible after a mocked buy | Phase 5 refresh path via the lifted `refresh()` |

[VERIFIED: `test/tests/trading.spec.ts`, `portfolio-charts.spec.ts`, `watchlist.spec.ts`, `helpers.ts`, `chat.spec.ts`, and `frontend/src/lib/testIds.ts` (`mainChart: "main-chart"`, `tradeTicker: "trade-ticker"`, `tradeQuantity: "trade-quantity"`, `tradeBuy: "trade-buy"`, `tradeSell: "trade-sell"`, `tradeError: "trade-error"`, `positionsTable: "positions-table"`, `heatmap: "heatmap"`, `pnlChart: "pnl-chart"`, `positionRow: (ticker: string) => \`position-row-${ticker}\``). All ids exist; Phase 4 adds none.] No mismatch found between the specs and the UI-SPEC.

### Suggested decomposition (for the planner)
1. **Foundation (pure, unit tested):** store `{t,price}` + hooks + Sparkline slice + existing test updates; `format.ts` additions + `signClass`; `livePosition`; `pnlSeries.ts`; fixtures. Shippable alone, suite stays green.
2. **State lift:** `usePortfolio` (poll, guard, `setPortfolio`), `usePortfolioHistory`, `Dashboard` props, `Header` props and its test conversion, selection in `Watchlist`/`WatchlistRow`.
3. **Parallel panels:** `MainChart`; `TradeBar`; `PositionsTable` + `PositionRow`.
4. **Heatmap:** spike test first (blocking), then the panel states.
5. **PnlChart.**
6. **Gate:** full suite, build, backend pytest, container build, Playwright (trading, portfolio-charts, watchlist), and write the plan summary with the spike result.

## Security Domain

`security_enforcement` is enabled (absent = enabled; `security_asvs_level: 1`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No login by design (PLAN.md) |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | Single user |
| V5 Input Validation | yes | Client parses quantity with `Number()` and a finite-and-positive gate for UX only; the backend `TradeRequest` / `execute_trade` is the authority (ticker, side, quantity, cash, shares). Backend error text is rendered as a React text node only |
| V6 Cryptography | no | None |
| V12 / V13 API & output | yes | Same-origin fetch only; response bodies treated as data, never as HTML |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS through a backend error string or ticker echoed in `trade-error` or the `Filled ...` line | Tampering | Render as React text children; never `dangerouslySetInnerHTML`; add a test with an `<img onerror>` payload as in Phase 3 (T-03-11) |
| XSS through SVG `<title>`/`<text>` ticker content | Tampering | React escapes text nodes; ticker comes from the backend portfolio payload |
| Double submission of a money action | Tampering | Buttons disabled while in flight; React flushes click updates synchronously; backend still validates |
| Unintended trade via Enter key | Tampering | Buy/Sell are `type="button"`, no form, no key handler (D-03) |
| Wrong-ticker trade from the default-selection race | Tampering | Pitfall 2 rule; trade bar always shows the ticker that will be submitted |
| Stale portfolio shown after a trade | Information integrity | Generation guard (Pitfall 1); numbers come from the backend response |
| Oversized history payload | Denial of service (local) | Accepted at 7 days retention; DATA-V2-01 deferred |

## Sources

### Primary (HIGH confidence)
- Installed package source: `/Users/brett/Projects/finally/frontend/node_modules/recharts/es6/chart/Treemap.js` (read in full: `computeNode`, `ContentItem`, `renderNode`, `TreemapDispatchInject`), `types/chart/Treemap.d.ts`, `types/component/Tooltip.d.ts`, `types/component/ResponsiveContainer.d.ts`
- Runtime spikes this session (node + jsdom 30.1.3 + recharts 3.10.1, scripts in the session scratchpad `spike/spike.cjs`, `spike2.cjs`, `ssr.cjs`, `chk.cjs`, `sty.cjs`): Treemap contract, LineChart elements, tooltip props, SSR safety, `Intl` outputs, `Date.parse`, downsample distinctness
- Repo source read this session: `backend/app/routes/portfolio.py`, `services/portfolio.py`, `routes/error_handlers.py`, `db/models.py`, `db/repository.py`, `db/connection.py`; `frontend/src/lib/*`, `frontend/src/components/*`, `vitest.setup.ts`, `vitest.config.mts`, `next.config.ts`; `test/tests/*.spec.ts`, `helpers.ts`, `playwright.config.ts`, `docker-compose.test.yml`
- `.planning/phases/04-trading-portfolio/04-UI-SPEC.md`, `.planning/phases/05-ai-chat/05-UI-SPEC.md` (seams), `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/phases/03-live-watchlist-header/03-REVIEW-DISPOSITION.md`, `03-VALIDATION.md`, `03-05-SUMMARY.md`

### Secondary (MEDIUM confidence)
- None used (no web search was needed; every question was answerable from installed source and repo files).

### Tertiary (LOW confidence)
- Training knowledge for the sticky-table border behavior and cross-browser date parsing (tagged `[ASSUMED]` above).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new package; versions read from `package.json`, lockfile and `node_modules`.
- Architecture: HIGH. Recharts behavior verified by execution; state wiring derived from the existing hooks and tests.
- Pitfalls: HIGH for the E2E race, stale-GET and test-churn items (derived from the specs and current tests); MEDIUM for browser-only CSS behavior.

**Research date:** 2026-10-16
**Valid until:** 2026-11-15 (stable: pinned versions; revisit only if `recharts` is upgraded)
