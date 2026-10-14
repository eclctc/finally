# Market Data Backend — Detailed Design

Implementation design for everything market data in the FinAlly backend: the unified interface, the shared price cache, the GBM simulator, the Massive (Polygon.io) poller, the SSE stream, and how the rest of the backend uses them. All code below is complete and copy-ready. It was run and tested (26 passing pytest tests, plus a live check of `/api/stream/prices` under uvicorn) before being written here.

This document consolidates and supersedes, for implementation purposes:

- `marketinterface.md` — the unified interface (sections 3-7, 10 here)
- `marketsimulator.md` — simulator model and parameters (section 8 here)
- `massiveapi.md` — Massive endpoints, plans and errors (section 9 here; still the API reference)
- `PLAN.md` sections 6 and 8 — the contract this design implements

## Contents

1. Scope and requirements
2. Architecture and data flow
3. Module layout and dependencies
4. `PriceUpdate` and the SSE payload
5. `PriceCache`
6. `MarketDataError`
7. `MarketDataSource` — the unified interface
8. Simulator
9. Massive data source
10. Factory and environment variables
11. SSE streaming
12. FastAPI wiring
13. Integration with watchlist, trades and portfolio
14. Failure modes and edge cases
15. Tests
16. Implementation checklist

---

## 1. Scope and Requirements

From `PLAN.md`:

| Requirement | Where it is met |
|---|---|
| One interface, two implementations, chosen by `MASSIVE_API_KEY` | §7, §10 |
| Simulator: GBM, ~500 ms ticks, correlated moves, random 2-5% events, realistic seeds | §8 |
| Massive: REST polling of all tracked tickers, 15 s on free tier, 2-15 s on paid | §9 |
| Cache holds latest price, previous price, timestamp, session open price | §5 |
| Tracked set = watchlist ∪ held positions | §12, §13 |
| SSE `GET /api/stream/prices`, one JSON object keyed by ticker, sent only on cache version change | §11 |
| Each entry has `ticker, price, previous_price, open_price, timestamp, change, change_percent, direction` | §4 |
| Trades need a cached price; watchlist add needs the source to price the ticker | §13 |
| Simulator prices any `^[A-Z]{1,5}$` symbol; Massive rejects unknown tickers with 400 | §8, §9, §13 |

Out of scope: historical bars, order books, WebSocket feeds, multi-user fan-out.

### Changes from the earlier planning notes

The code in `marketinterface.md` / `marketsimulator.md` was the starting point. Testing it surfaced these fixes, all applied below:

| Issue | Fix |
|---|---|
| Massive worker thread iterated `self._tickers` while the event loop could mutate it (`set changed size during iteration`) | The loop passes a sorted copy into the thread |
| A ticker removed during an in-flight poll was written back into the cache when the poll returned | Results are filtered against the current tracked set before writing |
| A Massive network failure during `start()` crashed app startup | Startup poll errors are logged; the loop retries |
| Tickers missing from the first Massive poll (e.g. a held position) had no price, so the position could not be valued | `start()` backfills them from the previous close |
| End-of-day mode re-downloaded the whole-market Grouped Daily file (~10k rows) every 15 s | Closes are kept in memory and refreshed every 30 minutes; `add_ticker` is answered from them with no API call |
| `add_ticker` could not distinguish "unknown ticker" from "Massive is down" | Unknown → `False` (HTTP 400); unreachable → `MarketDataError` (HTTP 503) |
| `stop()` cancelled the task without awaiting it; duplicated in both sources | One shared `stop()` in the base class that cancels and awaits, and is idempotent |
| An exception in the simulator loop killed the task silently | Logged and the loop continues |
| Per-tick sector shocks were drawn in set order, so a seeded RNG was not reproducible across runs | Sectors are sorted |
| SSE had no reconnect hint, no keepalive, no disconnect detection | `retry:` line, comment keepalive every 15 s, loop ends on client disconnect |
| `PYPL` (the ticker the mock LLM adds) got a random price | Added to the known-ticker profiles with a few other likely additions |
| Bad `MASSIVE_POLL_INTERVAL` crashed startup; tiny values could hammer the API | Parsed defensively, clamped to ≥ 2 s |

---

## 2. Architecture and Data Flow

```
                  MASSIVE_API_KEY set and non-empty?
                               │
                  ┌────────────┴────────────┐
                 yes                        no
                  ▼                         ▼
          MassiveDataSource         SimulatorDataSource       one background asyncio task
          (poll every N s)          (step every 0.5 s)
                  │                         │
                  └────────── writes ───────┘
                               ▼
                          PriceCache            latest / previous / session open / version
                               │ reads
        ┌──────────────┬───────┴──────┬──────────────────┬───────────────┐
        ▼              ▼              ▼                  ▼               ▼
  SSE /api/stream  execute_trade  GET /api/portfolio  GET /api/watchlist  chat context
     /prices

  Watchlist + trade services ──add_ticker / remove_ticker──▶ the active source
```

Rules:

1. Exactly one source runs, created by the factory and started in the FastAPI lifespan.
2. Only the source writes to the cache. Everything else reads.
3. All cache reads and writes happen on the event loop thread. Massive's synchronous HTTP calls run in worker threads via `asyncio.to_thread`, but the threads only return data; the loop writes it. No locks.
4. The source tracks the **union of watchlist tickers and held positions**. The watchlist and trade services keep that union correct (§13).
5. Downstream code never checks which source is running.

---

## 3. Module Layout and Dependencies

```
backend/
├── pyproject.toml
├── app/
│   ├── main.py                 # FastAPI app + lifespan (§12)
│   └── market/
│       ├── __init__.py         # public exports
│       ├── models.py           # PriceUpdate
│       ├── cache.py            # PriceCache
│       ├── errors.py           # MarketDataError
│       ├── interface.py        # MarketDataSource (ABC)
│       ├── seed_prices.py      # TickerProfile, KNOWN_TICKERS
│       ├── simulator.py        # GBMSimulator, SimulatorDataSource
│       ├── massive_source.py   # MassiveDataSource
│       ├── factory.py          # create_market_data_source()
│       ├── stream.py           # price_events() SSE generator
│       └── router.py           # GET /api/stream/prices
└── tests/
    └── market/
        ├── test_cache.py
        ├── test_simulator.py
        ├── test_massive_source.py
        ├── test_factory.py
        ├── test_stream.py
        └── test_conformance.py
```

Other agents own the rest of `app/` (db, portfolio, watchlist, chat). They import only from `app.market` (the `__init__` exports) plus `app.market.router`.

`backend/pyproject.toml` (market data needs; other agents add theirs):

```toml
[project]
name = "finally-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["fastapi", "uvicorn[standard]", "massive"]

[dependency-groups]
dev = ["pytest", "pytest-asyncio", "httpx"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

Install: `cd backend && uv add fastapi "uvicorn[standard]" massive && uv add --dev pytest pytest-asyncio httpx`.

The Docker image uses Python 3.12 (PLAN §11), so `requires-python = ">=3.12"`. The repo-root `pyproject.toml` (3.14) is not the backend project. The simulator uses only the standard library (no numpy).

`app/market/__init__.py`:

```python
from .cache import PriceCache
from .errors import MarketDataError
from .factory import create_market_data_source
from .interface import MarketDataSource
from .models import PriceUpdate

__all__ = [
    "MarketDataError",
    "MarketDataSource",
    "PriceCache",
    "PriceUpdate",
    "create_market_data_source",
]
```

---

## 4. `PriceUpdate` and the SSE Payload

One immutable record per ticker. Its `to_dict()` is exactly the SSE entry from PLAN §6.

`app/market/models.py`:

```python
from dataclasses import asdict, dataclass


@dataclass(frozen=True, slots=True)
class PriceUpdate:
    """Latest price for one ticker, with the values derived from it."""

    ticker: str
    price: float
    previous_price: float
    open_price: float
    timestamp: float  # Unix seconds, when the backend received the price

    @property
    def change(self) -> float:
        return round(self.price - self.previous_price, 4)

    @property
    def change_percent(self) -> float:
        if not self.previous_price:
            return 0.0
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

- `change` and `change_percent` are vs. the previous tick. `direction` drives the green/red flash.
- Daily change % (shown in the watchlist) is computed by the frontend: `(price - open_price) / open_price * 100`.
- `timestamp` is when the backend received the price (Unix seconds, float), not the exchange time. That is what the frontend charts need, and it is uniform across both sources.
- Prices are rounded to cents in the cache, so a tick that moves less than half a cent reports `direction: "flat"`.

### Example SSE frame

```
data: {"AAPL": {"ticker": "AAPL", "price": 190.03, "previous_price": 190.01, "open_price": 190.0, "timestamp": 1792004392.83, "change": 0.02, "change_percent": 0.0105, "direction": "up"}, "GOOGL": {"ticker": "GOOGL", "price": 174.88, "previous_price": 174.95, "open_price": 175.0, "timestamp": 1792004392.83, "change": -0.07, "change_percent": -0.04, "direction": "down"}}

```

(Captured from the running implementation; trimmed to two tickers.)

### TypeScript type for the frontend

```ts
export type Direction = "up" | "down" | "flat";

export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  open_price: number;
  timestamp: number; // Unix seconds
  change: number;
  change_percent: number; // vs previous tick
  direction: Direction;
}

export type PriceMap = Record<string, PriceUpdate>;
```

Every frame contains **all** tracked tickers: watchlist ∪ held positions. So the watchlist panel should take its rows from `GET /api/watchlist` and look up prices in the latest frame, rather than rendering every key in the frame. A ticker missing from a frame is no longer tracked.

---

## 5. `PriceCache`

`app/market/cache.py`:

```python
import time

from .models import PriceUpdate


class PriceCache:
    """Latest price per ticker. Written by the market data source, read by everyone else.

    Single process, single event loop: every read and write happens on the loop
    thread, so no lock is needed. `version` increases on every change so the SSE
    stream can tell whether there is anything new to send.
    """

    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self.version = 0

    def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
        """Record a new price. The first price seen for a ticker becomes its session open."""
        price = round(price, 2)
        previous = self._prices.get(ticker)
        update = PriceUpdate(
            ticker=ticker,
            price=price,
            previous_price=previous.price if previous else price,
            open_price=previous.open_price if previous else price,
            timestamp=timestamp if timestamp is not None else time.time(),
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
        if self._prices.pop(ticker, None) is not None:
            self.version += 1

    def __contains__(self, ticker: str) -> bool:
        return ticker in self._prices

    def __len__(self) -> int:
        return len(self._prices)
```

Semantics:

| Event | `price` | `previous_price` | `open_price` | `version` |
|---|---|---|---|---|
| First update for a ticker | p | p | p (session open) | +1 |
| Later update | p | last price | unchanged | +1 |
| `remove` of tracked ticker | — | — | — | +1 |
| `remove` of untracked ticker | — | — | — | unchanged |

- The session open is the first price seen since backend start (or since the ticker was re-added after removal). With the simulator that is the seed price; with Massive it is the first polled price.
- `version` is a plain counter. The SSE loop compares it to the last version it sent.
- In end-of-day Massive mode the same close is rewritten every poll. The version still increments, so clients receive an identical frame every poll interval. This is harmless and keeps sparklines advancing in time.

---

## 6. `MarketDataError`

`app/market/errors.py`:

```python
class MarketDataError(Exception):
    """The price source could not be reached or returned an unusable response.

    Distinct from "ticker not found", which add_ticker reports by returning False.
    """
```

Raised only by `add_ticker` when the source cannot be reached. Routes map it to HTTP 503 (§13). The simulator never raises it.

---

## 7. `MarketDataSource` — the Unified Interface

`app/market/interface.py`:

```python
import asyncio
import contextlib
from abc import ABC, abstractmethod

from .cache import PriceCache


class MarketDataSource(ABC):
    """A background producer of prices that writes into a PriceCache.

    Subclasses implement start/add_ticker/remove_ticker/tickers and store their
    background task in self._task; stop() is shared.
    """

    name: str = "unknown"

    def __init__(self, cache: PriceCache) -> None:
        self.cache = cache
        self._task: asyncio.Task | None = None

    @abstractmethod
    async def start(self, tickers: set[str]) -> None:
        """Seed the cache for these tickers, then start the background update task."""

    async def stop(self) -> None:
        """Cancel the background task and wait for it to finish."""
        if self._task is None:
            return
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task
        self._task = None

    @abstractmethod
    async def add_ticker(self, ticker: str) -> bool:
        """Start tracking a ticker. Return False if the source cannot price it.

        On True the cache already holds a price, so the ticker is immediately tradable.
        Raises MarketDataError if the source is unreachable (not the same as "unknown").
        """

    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None:
        """Stop tracking a ticker and drop it from the cache."""

    @property
    @abstractmethod
    def tickers(self) -> set[str]:
        """Tickers currently tracked."""

    def status(self) -> dict:
        """Small description for /api/health and logs."""
        return {"source": self.name, "tickers": len(self.tickers), "running": self._task is not None}
```

Contract both implementations honor (enforced by `test_conformance.py`):

| Behavior | Simulator | Massive |
|---|---|---|
| Update cadence | 0.5 s | `MASSIVE_POLL_INTERVAL` (default 15 s, min 2 s) |
| After `start(tickers)` returns | every ticker has a cached price | every ticker Massive knows has a cached price; startup never raises |
| `add_ticker(new)` | always `True`; known profile or random seed $20-$400 | `True` with previous close cached; `False` if Massive has no data; `MarketDataError` if unreachable |
| `add_ticker(already tracked)` | `True`, no-op | `True`, no-op, no API call |
| Cache seeded before `add_ticker` returns | yes | yes |
| `remove_ticker` | stops simulating, drops from cache | stops polling, drops from cache |
| `stop()` | cancels and awaits the task; idempotent | same |
| Ticker format validation | not the source's job (watchlist service, §13) | same |
| `status()` | `{"source": "simulator", "tickers": n, "running": bool}` | same plus `"mode": "live" \| "end_of_day"` |

---

## 8. Simulator

The default source when `MASSIVE_API_KEY` is absent. Standard library only, deterministic under a seeded `random.Random`.

### 8.1 Model

**Geometric Brownian motion**, exact discretization, per tick:

```
S(t+dt) = S(t) · exp( (μ − σ²/2)·dt + σ·√dt·Z )
```

`μ` annual drift, `σ` annual volatility, `Z` standard normal. The exponential keeps prices strictly positive. Prices are kept at full precision inside the simulator and rounded to cents only in the cache, so sub-cent moves accumulate correctly.

**Time acceleration.** At real speed a 0.5 s tick moves a $190 stock by about a cent, which looks dead. `TIME_SCALE = 60` makes one real second one simulated trading minute:

```
dt = 0.5 s × 60 / (252 days × 6.5 h × 3600 s) ≈ 5.09e-6 trading years
per-tick σ for AAPL (σ=0.25): 0.25 × √5.09e-6 ≈ 0.056 %  (~$0.11)
over 10 minutes (1,200 ticks):  ≈ 1.9 %
```

Lively, but a session does not drift into absurd prices.

**Correlated shocks via a factor model** (no correlation matrix, so tickers can be added and removed freely):

```
Z_i = a·M + b·S_sector(i) + c·E_i       a² = 0.3, b² = 0.3, c² = 0.4  (sum = 1)
```

`M` one market draw per tick, `S_sector` one draw per sector per tick, `E_i` one idiosyncratic draw per ticker. Resulting correlation: same sector `a² + b² = 0.6`; different sectors `a² = 0.3`. Verified by test to within 0.05.

**Random events.** Each ticker each tick, with probability `0.0005`, the price is multiplied by `1 ± U(0.02, 0.05)`. With 10 tickers at 2 ticks/s that is about one jump every 100 s somewhere on the watchlist: enough drama, not constant noise.

### 8.2 Seed data

`app/market/seed_prices.py`:

```python
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TickerProfile:
    """Starting price and GBM parameters for one ticker."""

    seed_price: float
    sigma: float  # annual volatility
    mu: float  # annual drift
    sector: str


KNOWN_TICKERS: dict[str, TickerProfile] = {
    # Default watchlist
    "AAPL": TickerProfile(190.0, 0.25, 0.08, "tech"),
    "GOOGL": TickerProfile(175.0, 0.28, 0.08, "tech"),
    "MSFT": TickerProfile(420.0, 0.24, 0.08, "tech"),
    "META": TickerProfile(500.0, 0.35, 0.10, "tech"),
    "NVDA": TickerProfile(130.0, 0.50, 0.15, "tech"),
    "AMZN": TickerProfile(185.0, 0.30, 0.08, "consumer"),
    "TSLA": TickerProfile(250.0, 0.60, 0.05, "consumer"),
    "NFLX": TickerProfile(650.0, 0.35, 0.08, "consumer"),
    "JPM": TickerProfile(200.0, 0.20, 0.06, "finance"),
    "V": TickerProfile(280.0, 0.18, 0.06, "finance"),
    # Likely additions (PYPL is the ticker the mock LLM adds)
    "PYPL": TickerProfile(70.0, 0.40, 0.05, "finance"),
    "AMD": TickerProfile(160.0, 0.50, 0.12, "tech"),
    "INTC": TickerProfile(30.0, 0.40, 0.02, "tech"),
    "DIS": TickerProfile(100.0, 0.28, 0.05, "consumer"),
    "BAC": TickerProfile(40.0, 0.25, 0.06, "finance"),
}

UNKNOWN_PRICE_RANGE = (20.0, 400.0)
UNKNOWN_SIGMA = 0.35
UNKNOWN_MU = 0.05
UNKNOWN_SECTOR = "other"
```

| Ticker | Seed | σ | μ | Sector |
|---|---|---|---|---|
| AAPL | 190 | 0.25 | 0.08 | tech |
| GOOGL | 175 | 0.28 | 0.08 | tech |
| MSFT | 420 | 0.24 | 0.08 | tech |
| META | 500 | 0.35 | 0.10 | tech |
| NVDA | 130 | 0.50 | 0.15 | tech |
| AMZN | 185 | 0.30 | 0.08 | consumer |
| TSLA | 250 | 0.60 | 0.05 | consumer |
| NFLX | 650 | 0.35 | 0.08 | consumer |
| JPM | 200 | 0.20 | 0.06 | finance |
| V | 280 | 0.18 | 0.06 | finance |
| PYPL, AMD, INTC, DIS, BAC | see code | | | |
| anything else | U($20, $400) | 0.35 | 0.05 | other |

Unknown tickers draw their seed from the simulator's own RNG, so tests are deterministic.

### 8.3 Code

Two classes: `GBMSimulator` is pure math (no asyncio, no cache), `SimulatorDataSource` is the thin async adapter.

`app/market/simulator.py`:

```python
import asyncio
import logging
import math
import random

from .cache import PriceCache
from .interface import MarketDataSource
from .seed_prices import (
    KNOWN_TICKERS,
    UNKNOWN_MU,
    UNKNOWN_PRICE_RANGE,
    UNKNOWN_SECTOR,
    UNKNOWN_SIGMA,
    TickerProfile,
)

logger = logging.getLogger(__name__)

TICK_SECONDS = 0.5
TIME_SCALE = 60  # 1 real second = 1 simulated trading minute
TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600
DT = TICK_SECONDS * TIME_SCALE / TRADING_SECONDS_PER_YEAR

# Factor loadings: squares sum to 1 so each shock stays standard normal.
MARKET_LOADING = math.sqrt(0.3)
SECTOR_LOADING = math.sqrt(0.3)
IDIOSYNCRATIC_LOADING = math.sqrt(0.4)

EVENT_PROBABILITY = 0.0005  # per ticker per tick
EVENT_MOVE_RANGE = (0.02, 0.05)


class GBMSimulator:
    """Correlated geometric Brownian motion over a changing set of tickers. Pure math, no I/O."""

    def __init__(self, rng: random.Random | None = None) -> None:
        self.rng = rng or random.Random()
        self.profiles: dict[str, TickerProfile] = {}
        self.prices: dict[str, float] = {}

    def add(self, ticker: str) -> float:
        """Start simulating a ticker and return its current (seed) price."""
        if ticker not in self.prices:
            profile = KNOWN_TICKERS.get(ticker) or self._random_profile()
            self.profiles[ticker] = profile
            self.prices[ticker] = profile.seed_price
        return self.prices[ticker]

    def remove(self, ticker: str) -> None:
        self.profiles.pop(ticker, None)
        self.prices.pop(ticker, None)

    def step(self) -> dict[str, float]:
        """Advance every ticker by one tick and return the new prices."""
        market_shock = self.rng.gauss(0, 1)
        sector_shocks = {sector: self.rng.gauss(0, 1) for sector in self._sectors()}
        for ticker, profile in self.profiles.items():
            shock = (
                MARKET_LOADING * market_shock
                + SECTOR_LOADING * sector_shocks[profile.sector]
                + IDIOSYNCRATIC_LOADING * self.rng.gauss(0, 1)
            )
            price = self.prices[ticker] * self._gbm_factor(profile, shock)
            self.prices[ticker] = price * self._event_factor()
        return dict(self.prices)

    def _gbm_factor(self, profile: TickerProfile, shock: float) -> float:
        drift = (profile.mu - profile.sigma**2 / 2) * DT
        diffusion = profile.sigma * math.sqrt(DT) * shock
        return math.exp(drift + diffusion)

    def _event_factor(self) -> float:
        if self.rng.random() >= EVENT_PROBABILITY:
            return 1.0
        move = self.rng.uniform(*EVENT_MOVE_RANGE)
        return 1 + move if self.rng.random() < 0.5 else 1 - move

    def _random_profile(self) -> TickerProfile:
        seed_price = round(self.rng.uniform(*UNKNOWN_PRICE_RANGE), 2)
        return TickerProfile(seed_price, UNKNOWN_SIGMA, UNKNOWN_MU, UNKNOWN_SECTOR)

    def _sectors(self) -> list[str]:
        # Sorted so a seeded rng gives the same sequence on every run.
        return sorted({profile.sector for profile in self.profiles.values()})


class SimulatorDataSource(MarketDataSource):
    """Runs GBMSimulator every TICK_SECONDS and writes prices into the cache."""

    name = "simulator"

    def __init__(self, cache: PriceCache, simulator: GBMSimulator | None = None) -> None:
        super().__init__(cache)
        self.simulator = simulator or GBMSimulator()

    @property
    def tickers(self) -> set[str]:
        return set(self.simulator.prices)

    async def start(self, tickers: set[str]) -> None:
        for ticker in sorted(tickers):
            await self.add_ticker(ticker)
        self._task = asyncio.create_task(self._run(), name="market-simulator")

    async def add_ticker(self, ticker: str) -> bool:
        if ticker not in self.simulator.prices:
            self.cache.update(ticker, self.simulator.add(ticker))
        return True

    async def remove_ticker(self, ticker: str) -> None:
        self.simulator.remove(ticker)
        self.cache.remove(ticker)

    async def _run(self) -> None:
        while True:
            await asyncio.sleep(TICK_SECONDS)
            try:
                for ticker, price in self.simulator.step().items():
                    self.cache.update(ticker, price)
            except Exception:
                logger.exception("Simulator step failed; continuing")
```

### 8.4 Tuning knobs

Module constants in `simulator.py`. Change these, not the code.

| Constant | Default | Effect |
|---|---|---|
| `TICK_SECONDS` | 0.5 | Update cadence (PLAN: ~500 ms) |
| `TIME_SCALE` | 60 | Higher = more motion per tick (volatility scales with √) |
| `MARKET_LOADING²` / `SECTOR_LOADING²` | 0.3 / 0.3 | Cross-sector / extra same-sector correlation; idiosyncratic is the remainder |
| `EVENT_PROBABILITY` | 0.0005 | Jump chance per ticker per tick |
| `EVENT_MOVE_RANGE` | (0.02, 0.05) | Jump size |

### 8.5 Behavior notes

- On backend restart prices reset to seeds and the session open resets with them. Expected for a simulator; held positions are re-valued from the seed.
- Removing then re-adding a known ticker restarts it at its seed. An unknown ticker gets a new random seed.
- `step()` and `add_ticker()` both run on the event loop and never interleave, so the dicts are never mutated mid-iteration.

---

## 9. Massive Data Source

Used when `MASSIVE_API_KEY` is set. API reference: `massiveapi.md`. Client: PyPI `massive` 2.8.0 (`from massive import RESTClient`), synchronous, with built-in retry on 429/5xx (3 retries, 10 s connect/read timeouts by default).

### 9.1 Two modes, detected at runtime

| Mode | Plan | Endpoint per poll | Price freshness |
|---|---|---|---|
| **Live** | Starter and above | Full Market Snapshot `GET /v2/snapshot/locale/us/markets/stocks/tickers?tickers=A,B,C` — one call for all tickers | Real-time (Advanced) or 15-min delayed (Starter/Developer) |
| **End-of-day** | Free Basic | Grouped Daily `GET /v2/aggs/grouped/locale/us/market/stocks/{date}`, cached in memory, refreshed every 30 min | Latest close; static during the day |

The source starts in live mode. The first snapshot call that fails with `NOT_AUTHORIZED` (HTTP 403 on the free plan) switches it to end-of-day mode permanently, with one warning in the log. No configuration needed.

Ticker validation (`add_ticker`): in end-of-day mode the in-memory whole-market closes answer it with no API call; otherwise one Previous Day Bar call (`GET /v2/aggs/ticker/{T}/prev`), whose empty result means "unknown ticker".

**Free-tier rate budget (5 calls/min):** in end-of-day mode steady state is ~1 Grouped Daily call per 30 min (up to 7 when stepping back over a weekend or holiday). Previous Day Bar calls happen only for startup backfill and for adds not found in the closes. Well inside the limit.

### 9.2 Choosing a price from a snapshot

First non-empty, non-zero value of: `last_trade.price` → `min.close` → `day.close` → `prev_day.close`. Zero values occur in the window after Massive's daily 3:30 AM ET reset, so they are skipped.

### 9.3 Code

`app/market/massive_source.py`:

```python
import asyncio
import logging
import time
from datetime import date, timedelta

from massive import RESTClient
from massive.exceptions import BadResponse
from massive.rest.models import TickerSnapshot

from .cache import PriceCache
from .errors import MarketDataError
from .interface import MarketDataSource

logger = logging.getLogger(__name__)

EOD_REFRESH_SECONDS = 30 * 60  # re-fetch grouped daily at most this often
EOD_LOOKBACK_DAYS = 7  # weekends + holidays


def snapshot_price(snapshot: TickerSnapshot) -> float | None:
    """Best available price: last trade, minute bar, day bar, then previous close.

    Zero values (seen after the daily 3:30 AM ET reset) are skipped.
    """
    candidates = (
        snapshot.last_trade.price if snapshot.last_trade else None,
        snapshot.min.close if snapshot.min else None,
        snapshot.day.close if snapshot.day else None,
        snapshot.prev_day.close if snapshot.prev_day else None,
    )
    return next((price for price in candidates if price), None)


class MassiveDataSource(MarketDataSource):
    """Polls the Massive REST API and writes prices into the cache.

    Live mode (Starter plan and above): one Full Market Snapshot call per poll.
    End-of-day mode (free plan): the snapshot returns NOT_AUTHORIZED once, after which
    the latest Grouped Daily closes are fetched, kept in memory, and refreshed every
    EOD_REFRESH_SECONDS.

    The massive client is synchronous: every call runs in asyncio.to_thread. Worker
    threads receive their own copy of the ticker list and only return data; the cache
    is written on the event loop.
    """

    name = "massive"

    def __init__(self, cache: PriceCache, client: RESTClient, poll_interval: float) -> None:
        super().__init__(cache)
        self.client = client
        self.poll_interval = poll_interval
        self.end_of_day_mode = False
        self._tickers: set[str] = set()
        self._eod_closes: dict[str, float] = {}
        self._eod_fetched_at = 0.0

    @property
    def tickers(self) -> set[str]:
        return set(self._tickers)

    def status(self) -> dict:
        return super().status() | {"mode": "end_of_day" if self.end_of_day_mode else "live"}

    async def start(self, tickers: set[str]) -> None:
        self._tickers = set(tickers)
        try:
            await self.poll_once()
        except Exception:
            # Never block app startup on the network; the loop retries.
            logger.exception("Initial Massive poll failed; will retry")
        await self._backfill_missing()
        self._task = asyncio.create_task(self._poll_loop(), name="market-massive")

    async def add_ticker(self, ticker: str) -> bool:
        if ticker in self._tickers:
            return True
        price = await self._lookup_price(ticker)
        if price is None:
            return False
        self._tickers.add(ticker)
        self.cache.update(ticker, price)
        return True

    async def remove_ticker(self, ticker: str) -> None:
        self._tickers.discard(ticker)
        self.cache.remove(ticker)

    async def poll_once(self) -> None:
        """Fetch prices for every tracked ticker and write them to the cache."""
        tickers = sorted(self._tickers)
        if not tickers:
            return
        prices = await self._fetch_prices(tickers)
        for ticker, price in prices.items():
            if ticker in self._tickers:  # removed while the request was in flight
                self.cache.update(ticker, price)

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.sleep(self.poll_interval)
            try:
                await self.poll_once()
            except Exception:
                logger.exception("Massive poll failed; keeping last prices, retrying next interval")

    async def _fetch_prices(self, tickers: list[str]) -> dict[str, float]:
        if not self.end_of_day_mode:
            try:
                return await asyncio.to_thread(self._fetch_snapshot_prices, tickers)
            except BadResponse as error:
                if "NOT_AUTHORIZED" not in str(error):
                    raise
                logger.warning("Massive plan has no snapshot access; switching to end-of-day prices")
                self.end_of_day_mode = True
        closes = await self._end_of_day_closes()
        return {ticker: closes[ticker] for ticker in tickers if ticker in closes}

    def _fetch_snapshot_prices(self, tickers: list[str]) -> dict[str, float]:
        snapshots = self.client.get_snapshot_all("stocks", tickers=tickers)
        prices = {snap.ticker: snapshot_price(snap) for snap in snapshots}
        return {ticker: price for ticker, price in prices.items() if ticker and price}

    async def _end_of_day_closes(self) -> dict[str, float]:
        """Whole-market closes for the latest trading day, cached for EOD_REFRESH_SECONDS."""
        if time.monotonic() - self._eod_fetched_at >= EOD_REFRESH_SECONDS or not self._eod_closes:
            closes = await asyncio.to_thread(self._fetch_grouped_daily)
            if closes:
                self._eod_closes = closes
                self._eod_fetched_at = time.monotonic()
        return self._eod_closes

    def _fetch_grouped_daily(self) -> dict[str, float]:
        day = date.today()
        for _ in range(EOD_LOOKBACK_DAYS):
            bars = self.client.get_grouped_daily_aggs(day.isoformat())
            if bars:
                return {bar.ticker: bar.close for bar in bars if bar.ticker and bar.close}
            day -= timedelta(days=1)
        return {}

    async def _lookup_price(self, ticker: str) -> float | None:
        """Price for a ticker not yet tracked, or None if Massive does not know it."""
        if self.end_of_day_mode and ticker in self._eod_closes:
            return self._eod_closes[ticker]  # no API call
        try:
            bars = await asyncio.to_thread(self.client.get_previous_close_agg, ticker)
        except Exception as error:
            raise MarketDataError(f"Massive lookup failed for {ticker}") from error
        return bars[0].close if bars and bars[0].close else None

    async def _backfill_missing(self) -> None:
        """Give every tracked ticker a price at startup, so held positions are always valued."""
        for ticker in sorted(self._tickers - set(self.cache.all())):
            try:
                price = await self._lookup_price(ticker)
            except MarketDataError:
                logger.warning("No startup price for %s; next poll will retry", ticker)
                continue
            if price is None:
                logger.warning("Massive does not know %s; it will have no price", ticker)
            else:
                self.cache.update(ticker, price)
```

The `RESTClient` is injected (the factory builds it), so tests pass a fake client with no network and no monkeypatching of the `massive` package.

### 9.4 Failure behavior

| Failure | Behavior |
|---|---|
| Network error / 5xx after client retries during a poll | Logged; cache keeps last good prices; next poll retries |
| `NOT_AUTHORIZED` on snapshot | Switch to end-of-day mode once; never retry the snapshot |
| Any other `BadResponse` on snapshot (e.g. invalid key) | Logged each poll; prices stay at last values |
| Network error during `start()` | Logged; app starts; backfill tries previous close per ticker; loop retries |
| Ticker unknown to Massive at startup (e.g. a delisted holding) | Logged; ticker has no price. Trades in it are rejected as unknown; valuation treats it per §13 |
| `add_ticker` network error | `MarketDataError` → HTTP 503 |
| `add_ticker` for a symbol Massive does not know | `False` → HTTP 400 |
| Grouped Daily empty for 7 days back | Returns `{}`; keeps any previously fetched closes |

Only background loops use a broad `except Exception`: a background task must never die silently.

---

## 10. Factory and Environment Variables

`app/market/factory.py`:

```python
import logging
import os

from massive import RESTClient

from .cache import PriceCache
from .interface import MarketDataSource
from .massive_source import MassiveDataSource
from .simulator import SimulatorDataSource

logger = logging.getLogger(__name__)

DEFAULT_POLL_INTERVAL = 15.0
MIN_POLL_INTERVAL = 2.0


def create_market_data_source(cache: PriceCache) -> MarketDataSource:
    """Massive when MASSIVE_API_KEY is set and non-empty, otherwise the simulator."""
    api_key = os.getenv("MASSIVE_API_KEY", "").strip()
    if not api_key:
        logger.info("Market data: simulator")
        return SimulatorDataSource(cache)
    poll_interval = _poll_interval()
    logger.info("Market data: Massive, polling every %ss", poll_interval)
    return MassiveDataSource(cache, RESTClient(api_key=api_key), poll_interval)


def _poll_interval() -> float:
    raw = os.getenv("MASSIVE_POLL_INTERVAL", "").strip()
    try:
        value = float(raw) if raw else DEFAULT_POLL_INTERVAL
    except ValueError:
        logger.warning("Invalid MASSIVE_POLL_INTERVAL=%r; using %s", raw, DEFAULT_POLL_INTERVAL)
        value = DEFAULT_POLL_INTERVAL
    return max(value, MIN_POLL_INTERVAL)
```

| Variable | Default | Meaning |
|---|---|---|
| `MASSIVE_API_KEY` | empty | Non-empty (after trimming) selects Massive; otherwise the simulator |
| `MASSIVE_POLL_INTERVAL` | `15` | Seconds between Massive polls. Use 15 on the free plan, 2-5 on paid plans. Values below 2 are clamped to 2; unparsable values fall back to 15 |

The backend loads `.env` from the project root before the factory runs (`python-dotenv` or Docker `--env-file`; owned by the app wiring, §12).

---

## 11. SSE Streaming

### 11.1 Generator

`app/market/stream.py`:

```python
import asyncio
import json
from collections.abc import AsyncIterator, Awaitable, Callable

from .cache import PriceCache

STREAM_INTERVAL_SECONDS = 0.5
KEEPALIVE_SECONDS = 15.0
RETRY_MILLISECONDS = 1000


async def price_events(
    cache: PriceCache,
    is_disconnected: Callable[[], Awaitable[bool]],
    interval: float = STREAM_INTERVAL_SECONDS,
) -> AsyncIterator[str]:
    """SSE frames: the full price map whenever the cache version changes."""
    yield f"retry: {RETRY_MILLISECONDS}\n\n"
    last_version = -1
    idle = 0.0
    while not await is_disconnected():
        if cache.version != last_version:
            last_version = cache.version
            payload = {ticker: update.to_dict() for ticker, update in cache.all().items()}
            yield f"data: {json.dumps(payload)}\n\n"
            idle = 0.0
        elif idle >= KEEPALIVE_SECONDS:
            yield ": keepalive\n\n"  # comment line; EventSource ignores it
            idle = 0.0
        await asyncio.sleep(interval)
        idle += interval
```

- The first frame is `retry: 1000`, telling `EventSource` to reconnect after 1 s if the connection drops.
- The full price map is sent immediately on connect (version `-1` never matches), so a new client sees prices at once. After that, only when `cache.version` changes.
- If nothing changes for 15 s (e.g. Massive between polls) a `: keepalive` comment is sent so proxies do not close an idle connection.
- The loop ends when the client disconnects; uvicorn then closes the response.
- `is_disconnected` is injected so the generator is testable without an HTTP server.

### 11.2 Route

`app/market/router.py`:

```python
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from .stream import price_events

router = APIRouter(prefix="/api/stream")


@router.get("/prices")
async def stream_prices(request: Request) -> StreamingResponse:
    return StreamingResponse(
        price_events(request.app.state.price_cache, request.is_disconnected),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

`X-Accel-Buffering: no` stops reverse proxies (nginx, some PaaS front-ends such as App Runner/Render) from buffering the stream.

### 11.3 Verifying by hand

```bash
curl -N http://localhost:8000/api/stream/prices
# retry: 1000
#
# data: {"AAPL": {"ticker": "AAPL", "price": 190.03, ...}, ...}
```

### 11.4 Frontend consumer (reference for the Frontend agent)

```ts
type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export function subscribePrices(
  onPrices: (prices: PriceMap) => void,
  onStatus: (status: ConnectionStatus) => void,
): () => void {
  const source = new EventSource("/api/stream/prices");
  source.onopen = () => onStatus("connected");
  source.onmessage = (event) => onPrices(JSON.parse(event.data) as PriceMap);
  source.onerror = () =>
    onStatus(source.readyState === EventSource.CLOSED ? "disconnected" : "reconnecting");
  return () => source.close();
}
```

`EventSource` reconnects on its own; `readyState === CONNECTING` after an error maps to the yellow "reconnecting" dot, `CLOSED` to red. Sparklines are built by appending `price` per ticker from each frame.

---

## 12. FastAPI Wiring

`app/main.py` (market data parts; other agents add their routers and DB init):

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import get_connection, init_db  # owned by the backend/db agent
from app.market import PriceCache, create_market_data_source
from app.market.router import router as stream_router

DEFAULT_USER = "default"


def load_tracked_tickers(user_id: str = DEFAULT_USER) -> set[str]:
    """Watchlist ∪ held positions: every ticker that must always have a price."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id = ? "
            "UNION SELECT ticker FROM positions WHERE user_id = ?",
            (user_id, user_id),
        ).fetchall()
    return {row[0] for row in rows}


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # create schema + seed default watchlist if needed, before reading tickers
    cache = PriceCache()
    source = create_market_data_source(cache)
    await source.start(load_tracked_tickers())
    app.state.price_cache = cache
    app.state.market_source = source
    yield
    await source.stop()


app = FastAPI(lifespan=lifespan)
app.include_router(stream_router)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "market_data": app.state.market_source.status()}
```

Response from the running simulator build:

```json
{"status": "ok", "market_data": {"source": "simulator", "tickers": 10, "running": true}}
```

Dependency helpers for route handlers:

```python
from fastapi import Request

from app.market import MarketDataSource, PriceCache


def get_price_cache(request: Request) -> PriceCache:
    return request.app.state.price_cache


def get_market_source(request: Request) -> MarketDataSource:
    return request.app.state.market_source
```

Use them as `cache: PriceCache = Depends(get_price_cache)`. The database must be initialized in the lifespan (not lazily on first request) because the market source needs the tracked tickers at startup. The static-file mount for the Next.js export must be added **after** the API routers so `/api/*` is not shadowed.

Run with a single worker (PLAN §7): `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Multiple workers would each run their own source and cache.

---

## 13. Integration with Watchlist, Trades and Portfolio

These services belong to other agents. This section fixes how they must call the market layer so the tracked set stays equal to watchlist ∪ positions and errors map to the PLAN's status codes. Sketches; adapt names to the actual db helpers.

### 13.1 Watchlist add

```python
import re

from app.market import MarketDataSource

TICKER_PATTERN = re.compile(r"^[A-Z]{1,5}$")


async def add_to_watchlist(conn, source: MarketDataSource, raw_ticker: str) -> str:
    ticker = raw_ticker.strip().upper()          # accept "aapl" from users and the LLM
    if not TICKER_PATTERN.fullmatch(ticker):
        raise ValidationError(f"Invalid ticker: {raw_ticker!r}")
    if is_watched(conn, ticker):
        return ticker                            # already watched: no-op success
    if not await source.add_ticker(ticker):      # may raise MarketDataError
        raise ValidationError(f"Unknown ticker: {ticker}")
    insert_watchlist_row(conn, ticker)
    return ticker
```

Order matters: price first, then the row, so a watchlist entry never exists without a price.

### 13.2 Watchlist remove

```python
async def remove_from_watchlist(conn, source: MarketDataSource, ticker: str) -> None:
    ticker = ticker.strip().upper()
    if not delete_watchlist_row(conn, ticker):   # returns False if no row
        raise NotFoundError(f"{ticker} is not on the watchlist")
    if not has_position(conn, ticker):
        await source.remove_ticker(ticker)       # still held → keep pricing it
```

### 13.3 Trade execution

```python
def execute_trade(conn, cache: PriceCache, ticker: str, side: str, quantity: float) -> Trade:
    ticker = ticker.strip().upper()
    price = cache.get_price(ticker)
    if price is None:
        raise ValidationError(f"Unknown ticker: {ticker}")
    ...  # validate side/quantity/cash/shares, write trade + position in one transaction
```

After the transaction commits, an **async** wrapper handles the one tracking change a trade can cause:

```python
async def execute_trade_and_sync(conn, cache, source, ticker, side, quantity):
    trade = execute_trade(conn, cache, ticker, side, quantity)
    if side == "sell" and not has_position(conn, trade.ticker) and not is_watched(conn, trade.ticker):
        await source.remove_ticker(trade.ticker)  # closed a position that was not watched
    record_portfolio_snapshot(conn, cache)
    return trade
```

A buy never needs `add_ticker`: the ticker already had a price to trade at, so it is already tracked.

### 13.4 Portfolio valuation

```python
def position_value(position, cache: PriceCache) -> tuple[float, float]:
    """(market value, unrealized P&L). Falls back to avg cost if no price (Massive outage edge case)."""
    price = cache.get_price(position.ticker) or position.avg_cost
    value = position.quantity * price
    return value, value - position.quantity * position.avg_cost
```

`GET /api/watchlist` returns each row joined with `cache.get(ticker).to_dict()` (or `null` price fields if absent). The chat context builder uses the same cache reads. The chat's `watchlist_changes` and `trades` go through exactly the functions above.

### 13.5 Error → HTTP mapping

| Exception | Status | Body |
|---|---|---|
| `ValidationError` (bad format, unknown ticker, cash/shares) | 400 | `{"error": "<reason>"}` |
| `NotFoundError` (remove unwatched) | 404 | `{"error": "<reason>"}` |
| `MarketDataError` (Massive unreachable during add) | 503 | `{"error": "Market data unavailable, try again"}` |

```python
from fastapi import Request
from fastapi.responses import JSONResponse

from app.market import MarketDataError


@app.exception_handler(MarketDataError)
async def market_data_error_handler(request: Request, exc: MarketDataError) -> JSONResponse:
    return JSONResponse(status_code=503, content={"error": "Market data unavailable, try again"})
```

In the chat flow a `MarketDataError` on one watchlist change is recorded as a failed action (like any validation failure), not a 503 for the whole message.

---

## 14. Failure Modes and Edge Cases

| Case | Behavior |
|---|---|
| No `.env`, no keys | Simulator; app fully works except chat (PLAN §5) |
| Ticker added via chat in lowercase | Uppercased by the watchlist service, then validated |
| Same ticker added twice | Second add is a no-op success; no API call |
| Watched ticker removed while still held | Row deleted; source keeps pricing it; it stays in SSE frames (frontend may show it only in positions) |
| Last share of an unwatched ticker sold | Source stops tracking it; it disappears from the next SSE frame |
| Client connects before first tick | Receives the seeded prices immediately |
| Client disconnects | Generator exits on next 0.5 s check |
| Many clients | Each runs its own lightweight generator reading the same cache; no per-client source work |
| Backend restart (simulator) | Prices reset to seeds; positions keep their avg cost; P&L recomputed from new prices |
| Backend restart (Massive) | First poll seeds; session open = first polled price |
| Massive outage mid-session | Prices freeze at last values (no direction change); trades still execute at last price |
| Free Massive plan, market closed or weekend | End-of-day closes from the last trading day; prices static |
| Delisted ticker held, Massive mode | No price; valued at avg cost; trades rejected as unknown |
| Simulated price after a long session | GBM keeps it positive; drift is small at `TIME_SCALE = 60` |

---

## 15. Tests

`pytest` with `pytest-asyncio` (`asyncio_mode = "auto"`, set in `pyproject.toml`). Run: `cd backend && uv run pytest tests/market -q`. All 26 pass in under a second. No network is used anywhere.

### `tests/market/test_cache.py`

```python
from app.market import PriceCache


def test_first_update_sets_open_and_previous():
    cache = PriceCache()
    update = cache.update("AAPL", 190.123, timestamp=1.0)
    assert update.price == 190.12
    assert update.previous_price == 190.12
    assert update.open_price == 190.12
    assert update.direction == "flat"
    assert cache.version == 1


def test_second_update_shifts_previous_and_keeps_open():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    update = cache.update("AAPL", 191.0)
    assert update.previous_price == 190.0
    assert update.open_price == 190.0
    assert update.change == 1.0
    assert update.change_percent == round(1 / 190 * 100, 4)
    assert update.direction == "up"


def test_to_dict_has_sse_fields():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    payload = cache.update("AAPL", 189.5, timestamp=2.0).to_dict()
    assert set(payload) == {
        "ticker", "price", "previous_price", "open_price",
        "timestamp", "change", "change_percent", "direction",
    }
    assert payload["direction"] == "down"


def test_remove_bumps_version_only_when_present():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    cache.remove("AAPL")
    assert cache.version == 2
    cache.remove("AAPL")
    assert cache.version == 2
    assert cache.get_price("AAPL") is None
```

### `tests/market/test_simulator.py`

Statistical tests disable random events: a few 2-5% jumps dominate the variance and distort volatility and correlation estimates.

```python
import asyncio
import math
import random
import statistics

import pytest

from app.market import PriceCache
from app.market import simulator as sim
from app.market.simulator import DT, GBMSimulator, SimulatorDataSource


@pytest.fixture
def no_events(monkeypatch):
    monkeypatch.setattr(sim, "EVENT_PROBABILITY", 0.0)


def log_returns(simulator: GBMSimulator, tickers: list[str], steps: int) -> dict[str, list[float]]:
    returns = {t: [] for t in tickers}
    previous = {t: simulator.add(t) for t in tickers}
    for _ in range(steps):
        prices = simulator.step()
        for t in tickers:
            returns[t].append(math.log(prices[t] / previous[t]))
            previous[t] = prices[t]
    return returns


def test_seed_prices():
    simulator = GBMSimulator(random.Random(42))
    assert simulator.add("AAPL") == 190.0
    assert 20.0 <= simulator.add("ZZZZ") <= 400.0


def test_prices_stay_positive():
    simulator = GBMSimulator(random.Random(1))
    for t in ("TSLA", "NVDA", "ZZZZ"):
        simulator.add(t)
    for _ in range(10_000):
        assert all(p > 0 for p in simulator.step().values())


def test_per_tick_volatility(no_events):
    returns = log_returns(GBMSimulator(random.Random(7)), ["AAPL"], 20_000)["AAPL"]
    expected = 0.25 * math.sqrt(DT)
    assert statistics.stdev(returns) == pytest.approx(expected, rel=0.1)


def test_correlation(no_events):
    r = log_returns(GBMSimulator(random.Random(3)), ["AAPL", "MSFT", "JPM"], 20_000)
    assert statistics.correlation(r["AAPL"], r["MSFT"]) == pytest.approx(0.6, abs=0.05)
    assert statistics.correlation(r["AAPL"], r["JPM"]) == pytest.approx(0.3, abs=0.05)


def test_events_jump(monkeypatch):
    monkeypatch.setattr(sim, "EVENT_PROBABILITY", 1.0)
    simulator = GBMSimulator(random.Random(5))
    before = simulator.add("JPM")
    after = simulator.step()["JPM"]
    assert 0.015 < abs(after / before - 1) < 0.055


def test_remove_and_readd_restarts_at_seed():
    simulator = GBMSimulator(random.Random(0))
    simulator.add("AAPL")
    simulator.step()
    simulator.remove("AAPL")
    assert "AAPL" not in simulator.step()
    assert simulator.add("AAPL") == 190.0


async def test_data_source_seeds_cache_and_ticks(monkeypatch):
    monkeypatch.setattr(sim, "TICK_SECONDS", 0.01)
    cache = PriceCache()
    source = SimulatorDataSource(cache, GBMSimulator(random.Random(0)))
    await source.start({"AAPL"})
    assert cache.get_price("AAPL") == 190.0
    assert await source.add_ticker("ZZZZ") is True
    assert cache.get_price("ZZZZ") is not None
    version = cache.version
    await asyncio.sleep(0.05)
    assert cache.version > version
    await source.remove_ticker("ZZZZ")
    assert "ZZZZ" not in cache and "ZZZZ" not in source.tickers
    await source.stop()
    assert source.status()["running"] is False
```

### `tests/market/test_massive_source.py`

```python
from types import SimpleNamespace as NS

import pytest
from massive.exceptions import BadResponse

from app.market import MarketDataError, PriceCache
from app.market.massive_source import MassiveDataSource, snapshot_price


def snap(ticker, last=None, minute=None, day=None, prev=None):
    return NS(
        ticker=ticker,
        last_trade=NS(price=last) if last is not None else None,
        min=NS(close=minute) if minute is not None else None,
        day=NS(close=day) if day is not None else None,
        prev_day=NS(close=prev) if prev is not None else None,
    )


class FakeClient:
    """Stands in for massive.RESTClient. No network."""

    def __init__(self, snapshot_error=None, known=None):
        self.snapshot_error = snapshot_error
        self.known = known or {"AAPL": 190.0, "MSFT": 420.0, "PYPL": 70.0}
        self.calls: list[str] = []

    def get_snapshot_all(self, market_type, tickers):
        self.calls.append("snapshot")
        if self.snapshot_error:
            raise self.snapshot_error
        return [snap(t, last=self.known[t] + 1) for t in tickers if t in self.known]

    def get_grouped_daily_aggs(self, day):
        self.calls.append("grouped")
        return [NS(ticker=t, close=p) for t, p in self.known.items()]

    def get_previous_close_agg(self, ticker):
        self.calls.append("prev")
        return [NS(close=self.known[ticker])] if ticker in self.known else []


NOT_AUTHORIZED = BadResponse('{"status":"NOT_AUTHORIZED","message":"not entitled"}')


def test_snapshot_price_fallback_order():
    assert snapshot_price(snap("A", last=1, minute=2, day=3, prev=4)) == 1
    assert snapshot_price(snap("A", minute=2, day=3, prev=4)) == 2
    assert snapshot_price(snap("A", day=0, prev=4)) == 4  # zero after the daily reset
    assert snapshot_price(snap("A")) is None


async def test_live_mode_polls_snapshot():
    cache = PriceCache()
    source = MassiveDataSource(cache, FakeClient(), poll_interval=60)
    await source.start({"AAPL", "MSFT"})
    assert cache.get_price("AAPL") == 191.0
    assert source.end_of_day_mode is False
    await source.stop()


async def test_not_authorized_switches_to_end_of_day_and_caches_closes():
    client = FakeClient(snapshot_error=NOT_AUTHORIZED)
    cache = PriceCache()
    source = MassiveDataSource(cache, client, poll_interval=60)
    await source.start({"AAPL"})
    assert source.end_of_day_mode is True
    assert cache.get_price("AAPL") == 190.0
    await source.poll_once()
    assert client.calls.count("grouped") == 1  # reused, not refetched
    assert client.calls.count("snapshot") == 1  # never retried
    assert await source.add_ticker("PYPL") is True
    assert "prev" not in client.calls  # answered from the grouped closes
    await source.stop()


async def test_other_bad_response_is_raised():
    source = MassiveDataSource(PriceCache(), FakeClient(snapshot_error=BadResponse("boom")), 60)
    source._tickers = {"AAPL"}
    with pytest.raises(BadResponse):
        await source.poll_once()
    assert source.end_of_day_mode is False


async def test_add_ticker_unknown_returns_false():
    cache = PriceCache()
    source = MassiveDataSource(cache, FakeClient(), 60)
    assert await source.add_ticker("ZZZZ") is False
    assert "ZZZZ" not in cache
    assert await source.add_ticker("PYPL") is True
    assert cache.get_price("PYPL") == 70.0


async def test_add_ticker_network_error_raises_market_data_error():
    client = FakeClient()
    client.get_previous_close_agg = lambda ticker: (_ for _ in ()).throw(OSError("down"))
    source = MassiveDataSource(PriceCache(), client, 60)
    with pytest.raises(MarketDataError):
        await source.add_ticker("PYPL")


async def test_startup_survives_failure_and_backfills():
    client = FakeClient(snapshot_error=BadResponse("503"))
    cache = PriceCache()
    source = MassiveDataSource(cache, client, 60)
    await source.start({"AAPL"})  # does not raise
    assert cache.get_price("AAPL") == 190.0  # from previous close
    await source.stop()


async def test_removed_ticker_not_rewritten_by_inflight_poll():
    cache = PriceCache()
    source = MassiveDataSource(cache, FakeClient(), 60)
    source._tickers = {"AAPL", "MSFT"}
    original = source._fetch_prices

    async def fetch_then_remove(tickers):
        prices = await original(tickers)
        await source.remove_ticker("MSFT")
        return prices

    source._fetch_prices = fetch_then_remove
    await source.poll_once()
    assert "MSFT" not in cache and "AAPL" in cache
```

### `tests/market/test_factory.py`

```python
from app.market import PriceCache, create_market_data_source
from app.market.massive_source import MassiveDataSource
from app.market.simulator import SimulatorDataSource


def test_no_key_gives_simulator(monkeypatch):
    monkeypatch.delenv("MASSIVE_API_KEY", raising=False)
    assert isinstance(create_market_data_source(PriceCache()), SimulatorDataSource)


def test_blank_key_gives_simulator(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "   ")
    assert isinstance(create_market_data_source(PriceCache()), SimulatorDataSource)


def test_key_gives_massive_with_clamped_interval(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "test-key")
    monkeypatch.setenv("MASSIVE_POLL_INTERVAL", "0.5")
    source = create_market_data_source(PriceCache())
    assert isinstance(source, MassiveDataSource)
    assert source.poll_interval == 2.0


def test_bad_interval_falls_back(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "test-key")
    monkeypatch.setenv("MASSIVE_POLL_INTERVAL", "fast")
    assert create_market_data_source(PriceCache()).poll_interval == 15.0
```

### `tests/market/test_stream.py`

```python
import json

from app.market import PriceCache
from app.market.stream import price_events


async def test_stream_sends_only_on_version_change():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    disconnect_after = iter([False, False, False, True])

    async def is_disconnected():
        return next(disconnect_after)

    frames = [frame async for frame in price_events(cache, is_disconnected, interval=0)]
    assert frames[0] == "retry: 1000\n\n"
    data_frames = [f for f in frames if f.startswith("data: ")]
    assert len(data_frames) == 1  # cache did not change after the first send
    payload = json.loads(data_frames[0].removeprefix("data: "))
    assert payload["AAPL"]["price"] == 190.0
    assert payload["AAPL"]["direction"] == "flat"
```

### `tests/market/test_conformance.py`

Both sources run through one contract test, which is the practical meaning of "both implementations conform to the abstract interface" (PLAN §12).

```python
import random

import pytest

from app.market import MarketDataSource, PriceCache
from app.market.massive_source import MassiveDataSource
from app.market.simulator import GBMSimulator, SimulatorDataSource
from tests.market.test_massive_source import FakeClient


def make_simulator(cache):
    return SimulatorDataSource(cache, GBMSimulator(random.Random(0)))


def make_massive(cache):
    return MassiveDataSource(cache, FakeClient(), poll_interval=60)


@pytest.mark.parametrize("factory", [make_simulator, make_massive])
async def test_source_contract(factory):
    cache = PriceCache()
    source: MarketDataSource = factory(cache)
    await source.start({"AAPL"})
    assert "AAPL" in cache and source.tickers == {"AAPL"}
    assert await source.add_ticker("PYPL") is True
    assert "PYPL" in cache  # seeded before add_ticker returns
    assert await source.add_ticker("PYPL") is True  # idempotent
    await source.remove_ticker("PYPL")
    assert "PYPL" not in cache and "PYPL" not in source.tickers
    await source.stop()
    await source.stop()  # idempotent
```

Empty `__init__.py` files in `tests/` and `tests/market/` make `from tests.market.test_massive_source import FakeClient` importable.

---

## 16. Implementation Checklist

1. `cd backend && uv init --app` (if not present); add dependencies from §3.
2. Create `app/market/` files in this order, running tests as you go: `models.py`, `cache.py`, `errors.py`, `interface.py`, `seed_prices.py`, `simulator.py`, `massive_source.py`, `factory.py`, `stream.py`, `router.py`, `__init__.py`.
3. Create the tests from §15; `uv run pytest tests/market -q` → 26 passed.
4. Wire the lifespan, router and health endpoint into `app/main.py` (§12) once the db module exists. Until then, a `load_tracked_tickers` returning the 10 default tickers is enough to run the stream.
5. Manual check: `uv run uvicorn app.main:app --port 8000`, then `curl -N localhost:8000/api/stream/prices` shows a frame every ~0.5 s and `curl localhost:8000/api/health` shows `"source": "simulator"`.
6. Optional with a real key: `MASSIVE_API_KEY=... uv run uvicorn app.main:app` and confirm `/api/health` reports `"mode": "live"` or `"end_of_day"` matching the plan.
7. Hand the §13 contract to the watchlist/portfolio/chat implementers and the §4/§11.4 types to the frontend.
