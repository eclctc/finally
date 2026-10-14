# Market Data Interface — Unified Python API

How the backend gets stock prices. One interface, two implementations: the **Massive** poller when `MASSIVE_API_KEY` is set, otherwise the **simulator**. Everything downstream (SSE, trades, portfolio valuation, watchlist) reads one shared `PriceCache` and never knows which source is running.

References: `massiveapi.md` (Massive endpoints), `marketsimulator.md` (simulator design), `PLAN.md` sections 6 and 8.

## 1. Data Flow

```
            MASSIVE_API_KEY set?
                 │
        ┌────────┴────────┐
        yes               no
        ▼                 ▼
 MassiveDataSource   SimulatorDataSource      (background asyncio task)
        │                 │
        └──── writes ─────┘
                 ▼
            PriceCache  (latest, previous, session open, version)
                 │ reads
     ┌───────────┼──────────────┬───────────────┐
     ▼           ▼              ▼               ▼
 SSE stream   execute_trade  GET /portfolio  GET /watchlist
```

Rules:

- Exactly one source runs, started in the FastAPI lifespan.
- Only the source writes to the cache. Everyone else only reads.
- The source tracks the **union of watchlist tickers and held positions**. The watchlist/portfolio services are responsible for calling `add_ticker` / `remove_ticker` to keep that union correct (e.g. removing a watched ticker that is still held does not call `remove_ticker`).

## 2. Module Layout

```
backend/app/market/
├── __init__.py          # exports PriceUpdate, PriceCache, MarketDataSource, create_market_data_source
├── models.py            # PriceUpdate
├── cache.py             # PriceCache
├── interface.py         # MarketDataSource (ABC)
├── factory.py           # create_market_data_source()
├── simulator.py         # SimulatorDataSource + GBM engine (see marketsimulator.md)
├── seed_prices.py       # seed prices, per-ticker volatility, sectors
└── massive_source.py    # MassiveDataSource
```

## 3. `PriceUpdate` — the one price record

Matches the SSE payload in PLAN.md section 6 field for field.

```python
# models.py
from dataclasses import dataclass, asdict


@dataclass(frozen=True, slots=True)
class PriceUpdate:
    """Latest price for one ticker, with the values derived from it."""

    ticker: str
    price: float
    previous_price: float
    open_price: float
    timestamp: float  # Unix seconds

    @property
    def change(self) -> float:
        return round(self.price - self.previous_price, 4)

    @property
    def change_percent(self) -> float:
        return round(self.change / self.previous_price * 100, 4)

    @property
    def direction(self) -> str:
        if self.change > 0:
            return "up"
        if self.change < 0:
            return "down"
        return "flat"

    def to_dict(self) -> dict:
        """Serialize for the SSE stream and REST responses."""
        return asdict(self) | {
            "change": self.change,
            "change_percent": self.change_percent,
            "direction": self.direction,
        }
```

Daily change % in the UI is computed on the frontend from `price` and `open_price`.

## 4. `PriceCache` — shared in-memory state

Single process, single event loop: no locks needed. The `version` counter lets SSE send only when something changed.

```python
# cache.py
import time

from .models import PriceUpdate


class PriceCache:
    """Latest price per ticker. Written by the market data source, read by everyone else."""

    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self.version = 0

    def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
        """Record a new price. The first price seen becomes the session open."""
        previous = self._prices.get(ticker)
        update = PriceUpdate(
            ticker=ticker,
            price=round(price, 2),
            previous_price=previous.price if previous else round(price, 2),
            open_price=previous.open_price if previous else round(price, 2),
            timestamp=timestamp or time.time(),
        )
        self._prices[ticker] = update
        self.version += 1
        return update

    def get(self, ticker: str) -> PriceUpdate | None:
        return self._prices.get(ticker)

    def get_price(self, ticker: str) -> float | None:
        update = self._prices.get(ticker)
        return update.price if update else None

    def all(self) -> dict[str, PriceUpdate]:
        return dict(self._prices)

    def remove(self, ticker: str) -> None:
        if self._prices.pop(ticker, None):
            self.version += 1
```

## 5. `MarketDataSource` — the abstract interface

```python
# interface.py
from abc import ABC, abstractmethod

from .cache import PriceCache


class MarketDataSource(ABC):
    """A background producer of prices that writes into a PriceCache."""

    def __init__(self, cache: PriceCache) -> None:
        self.cache = cache

    @abstractmethod
    async def start(self, tickers: set[str]) -> None:
        """Seed the cache for these tickers and start the background update task."""

    @abstractmethod
    async def stop(self) -> None:
        """Cancel the background task."""

    @abstractmethod
    async def add_ticker(self, ticker: str) -> bool:
        """Start tracking a ticker. Return False if the source cannot price it.

        On True the cache already holds a price, so the ticker is immediately tradable.
        """

    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None:
        """Stop tracking a ticker and drop it from the cache."""

    @property
    @abstractmethod
    def tickers(self) -> set[str]:
        """Tickers currently tracked."""
```

Contract both implementations honor:

| Behavior | Simulator | Massive |
|---|---|---|
| Update cadence | ~500 ms | `MASSIVE_POLL_INTERVAL` seconds (default 15) |
| `add_ticker` for an unknown symbol | always `True` (random seed price) | `False` if Massive has no previous-day bar |
| Cache seeded before `add_ticker` returns | yes | yes (previous close, refined by next poll) |
| `add_ticker` on an already tracked ticker | no-op, `True` | no-op, `True` |
| Ticker format validation (`^[A-Z]{1,5}$`) | done by the watchlist service, not the source | same |

## 6. Factory

```python
# factory.py
import os

from .cache import PriceCache
from .interface import MarketDataSource
from .massive_source import MassiveDataSource
from .simulator import SimulatorDataSource


def create_market_data_source(cache: PriceCache) -> MarketDataSource:
    """Massive when MASSIVE_API_KEY is set and non-empty, otherwise the simulator."""
    api_key = os.getenv("MASSIVE_API_KEY", "").strip()
    if api_key:
        poll_interval = float(os.getenv("MASSIVE_POLL_INTERVAL", "15"))
        return MassiveDataSource(cache, api_key, poll_interval)
    return SimulatorDataSource(cache)
```

## 7. `MassiveDataSource`

Polls one endpoint per interval for all tracked tickers (see `massiveapi.md` section 7):

- **Live mode** (Starter plan and above): Full Market Snapshot with `tickers=...`.
- **End-of-day mode** (free Basic plan): the snapshot returns `NOT_AUTHORIZED`, so the source switches once, logs it, and uses Grouped Daily for the latest trading day. Prices are then static during the day, which is the best the free plan offers.

The `massive` client is synchronous, so every call goes through `asyncio.to_thread`.

```python
# massive_source.py
import asyncio
import logging
from datetime import date, timedelta

from massive import RESTClient
from massive.exceptions import BadResponse
from massive.rest.models import TickerSnapshot

from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)


def snapshot_price(snapshot: TickerSnapshot) -> float | None:
    """Best available price: last trade, minute bar, day bar, then previous close."""
    candidates = [
        snapshot.last_trade.price if snapshot.last_trade else None,
        snapshot.min.close if snapshot.min else None,
        snapshot.day.close if snapshot.day else None,
        snapshot.prev_day.close if snapshot.prev_day else None,
    ]
    return next((price for price in candidates if price), None)


class MassiveDataSource(MarketDataSource):
    """Polls the Massive REST API and writes prices into the cache."""

    def __init__(self, cache: PriceCache, api_key: str, poll_interval: float) -> None:
        super().__init__(cache)
        self.client = RESTClient(api_key=api_key)
        self.poll_interval = poll_interval
        self.end_of_day_mode = False
        self._tickers: set[str] = set()
        self._task: asyncio.Task | None = None

    @property
    def tickers(self) -> set[str]:
        return set(self._tickers)

    async def start(self, tickers: set[str]) -> None:
        self._tickers = set(tickers)
        await self.poll_once()
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()

    async def add_ticker(self, ticker: str) -> bool:
        if ticker in self._tickers:
            return True
        bars = await asyncio.to_thread(self.client.get_previous_close_agg, ticker)
        if not bars:
            return False
        self._tickers.add(ticker)
        self.cache.update(ticker, bars[0].close)
        return True

    async def remove_ticker(self, ticker: str) -> None:
        self._tickers.discard(ticker)
        self.cache.remove(ticker)

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.sleep(self.poll_interval)
            try:
                await self.poll_once()
            except Exception:
                logger.exception("Massive poll failed; retrying next interval")

    async def poll_once(self) -> None:
        """Fetch prices for every tracked ticker in a single API call."""
        if not self._tickers:
            return
        if not self.end_of_day_mode:
            try:
                prices = await asyncio.to_thread(self._fetch_snapshot_prices)
            except BadResponse as error:
                if "NOT_AUTHORIZED" not in str(error):
                    raise
                logger.warning("Massive plan has no snapshot access; using end-of-day prices")
                self.end_of_day_mode = True
        if self.end_of_day_mode:
            prices = await asyncio.to_thread(self._fetch_end_of_day_prices)
        for ticker, price in prices.items():
            self.cache.update(ticker, price)

    def _fetch_snapshot_prices(self) -> dict[str, float]:
        snapshots = self.client.get_snapshot_all("stocks", tickers=sorted(self._tickers))
        prices = {snap.ticker: snapshot_price(snap) for snap in snapshots}
        return {ticker: price for ticker, price in prices.items() if price}

    def _fetch_end_of_day_prices(self) -> dict[str, float]:
        day = date.today()
        for _ in range(7):
            bars = self.client.get_grouped_daily_aggs(day.isoformat())
            if bars:
                return {bar.ticker: bar.close for bar in bars if bar.ticker in self._tickers}
            day -= timedelta(days=1)
        return {}
```

Notes:

- A poll error (network, 5xx after client retries) is logged and the loop continues; the cache keeps the last good prices. This is the one place a broad `except` is justified: a background task must not die silently.
- Massive timestamps are not copied into the cache; the cache stamps the time the price was received, which is what the frontend charts need.
- Free tier budget: one poll per 15 s = 4 calls/min, leaving one call/min for `add_ticker` validation.

## 8. Wiring into FastAPI

```python
# app/main.py (excerpt)
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.market import PriceCache, create_market_data_source


@asynccontextmanager
async def lifespan(app: FastAPI):
    cache = PriceCache()
    source = create_market_data_source(cache)
    await source.start(load_tracked_tickers())  # watchlist ∪ positions from SQLite
    app.state.price_cache = cache
    app.state.market_source = source
    yield
    await source.stop()


app = FastAPI(lifespan=lifespan)
```

Route handlers get them via `request.app.state.price_cache` / `request.app.state.market_source` (or small `Depends` helpers).

## 9. How Consumers Use It

**SSE stream** — send all prices only when the cache version changed:

```python
async def price_events(cache: PriceCache):
    last_version = -1
    while True:
        if cache.version != last_version:
            last_version = cache.version
            payload = {ticker: update.to_dict() for ticker, update in cache.all().items()}
            yield f"data: {json.dumps(payload)}\n\n"
        await asyncio.sleep(0.5)
```

**Trade execution** — a trade needs a cached price:

```python
price = cache.get_price(ticker)
if price is None:
    raise TradeError(f"Unknown ticker: {ticker}")
```

**Watchlist add**:

```python
if not TICKER_PATTERN.fullmatch(ticker):
    raise ValidationError("Invalid ticker")
if not await source.add_ticker(ticker):
    raise ValidationError(f"Ticker not found: {ticker}")
insert_watchlist_row(ticker)
```

**Watchlist remove** — keep tracking if the ticker is still held:

```python
delete_watchlist_row(ticker)
if not has_position(ticker):
    await source.remove_ticker(ticker)
```

A sell that closes a position does the mirror check: if the ticker is not on the watchlist, call `remove_ticker`.

## 10. Testing

| Test | What it checks |
|---|---|
| `test_cache.py` | first update sets open and previous = price; second update shifts previous; version increments; `to_dict` fields and `direction` |
| `test_factory.py` | empty/absent key gives simulator; set key gives Massive (monkeypatch env) |
| `test_massive_source.py` | `snapshot_price` fallback order; NOT_AUTHORIZED switches to end-of-day mode; `add_ticker` returns False on empty previous-close result. Use a fake `client` object, no network |
| `test_interface_conformance.py` | both sources: `start` seeds cache, `add_ticker` seeds cache before returning, `remove_ticker` drops it |

Environment variables used by this module:

| Variable | Default | Meaning |
|---|---|---|
| `MASSIVE_API_KEY` | empty | Non-empty selects the Massive source |
| `MASSIVE_POLL_INTERVAL` | `15` | Seconds between Massive polls (2-5 on paid plans) |
