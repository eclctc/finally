# Massive API (formerly Polygon.io) — Stock Prices Reference

Research notes for retrieving real-time and end-of-day prices for multiple tickers. Researched 2026-10-14.

## 1. Overview

- Polygon.io rebranded as **Massive.com** on 2025-10-30. Accounts, API keys and endpoint paths are unchanged.
- REST base URL: `https://api.massive.com` (`https://api.polygon.io` still works for an extended period).
- Official Python client: PyPI package `massive` (latest 2.8.0), import `from massive import RESTClient`. Python >= 3.9.
- The client is **synchronous** (urllib3). From asyncio code, call it with `asyncio.to_thread(...)`.

## 2. Plans and What They Allow

| Plan | Price/month | Call limit | Data recency | Full-market snapshot |
|---|---|---|---|---|
| Stocks Basic | $0 | 5 calls/min | End of day | **Not included** |
| Stocks Starter | $29 | Unlimited | 15-min delayed | Included |
| Stocks Developer | $79 | Unlimited | 15-min delayed | Included |
| Stocks Advanced | $199 | Unlimited | Real-time | Included |
| Stocks Business | custom | Unlimited | Real-time (+ fair market value) | Included |

Consequence for FinAlly: the **free key cannot use the snapshot endpoint**. It can use previous-day bars and the grouped daily (whole-market end-of-day) endpoint. Intraday prices need Starter or above. Paid plans have no per-minute limit, but polling faster than every 2-5 seconds gains nothing for delayed data.

## 3. Authentication

Either form works:

```bash
# Query parameter
curl "https://api.massive.com/v2/aggs/ticker/AAPL/prev?apiKey=$MASSIVE_API_KEY"

# Bearer header (preferred: key stays out of logs and URLs)
curl -H "Authorization: Bearer $MASSIVE_API_KEY" \
  "https://api.massive.com/v2/aggs/ticker/AAPL/prev"
```

Python client:

```python
from massive import RESTClient

client = RESTClient(api_key=os.environ["MASSIVE_API_KEY"])
# RESTClient() with no argument also reads MASSIVE_API_KEY from the environment
```

Install in the backend: `uv add massive`.

## 4. Endpoints for Multi-Ticker Prices

### 4.1 Full Market Snapshot — the primary real-time endpoint (Starter+)

`GET /v2/snapshot/locale/us/markets/stocks/tickers`

| Param | Type | Notes |
|---|---|---|
| `tickers` | comma-separated string | Case-sensitive, e.g. `AAPL,TSLA,GOOGL`. Empty means all 10,000+ tickers |
| `include_otc` | bool | Default `false` |

One call returns every requested ticker, so polling cost does not grow with watchlist size.

Response:

```json
{
  "status": "OK",
  "count": 1,
  "tickers": [
    {
      "ticker": "AAPL",
      "todaysChange": -0.124,
      "todaysChangePerc": -0.601,
      "updated": 1605192894630916600,
      "day":     {"o": 20.64, "h": 20.64, "l": 20.506, "c": 20.506, "v": 37216, "vw": 20.616},
      "prevDay": {"o": 20.79, "h": 21, "l": 20.5, "c": 20.63, "v": 292738, "vw": 20.6939},
      "min":     {"o": 20.506, "h": 20.506, "l": 20.506, "c": 20.506, "v": 5000, "vw": 20.5105,
                  "av": 37216, "n": 1, "t": 1684428600000},
      "lastTrade": {"p": 20.506, "s": 2416, "t": 1605192894630916600, "x": 4, "c": [14, 41], "i": "71675577320245"},
      "lastQuote": {"p": 20.5, "s": 13, "P": 20.6, "S": 22, "t": 1605192959994246100}
    }
  ]
}
```

Field key: `o/h/l/c` open/high/low/close, `v` volume, `vw` VWAP, `av` accumulated volume, `n` transactions, `p` price, `s` size, `P`/`S` ask price/size (lowercase is bid), `x` exchange id.

- `lastTrade` is present only if the plan includes trades; `lastQuote` only if it includes quotes.
- `updated`, `lastTrade.t`, `lastQuote.t` are **Unix nanoseconds**. `min.t` is **Unix milliseconds**.
- Snapshot data is cleared daily at 3:30 AM ET and repopulates from ~4:00 AM ET. In that window `day` values may be zero; fall back to `prevDay.c`.

Python client:

```python
from massive import RESTClient

client = RESTClient()
snapshots = client.get_snapshot_all("stocks", tickers=["AAPL", "MSFT", "NVDA"])

for snap in snapshots:
    price = snap.last_trade.price if snap.last_trade else snap.day.close
    print(snap.ticker, price, snap.prev_day.close, snap.todays_change_percent)
```

`TickerSnapshot` attributes: `ticker`, `day`, `prev_day` (`Agg`: `open, high, low, close, volume, vwap, timestamp, transactions`), `min` (`MinuteSnapshot`: same plus `accumulated_volume`), `last_trade` (`LastTrade`: `price, size, sip_timestamp, exchange, conditions, ...`), `last_quote`, `todays_change`, `todays_change_percent`, `updated`.

### 4.2 Single Ticker Snapshot (Starter+)

`GET /v2/snapshot/locale/us/markets/stocks/tickers/{stocksTicker}` — same object as above under a `ticker` key.

```python
snap = client.get_snapshot_ticker("stocks", "AAPL")
```

Use 4.1 even for one ticker when polling; it keeps the code path single.

### 4.3 Previous Day Bar — all plans (including free)

`GET /v2/aggs/ticker/{stocksTicker}/prev?adjusted=true`

```json
{
  "ticker": "AAPL", "status": "OK", "adjusted": true,
  "queryCount": 1, "resultsCount": 1,
  "results": [{"T": "AAPL", "o": 115.55, "h": 117.59, "l": 114.13, "c": 115.97,
               "v": 131704427, "vw": 116.3058, "t": 1605042000000}]
}
```

An unknown ticker returns `status: OK` with no `results`; the Python client then returns an empty list. This makes it a cheap **"does this ticker exist?"** check on every plan.

```python
bars = client.get_previous_close_agg("AAPL")
if not bars:
    raise ValueError("unknown ticker")
print(bars[0].close)
```

### 4.4 Grouped Daily (Daily Market Summary) — all plans

`GET /v2/aggs/grouped/locale/us/market/stocks/{date}?adjusted=true`

End-of-day OHLC for **every** US stock on one date, in one call. This is the efficient end-of-day source on the free tier.

```json
{
  "status": "OK", "adjusted": true, "queryCount": 3, "resultsCount": 3,
  "results": [
    {"T": "AAPL", "o": 189.1, "h": 191.2, "l": 188.4, "c": 190.6,
     "v": 51234567, "vw": 190.1, "n": 612345, "t": 1728936000000}
  ]
}
```

- `date` is `YYYY-MM-DD`. Weekends, holidays and a not-yet-closed today return no `results`; step back a day until results appear.

```python
from datetime import date, timedelta

def latest_closes(client, tickers: set[str]) -> dict[str, float]:
    """Return the most recent end-of-day close for each requested ticker."""
    day = date.today()
    for _ in range(7):
        bars = client.get_grouped_daily_aggs(day.isoformat())
        if bars:
            return {b.ticker: b.close for b in bars if b.ticker in tickers}
        day -= timedelta(days=1)
    return {}
```

### 4.5 Daily Open/Close — one ticker, one date

`GET /v1/open-close/{stocksTicker}/{date}` returns `open`, `high`, `low`, `close`, `preMarket`, `afterHours`, `volume`.

```python
oc = client.get_daily_open_close_agg("AAPL", "2026-10-13")
print(oc.open, oc.close, oc.after_hours)
```

### 4.6 Aggregates (Bars) — history for charts

`GET /v2/aggs/ticker/{stocksTicker}/range/{multiplier}/{timespan}/{from}/{to}`

```python
bars = client.get_aggs("AAPL", 1, "day", "2026-09-01", "2026-10-13")      # list
for bar in client.list_aggs("AAPL", 1, "minute", "2026-10-13", "2026-10-13", limit=50000):
    print(bar.timestamp, bar.close)                                       # paginates
```

Not needed for v1 (charts are built from the SSE stream) but available for a future history feature.

## 5. Errors, Rate Limits and Retries

- Any non-200 response raises `massive.exceptions.BadResponse` with the JSON body as the message, e.g. `{"status":"NOT_AUTHORIZED","message":"You are not entitled to this data..."}` (HTTP 403) when the plan lacks the endpoint.
- A missing key raises `massive.exceptions.AuthError`.
- The client retries 413/429/499/500/502/503/504 with exponential backoff (`retries` constructor arg). On the free tier, budget calls so 5/min is never exceeded.
- Tickers are **case-sensitive** — always uppercase.

```python
from massive.exceptions import BadResponse

try:
    snapshots = client.get_snapshot_all("stocks", tickers=["AAPL"])
except BadResponse as error:
    if "NOT_AUTHORIZED" in str(error):
        ...  # plan has no snapshot access: switch to end-of-day mode
    else:
        raise
```

## 6. Choosing a Price for a Ticker

From a snapshot, pick the first non-empty value:

1. `last_trade.price` — most recent trade
2. `min.close` — latest minute bar
3. `day.close` — today's bar so far
4. `prev_day.close` — before the market opens / after the 3:30 AM reset

## 7. Recommendations for FinAlly

| Need | Endpoint | Plan |
|---|---|---|
| Live prices for all watched tickers | Full Market Snapshot with `tickers=` (one call per poll) | Starter+ |
| Prices on the free key | Grouped Daily for the latest trading day (one call per poll, static during the day) | Basic |
| Validate a watchlist add | Previous Day Bar (empty result = unknown ticker) | All |

- Poll interval: 15 s on the free tier (4 calls/min leaves room for watchlist validation), 2-5 s on paid tiers.
- Detect the plan at runtime: try the snapshot once; on `NOT_AUTHORIZED` switch to grouped daily. No extra configuration needed.
- Run the synchronous client in `asyncio.to_thread` so polling never blocks the event loop.

## Sources

- [Full Market Snapshot](https://massive.com/docs/rest/stocks/snapshots/full-market-snapshot)
- [Previous Day Bar](https://massive.com/docs/rest/stocks/aggregates/previous-day-bar)
- [Daily Market Summary (Grouped Daily)](https://massive.com/docs/rest/stocks/aggregates/daily-market-summary)
- [REST Quickstart (authentication)](https://massive.com/docs/rest/quickstart)
- [Pricing](https://massive.com/pricing)
- [massive-com/client-python](https://github.com/massive-com/client-python) (source of method signatures, models and error handling)
