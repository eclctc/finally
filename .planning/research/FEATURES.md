# Feature Research

**Domain:** Live AI trading workstation web UI (Bloomberg-style terminal, simulated single-user portfolio, LLM chat copilot)
**Researched:** 2026-10-16
**Confidence:** HIGH for the E2E UI contract and backend API shapes (read directly from `test/tests/*.spec.ts`, `planning/TEAM.md` section 5, and backend source). MEDIUM for "how trading terminals typically behave" (established domain conventions from broker/terminal products, not freshly web-verified; no external provider lookups were needed for this UI-behavior question).

## Feature Landscape

### Table Stakes (Users Expect These)

Missing these makes the product feel broken or unfinished. Complexity is for the frontend build only (the backend already exists).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Live watchlist grid (ticker, price, daily change %, sparkline) | The core of every terminal; the first thing the user looks at | MEDIUM | Rows come from `GET /api/watchlist`; prices come from SSE and are merged in by ticker. Rows must render even when a ticker has no price yet (new add, or partial SSE frame). Right-align numerics, monospace/tabular figures so digits do not jitter. |
| Price flash on tick (green up, red down, ~500ms fade) | Visual "it is alive" cue; explicitly in spec | LOW | Apply a class keyed on the direction when the price changes, then transition the background to transparent. Flash only when the price actually changes (not on every frame). Respect `prefers-reduced-motion`. Compare to the previous rendered price or use SSE `direction`. |
| Daily change % vs session open | Standard column; spec fixes the baseline | LOW | `(price - open_price) / open_price` using SSE `open_price` (session open, not previous tick). Color green/red, show sign (`+1.23%`). Zero is neutral. Do not use `change_percent` (that is vs previous tick). |
| Sparkline per watchlist row | Spec; every terminal watchlist has it | MEDIUM | Accumulated client-side from SSE since page load, so it starts empty and fills. Needs a shared per-ticker ring buffer (cap about 300 to 1200 points) living outside row components. No axes, no tooltip, no animation, stroke colored by net direction. One Recharts `LineChart` per row x 10 rows at 2 Hz is fine if animation is off. |
| Click row to select ticker (drives main chart AND trade bar) | Universal "select instrument, act on it" flow; E2E requires both | LOW | One `selectedTicker` state. Highlight the selected row. Default to the first watchlist ticker so the chart exists on load. Fall back to another ticker if the selected one is removed. |
| Add/remove ticker in watchlist | Spec; E2E | LOW | Input uppercases and trims; submit via button and Enter. Show backend 400/503 error text inline (invalid format, unknown on Massive). Duplicate add is a backend no-op success. Remove button must `stopPropagation` so it does not select the row. |
| Main chart for selected ticker | Spec: "price over time at minimum" | MEDIUM | Line/area chart of the SSE history since page load (no history endpoint exists, so it starts at the load time). Show ticker, last price, and a "waiting for data" empty state. Title shows the symbol. A reference line at session open is cheap and useful. Switching ticker reads the already accumulated buffer, so the chart is immediately populated for any ticker seen since load. |
| Connection status dot (green/yellow/red) | Spec; E2E asserts `data-status` | LOW | `connected` on `onopen`; `reconnecting` on `onerror` while `readyState === CONNECTING`; `disconnected` only when `readyState === CLOSED`. Never promote to `disconnected` on a timer, since the SSE test requires staying `reconnecting` while the server is down. |
| Header: total portfolio value, cash balance | Spec; E2E | LOW | Total value updates live: `cash + sum(quantity * live SSE price)` for positions, falling back to `current_price` from `/api/portfolio` when no tick has arrived. The `cash-balance` and `total-value` elements must contain only the formatted number (see UI contract). |
| Trade bar (ticker, quantity, Buy, Sell) | Spec; E2E | LOW | Market orders, instant fill, no confirmation dialog. Ticker field is pre-filled/synced from the selected row (uppercase). Fractional quantity allowed. Disable buttons while a request is in flight. On 400, show the backend `error` string inline (`trade-error`) and clear it on the next attempt or success. After success, update portfolio state from the `POST /api/portfolio/trade` response (it returns the full portfolio) and trigger a P&L history refetch. |
| Positions table | Spec; E2E | LOW | Columns: ticker, quantity, avg cost, current price, unrealized P&L ($), % change. Current price and P&L should be recomputed from live SSE prices, not stale polled values. Color P&L green/red. Row disappears when the position is sold to zero. Empty state: "No positions". |
| Portfolio heatmap (Recharts Treemap) | Spec; E2E | MEDIUM | Tile area = market value (portfolio weight), color = unrealized P&L % (green profit, red loss, neutral near zero; clamp the intensity scale, for example saturate at plus or minus 5%). Label with ticker (and P&L %) only when the tile is large enough. Needs a custom `content` renderer and `isAnimationActive={false}`. Needs an explicit-height parent (ResponsiveContainer needs a non-zero box). Empty state when no positions. |
| P&L chart (portfolio value over time) | Spec; E2E | MEDIUM | Line chart from `GET /api/portfolio/history` (`snapshots[].recorded_at`, `total_value`). Snapshots exist every 30s plus after each trade, so the line is sparse and stepped; refetch after each trade and on a slow interval (about 30s). Use a time axis (parse ISO strings), a `$` y-axis with an auto domain (do not start at 0, or the line looks flat), and a baseline reference line at $10,000 (starting capital). Always render the `pnl-chart` container (with an empty state) so layout and testid are stable. |
| AI chat panel (docked, collapsible) | Spec; E2E | MEDIUM | Message list (user right, assistant left), text input, Send (also Enter), auto-scroll to the latest, loading indicator while the request is in flight, input disabled or send blocked while loading. Open by default (E2E expects `chat-panel` visible on load). Collapse is a toggle that does not unmount state. |
| Inline action confirmations in chat | Spec; E2E | LOW | Each entry in the response `actions[]` renders as a `chat-action` chip: trade (`BUY 1 AAPL @ price`), watchlist (`Added PYPL`), with ok/failed styling and the failure `error` text. Rendered under the assistant message that produced it. |
| Chat error display | Spec: 502 shown inline; nothing stored | LOW | On non-2xx show the backend `error` inline in the chat (`chat-error`), do not add a fake assistant message, and keep the user's text for retry (or at least not lose it). No auto retry (spec). |
| Portfolio and watchlist refresh after chat actions | Otherwise the UI lies right after the AI trades | LOW | After every chat response that has any action, refetch portfolio, watchlist, and history. E2E needs `position-row-AAPL` to appear after the chat buy. |
| SSE client with auto-reconnect | Spec; E2E | LOW | Native `EventSource`, browser handles retry. Merge frames into a price map; tolerate partial frames (only some tickers present). Close the `EventSource` on unmount. Do not hand-roll reconnect logic. |
| Dark terminal theme with the spec palette | Spec | LOW | Backgrounds `#0d1117`/`#1a1a2e`, muted borders, accent yellow `#ecad0a`, blue `#209dd7`, purple `#753991` for submit buttons (Send, and arguably Buy/Sell). Green/red reserved for price direction and P&L. Dense layout, small type, tabular numerals. |
| Number formatting | Every financial UI | LOW | One shared formatter set: currency (`$1,234.56`), signed percent, quantity (trim trailing zeros, up to about 4 dp for fractional shares). The E2E helpers parse by stripping everything except digits, `.`, and `-`, so formatting must not inject stray digits or minus signs. |
| Empty/loading states for every panel | Sparse data at first launch (no positions, no snapshots, sparklines empty) | LOW | Avoid layout shift; keep container testids always mounted. |
| Desktop-first responsive layout | Spec | MEDIUM | CSS grid: watchlist left, main chart plus portfolio charts center, chat docked right, positions/trade bar bottom or center. Tests use a 1600x1000 viewport, so all panels must be visible without scrolling to reach (Playwright scrolls into view for clicks, but `toBeVisible` still needs non-hidden elements). Functional (stacked/scrolling) on tablet. |
| Frontend unit tests (Vitest + RTL) | Spec / project constraint | MEDIUM | Price flash trigger, watchlist add/remove, positions/portfolio calculations, chat rendering and loading state, connection dot mapping. |

### Differentiators (Competitive Advantage)

The project's core value is "prices stream, I can trade, an AI trades for me, in one dense dark live UI". Differentiate there, not on charting breadth.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Streaming-feel micro-interactions (flash, sparkline growth, live-updating header total) | The "looks like a Bloomberg terminal" demo impact for the course capstone | LOW | Mostly CSS. Already in table stakes; the polish (consistent tabular figures, non-janky flashes) is what separates it. |
| AI actions visibly flow through to the rest of the UI | The "agentic" moment: type a sentence, watch a position appear, cash drop, heatmap tile and P&L step change | LOW | Cost is the refetch-after-chat wiring (already table stakes). Optionally briefly highlight the new/changed position row or watchlist row. |
| Quick-prompt chips in empty chat ("Analyze my portfolio", "Buy 1 AAPL", "Add PYPL to watchlist") | Teaches what the copilot can do, makes demos one-click; chips match the mock keywords so the mock mode is demoable | LOW | Static buttons that submit fixed text. Not required by any test. |
| Chat input and message UX polish (Enter to send, Shift+Enter newline, auto-scroll, tool-call chips color-coded) | Feels like a real copilot | LOW | Keep it simple. |
| Treemap tooltip / hover (ticker, qty, value, P&L) | Terminal-style drill-down | LOW | Recharts `Tooltip` on the Treemap, or a title attribute. |
| P&L chart live tail (append the current live total value as the final point) | Chart is never empty on fresh start and moves between 30s snapshots | LOW | Client-side only; do not write to the DB. Ensures at least one point on a brand-new DB. Mark clearly in code that the last point is synthetic. |
| Session open reference line + hover crosshair on the main chart | Context for "up or down today" | LOW | Recharts `ReferenceLine`, `Tooltip`. |
| Keyboard shortcuts (focus chat, Enter in trade bar) | Terminal feel | LOW | Optional; skip if time is tight. |
| Chat history reload | Conversation persists across reloads | MEDIUM | NOT currently possible: the backend has no `GET /api/chat` endpoint (only `POST`). Would require a small backend addition. Defer, see Anti-Features / Future. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Trade confirmation dialog | "Safety" | Spec explicitly says no confirmation; breaks E2E flow (`click buy` must fill immediately) and the fluid-demo goal | Instant fill with inline success/error feedback (cash and positions update visibly) |
| Order types: limit/stop, order book, partial fills, fees | Feels like a "real" broker | Out of scope (market orders only); drastically more portfolio math and backend work | Market orders only, one trade bar |
| Realized P&L column / trade history blotter | Natural next question after selling | Excluded in v1 (spec); backend does not expose trades via API | Show unrealized P&L only; trades table retains data for later |
| Token-by-token chat streaming | Modern chat feel | Spec decides against it; `POST /api/chat` returns one complete JSON; adds SSE/stream complexity | Loading indicator (`chat-loading`) until the full reply |
| Confirmation of AI trades before execution | "AI should ask first" | Auto-execution is the deliberate design and the course theme | Show executed (or failed) actions inline with clear status |
| WebSocket transport / hand-rolled reconnect | "More real-time" | SSE is decided; `EventSource` already retries and E2E relies on its behavior | Native `EventSource` |
| Additional charting libraries (TradingView lightweight-charts, D3, candlesticks, indicators) | Terminal-grade charts | Spec fixes Recharts only; no OHLC data exists (simulator emits ticks); more dependency surface | Recharts line/area for price; Treemap for heatmap |
| Historical price data / timeframe selector (1D, 1W, 1M) | Every chart has one | No price-history endpoint; data exists only since page load | Label the chart honestly ("since page load" or time of first tick) |
| Auth, accounts, multi-user, settings/preferences page | Standard app scaffolding | Single-user by design; no login | Nothing; hardcoded `default` user stays on the backend |
| Drag-and-drop / resizable / persisted panel layout | Terminal feel | Large complexity, layout state persistence, test fragility | Fixed CSS grid layout |
| Light theme / theme toggle | Preference | Spec is dark only; doubles styling and chart theming | Single custom dark theme |
| Browser notifications, price alerts, sound | Terminal feature | Not in spec; needs persistence and permissions | None |
| Client-side persistence of chat/watchlist (localStorage) | Survive reloads | Duplicates server state, causes divergence; watchlist is server-backed | Server is the source of truth; chat history reload only if a backend GET is added later |
| Optimistic UI for trades | Snappier | Fill price is decided server-side at the cached price; optimistic state can disagree and mask errors the E2E checks (`trade-error`) | Wait for the response (it is fast and returns the new portfolio) |
| Per-component polling of `/api/portfolio` every 500ms | Keeps numbers fresh | Wasteful; SSE already supplies prices | Fetch on load and after trades/chat actions; derive live values from SSE |
| Heavy animation on charts (Recharts default animation) | Looks smooth | Causes jank on 500ms updates, and makes SVG assertions flaky (rects/paths mid-animation) | `isAnimationActive={false}` everywhere |
| Mobile-first layout | Reach | Spec says desktop-first, tablet functional | Desktop grid with graceful stacking |

## Feature Dependencies

```
SSE price stream hook (EventSource + connection status)
    ├──feeds──> shared per-ticker price history store
    │               ├──feeds──> Watchlist sparklines
    │               └──feeds──> Main chart (selected ticker)
    ├──feeds──> Watchlist price + flash + daily change %
    └──feeds──> Live positions values ──> Header total value
                                      └──> Heatmap (weights/colors)

Watchlist (GET /api/watchlist) ──requires──> row render without price (partial SSE frames)
Selected ticker state ──drives──> Main chart + Trade bar ticker field
Portfolio state (GET /api/portfolio) ──feeds──> Header cash, Positions table, Heatmap
Trade bar ──updates──> Portfolio state (from POST response) ──triggers──> P&L history refetch
Chat panel ──triggers (when actions present)──> refetch Portfolio + Watchlist + History
P&L history (GET /api/portfolio/history) ──feeds──> P&L chart (+ optional live tail)
Treemap rendering ──requires──> non-zero container height + custom content + no animation
Static export build (output: 'export') ──requires──> all fetches client-side, same origin /api/*, "use client" components
```

### Dependency Notes

- **Everything price-related depends on one SSE subscription.** Build the stream hook, the price map, and the history store first (one `EventSource`, not one per component).
- **Watchlist rows require tolerant merging.** The SSE reconnect E2E sends a frame containing only `AAPL` with price 1.0; the other nine rows must stay rendered (no price) and not crash.
- **Selected ticker links watchlist, main chart, and trade bar.** The trade bar field must be a controlled input fed by the selection but still user-editable (tests `fill` it directly).
- **Chat requires a shared data-refresh path.** Trades via the trade bar and via chat must call the same "reload portfolio/history" function, so the positions table and the heatmap cannot diverge.
- **Heatmap and P&L chart depend on trades existing** to be interesting, but their containers must render in the empty state too.
- **Backend dependency (not frontend work):** chat history reload would need a new `GET /api/chat`. Not required by any test; defer.

## UI Contract Required by the Existing E2E Suite

This is the exact surface `test/tests/*.spec.ts` needs. Source: `fresh-start`, `watchlist`, `trading`, `chat`, `portfolio-charts`, `sse-reconnect` specs, plus `planning/TEAM.md` section 5. Viewport 1600x1000, `workers: 1`, shared DB, `LLM_MOCK=true`, baseURL `http://localhost:8010` (or `http://finally:8000` in compose).

### Test IDs (all `data-testid`)

| testid | Element / required behavior | Used by |
|---|---|---|
| `connection-status` | Header dot. `data-status` = `connected` / `reconnecting` / `disconnected`. | fresh-start (`connected`), sse-reconnect (`reconnecting`, then `connected`) |
| `cash-balance` | Header cash. Text content must parse to a number via "strip all but `0-9 . -`". Must equal `10000` on a fresh DB. Must decrease after a buy, increase after a sell. | fresh-start, trading |
| `total-value` | Header total. Same parsing. Must equal `10000` (exact) on a fresh DB with no positions. | fresh-start |
| `watchlist` | Watchlist panel wrapper. Must contain exactly 10 elements matching `[data-testid^="watchlist-row-"]` on a fresh DB. | fresh-start |
| `watchlist-row-{TICKER}` | One per ticker; clickable (selects). Must not be reused as a prefix by any other testid inside `watchlist` (for example do not name inner cells `watchlist-row-...-price`). | fresh-start, watchlist, trading |
| `watchlist-price-{TICKER}` | Price cell. Text parses to a positive number; text must change over time (poll up to 15s) and update on reconnect; must show `1` after the stubbed frame (price 1.0, so `1.00` is fine). Contains only the price, no other digits. | fresh-start, sse-reconnect |
| `watchlist-add-input` | Text input for a ticker (test fills `DIS`). | watchlist |
| `watchlist-add-button` | Submits the add. | watchlist |
| `watchlist-remove-{TICKER}` | Remove button; click removes the row. | watchlist |
| `main-chart` | Chart container always present; `data-ticker="{TICKER}"` reflects the selection (after clicking NVDA row it must be `NVDA`). | watchlist |
| `trade-ticker` | Input; after clicking a watchlist row its value must be exactly the ticker (`toHaveValue("NVDA")`); also accepts `fill`. | watchlist, trading |
| `trade-quantity` | Numeric input (tests fill `"2"`, `"1"`, `"3"`). | trading |
| `trade-buy`, `trade-sell` | Buttons (`trade-${side}`); click executes the order immediately. | trading |
| `trade-error` | Visible after a rejected trade (selling a ticker not held). Shows the backend `error` text. | trading |
| `positions-table` | Table wrapper; `toContainText("MSFT")` after a buy. | trading |
| `position-row-{TICKER}` | One row per held ticker; appears after buy (UI or chat), absent (count 0) after a full sell or when never held. | trading, chat, portfolio-charts |
| `heatmap` | Wrapper; must contain the text `JPM` when JPM is held, and contain `svg rect` (first visible, so non-zero size, not `display:none`). | portfolio-charts |
| `pnl-chart` | Wrapper; visible; must contain an `svg path.recharts-curve` (attached) when history has at least one snapshot. Verify a single-point series still renders a curve path, or ensure at least two points (live tail). | portfolio-charts |
| `chat-panel` | Visible on page load (not collapsed by default). | chat |
| `chat-input` | Text input (test uses `fill`). | chat |
| `chat-send` | Click sends. | chat |
| `chat-loading` | Present while the request is in flight; count must be 0 after the reply (render conditionally, do not leave a hidden element). | chat |
| `chat-message` with `data-role="user"` / `"assistant"` | One element per message. Test expects the last user message to contain the sent text and the assistant count to grow by exactly 1 per turn. Do not render the failure or the actions as extra `chat-message` elements. | chat |
| `chat-action` with `data-status="ok"` / `"failed"` | One per `actions[]` entry, containing the ticker (`AAPL`). The count must grow by exactly 1 for the mocked buy. | chat |
| `chat-error` | Inline chat error (defined in TEAM.md; not asserted by current specs). Add it anyway. | (TEAM.md contract) |

### Behavioral Requirements Derived from the Specs

- **Fresh start:** all 10 default rows visible; cash and total value read exactly 10000; connection `connected`; AAPL price positive and changing within 15s.
- **SSE drop:** on a stream that sends one event then closes, status must go to `reconnecting` (not `disconnected`), price cell shows the 1.0 frame, then after the server returns status goes `connected` and prices resume (>100 for AAPL, then changing). The hook must handle a frame that has only one ticker, and the `retry: 500` field is honored by the browser, not the app.
- **Watchlist add/remove:** after add, the new row appears (price may arrive later); remove deletes it; a reload must not bring it back (server-backed, no local state).
- **Selection:** clicking a row sets both `main-chart[data-ticker]` and the `trade-ticker` value.
- **Trading:** buy of 2 MSFT lowers cash and adds `position-row-MSFT`; partial sell keeps the row and raises cash; full sell removes the row; oversell shows `trade-error` and no row. Cash must update from the trade response (or a refetch) without a page reload.
- **Chat:** open on load; sending "Please buy some Apple" shows the user message, exactly one new assistant message, no loading element, exactly one `ok` action mentioning AAPL, and `position-row-AAPL` visible (so the portfolio must refresh after the chat response).
- **Charts:** with a position and at least one snapshot, the heatmap renders a visible rect with the ticker text, and the P&L chart renders a recharts curve path.
- **Not asserted but implied:** E2E tests share one DB across the run, so AAPL/MSFT/NVDA/AMZN/JPM positions and the AI-bought AAPL persist between tests; the UI must not assume empty state after the first test.

### Gaps/Risks in the Contract

- `readNumber` on `total-value`/`cash-balance` strips letters and symbols, so a "-" in a label or an em dash placeholder would parse as `NaN`/`-0`. Show `$0.00`-style numbers or put placeholders outside the testid element. Likewise, do not put "24h" or other digits inside those elements.
- `fresh-start` expects exactly `10000` for total value: do not render the unrounded float sum (for example `9999.999`); format to 2 dp consistently.
- The `chat` test records `messagesBefore`, so a persisted-history feature would be harmless, but the backend currently provides no history GET; the panel starts empty on reload.
- `portfolio-charts` calls the API before `page.goto`, so the history is non-empty on first render; if the history fetch is only done once on mount and the test is slow, it still works. A mount-time fetch plus refetch-after-trade is sufficient.
- No test checks a flash color or sparkline; those need Vitest coverage instead.

## MVP Definition

### Launch With (v1)

Everything in Table Stakes is needed for "Done = Docker build + working UI + passing E2E suite". Suggested internal build order follows the dependency graph:

- [ ] App shell, Tailwind dark theme, layout grid, number formatters, shared panel component — everything else sits in it
- [ ] SSE stream hook with connection status and the per-ticker history store — all price features depend on it
- [ ] Header (total value, cash, status dot) — fresh-start and sse-reconnect tests
- [ ] Watchlist (rows, price flash, daily change, sparkline, add/remove, row selection) — most E2E coverage
- [ ] Main chart plus trade bar (selection-driven) — trading and watchlist tests
- [ ] Portfolio state, positions table, trade execution with inline error — trading tests
- [ ] Heatmap (Treemap) and P&L chart — portfolio-charts test
- [ ] Chat panel with inline actions, loading, error, and portfolio refresh — chat test
- [ ] Vitest + RTL unit tests alongside each component

### Add After Validation (v1.x)

- [ ] Quick-prompt chips in chat — after the chat panel works end to end
- [ ] P&L chart live tail and session-open reference line — after the base charts pass E2E
- [ ] Treemap/line tooltips — polish
- [ ] Brief highlight of rows changed by AI actions — polish

### Future Consideration (v2+)

- [ ] Chat history reload — needs a new `GET /api/chat` backend endpoint
- [ ] Trade history blotter and realized P&L — excluded by spec in v1
- [ ] Real price history / timeframe selector — needs a history endpoint or the Massive aggregate API
- [ ] Layout persistence, alerts, theming — not in the product vision

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| SSE hook + connection dot | HIGH | LOW | P1 |
| Watchlist with flash, change %, add/remove, select | HIGH | MEDIUM | P1 |
| Sparklines | HIGH | MEDIUM | P1 |
| Header live total value and cash | HIGH | LOW | P1 |
| Trade bar with inline error | HIGH | LOW | P1 |
| Positions table (live values) | HIGH | LOW | P1 |
| Main chart | HIGH | MEDIUM | P1 |
| Heatmap (Treemap) | HIGH | MEDIUM | P1 |
| P&L chart | HIGH | MEDIUM | P1 |
| AI chat panel with inline actions and refresh | HIGH | MEDIUM | P1 |
| Vitest + RTL tests | MEDIUM | MEDIUM | P1 (project requirement) |
| Quick-prompt chips | MEDIUM | LOW | P2 |
| P&L live tail, reference lines | MEDIUM | LOW | P2 |
| Tooltips on charts | LOW | LOW | P2 |
| Chat history reload | MEDIUM | MEDIUM (backend + frontend) | P3 |
| Keyboard shortcuts | LOW | LOW | P3 |

**Priority key:** P1 must have for launch; P2 should have when possible; P3 future consideration.

## Competitor / Reference Feature Analysis

| Feature | Bloomberg Terminal / broker watchlists | Consumer apps (Robinhood, Webull) | Our Approach |
|---------|----------------------------------------|-----------------------------------|--------------|
| Watchlist | Dense rows, tick-by-tick color flash, change vs previous close, no animation beyond flash | Larger rows, sparkline per row, change vs previous close | Dense rows, flash, sparkline since load, change vs session open (no previous close exists in the cache) |
| Instrument chart | Full charting with timeframes and studies | Simple line with timeframe tabs | Line/area since page load only, no timeframes (no history data) |
| Portfolio heatmap | Treemap by weight, colored by day change | Rare | Treemap by weight, colored by unrealized P&L % |
| Order entry | Ticket with order types, confirmation | One-tap buy/sell with review screen | Minimal ticker/qty/buy/sell, instant fill, no confirmation |
| AI assistant | Natural-language search only | Basic chatbot, no execution | LLM copilot that executes trades and watchlist changes with inline confirmations (the differentiator) |

## Sources

- `/Users/brett/Projects/finally/test/tests/*.spec.ts`, `helpers.ts`, `playwright.config.ts`, `docker-compose.test.yml` (HIGH, read directly)
- `/Users/brett/Projects/finally/planning/PLAN.md` sections 2, 6, 8, 9, 10 and `planning/TEAM.md` sections 4 and 5 (HIGH, project spec and API/testid contract)
- `/Users/brett/Projects/finally/backend/app/chat/{mock,schemas,router}.py`, `routes/error_handlers.py` (HIGH; confirmed: actions shape, mock keyword rules, errors return `{"error": ...}`, no chat GET endpoint)
- Previous frontend at commit `5681c3a` (`Heatmap.tsx`, `PnlChart.tsx`, `usePriceStream.ts`, `package.json`) as a reference for Recharts patterns (Treemap custom content, `isAnimationActive={false}`, `initialDimension` on ResponsiveContainer) (MEDIUM; reference only, to be rebuilt fresh)
- Terminal and broker UI conventions (watchlist flash, treemap heatmap, positions blotter, order ticket) from general domain knowledge (MEDIUM; not freshly web-verified)

---
*Feature research for: live AI trading workstation web UI*
*Researched: 2026-10-16*
