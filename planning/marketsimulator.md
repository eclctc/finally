# Market Simulator — Approach and Code Structure

The default price source when `MASSIVE_API_KEY` is not set. It produces believable, lively prices with no network and no dependencies beyond the standard library. It implements `MarketDataSource` from `marketinterface.md` and writes to the shared `PriceCache`.

## 1. Goals

- Realistic-looking prices: random walks that never go negative, with per-stock volatility.
- Visible motion: something flashes every tick, without prices drifting absurdly within a session.
- Correlation: tech stocks tend to move together; the whole market sometimes moves together.
- Drama: occasional sudden 2-5% jumps on a single ticker.
- Any symbol works: unknown tickers get a random seed price.
- Testable: the math is a pure class with an injectable random generator; the asyncio wrapper is thin.

## 2. The Model

### 2.1 Geometric Brownian Motion

Each tick, each price moves by the exact GBM step:

```
S(t+dt) = S(t) * exp( (mu - sigma²/2) * dt  +  sigma * sqrt(dt) * Z )
```

- `mu` annual drift, `sigma` annual volatility, `Z` a standard normal shock.
- `exp(...)` keeps prices strictly positive.
- `dt` is measured in trading years: one year = 252 days x 6.5 h = 5,896,800 trading seconds.

### 2.2 Time Acceleration

At true speed a 500 ms tick moves a stock by about 0.007%, which rounds to no visible change. The simulator runs time faster:

```
TIME_SCALE = 60            # 1 real second = 1 simulated trading minute
dt = TICK_SECONDS * TIME_SCALE / TRADING_SECONDS_PER_YEAR   # ≈ 5.1e-6
```

With `sigma = 0.30` that gives a per-tick standard deviation of ~0.07% (about $0.13 on a $190 stock), ~2.4% over 10 minutes. Lively but plausible.

### 2.3 Correlated Shocks (factor model)

Rather than a full correlation matrix and Cholesky decomposition, shocks are built from shared factors. This handles tickers being added and removed with no matrix rebuild.

```
Z_i = a * M  +  b * S_sector(i)  +  c * E_i
```

- `M` market factor (one draw per tick, shared by all tickers)
- `S_sector` one draw per sector per tick
- `E_i` idiosyncratic draw per ticker
- `a² + b² + c² = 1` so `Z_i` stays standard normal

With `a² = 0.3`, `b² = 0.3`, `c² = 0.4`:

| Pair | Correlation |
|---|---|
| Same sector (e.g. AAPL / MSFT) | a² + b² = 0.6 |
| Different sectors (e.g. AAPL / JPM) | a² = 0.3 |

### 2.4 Random Events

Each ticker, each tick, has probability `EVENT_PROBABILITY = 0.0005` of a jump: the price is multiplied by `1 ± U(0.02, 0.05)`. With 10 tickers at 2 ticks/s that is one event roughly every 100 seconds across the watchlist.

## 3. Seed Data

`seed_prices.py` holds the starting point for the default watchlist. Volatility reflects each stock's character (TSLA and NVDA swing more than V and JPM).

| Ticker | Seed price | Sigma | Mu | Sector |
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

Unknown tickers: seed price uniform in $20-$400, `sigma = 0.35`, `mu = 0.05`, sector `other`. The random seed price comes from the simulator's generator, so tests can make it deterministic.

```python
# seed_prices.py
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TickerProfile:
    """Starting price and GBM parameters for one ticker."""

    seed_price: float
    sigma: float
    mu: float
    sector: str


KNOWN_TICKERS: dict[str, TickerProfile] = {
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
}

UNKNOWN_PRICE_RANGE = (20.0, 400.0)
UNKNOWN_SIGMA = 0.35
UNKNOWN_MU = 0.05
UNKNOWN_SECTOR = "other"
```

## 4. Code Structure

Two classes, split so the math is testable without asyncio:

| Class | Responsibility |
|---|---|
| `GBMSimulator` | Pure state + math. Holds current prices and profiles; `step()` advances every ticker one tick and returns the new prices. No I/O, no cache, no asyncio. |
| `SimulatorDataSource` | Implements `MarketDataSource`. Owns a `GBMSimulator`, runs the 500 ms loop as an asyncio task, writes results to `PriceCache`. |

```python
# simulator.py
import asyncio
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

TICK_SECONDS = 0.5
TIME_SCALE = 60
TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600
DT = TICK_SECONDS * TIME_SCALE / TRADING_SECONDS_PER_YEAR

MARKET_LOADING = math.sqrt(0.3)
SECTOR_LOADING = math.sqrt(0.3)
IDIOSYNCRATIC_LOADING = math.sqrt(0.4)

EVENT_PROBABILITY = 0.0005
EVENT_MOVE_RANGE = (0.02, 0.05)


class GBMSimulator:
    """Correlated geometric Brownian motion over a changing set of tickers."""

    def __init__(self, rng: random.Random | None = None) -> None:
        self.rng = rng or random.Random()
        self.profiles: dict[str, TickerProfile] = {}
        self.prices: dict[str, float] = {}

    def add(self, ticker: str) -> float:
        """Start simulating a ticker and return its seed price."""
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

    def _sectors(self) -> set[str]:
        return {profile.sector for profile in self.profiles.values()}


class SimulatorDataSource(MarketDataSource):
    """Runs GBMSimulator every TICK_SECONDS and writes prices into the cache."""

    def __init__(self, cache: PriceCache, simulator: GBMSimulator | None = None) -> None:
        super().__init__(cache)
        self.simulator = simulator or GBMSimulator()
        self._task: asyncio.Task | None = None

    @property
    def tickers(self) -> set[str]:
        return set(self.simulator.prices)

    async def start(self, tickers: set[str]) -> None:
        for ticker in tickers:
            await self.add_ticker(ticker)
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()

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
            for ticker, price in self.simulator.step().items():
                self.cache.update(ticker, price)
```

### Design notes

- **Full precision internally, rounded in the cache.** `GBMSimulator` keeps unrounded floats so tiny moves accumulate correctly; `PriceCache.update` rounds to cents for display. A tick that rounds to the same cent is reported as `direction: "flat"`.
- **The session open** is the seed price, because `PriceCache` records the first price it sees as `open_price`. On backend restart prices reset to seeds; that is expected for a simulator.
- **No locks.** `step()` and `add_ticker` both run on the event loop thread and never interleave mid-update.
- **Sectors are computed per tick** from the tickers present, so adding or removing a ticker needs no bookkeeping.
- **Standard library only.** Ten tickers at 2 Hz does not need numpy.

## 5. Tuning Knobs

All are module constants in `simulator.py`; change them, not the code.

| Constant | Default | Effect |
|---|---|---|
| `TICK_SECONDS` | 0.5 | Update cadence (PLAN: ~500 ms) |
| `TIME_SCALE` | 60 | Larger = more motion per tick |
| `MARKET_LOADING²` / `SECTOR_LOADING²` | 0.3 / 0.3 | Cross-sector / extra intra-sector correlation |
| `EVENT_PROBABILITY` | 0.0005 | Per ticker per tick |
| `EVENT_MOVE_RANGE` | 2%-5% | Jump size |

## 6. Tests (`backend/tests/market/test_simulator.py`)

Use `GBMSimulator(rng=random.Random(42))` for determinism.

| Test | Assertion |
|---|---|
| Seed prices | `add("AAPL")` returns 190.0; an unknown ticker gets a price in $20-$400 |
| Positivity | 10,000 steps never produce a price <= 0 |
| Per-tick volatility | std of log returns over many steps ≈ `sigma * sqrt(DT)` (within 10%), with events disabled via monkeypatch |
| Drift-free mean | mean log return ≈ `(mu - sigma²/2) * DT` within tolerance |
| Correlation | with events disabled, sample correlation of AAPL/MSFT log returns ≈ 0.6, AAPL/JPM ≈ 0.3 (within 0.05 over 20,000 steps). Events must be off: a few 2-5% jumps dominate the variance and pull correlations down |
| Events | with `EVENT_PROBABILITY = 1`, every step moves each price by 2-5% beyond the GBM move |
| Add/remove | removed tickers disappear from `step()` output; re-adding a known ticker restarts at its seed |
| Data source | after `start({"AAPL"})` the cache holds AAPL immediately; `add_ticker("ZZZZ")` returns True and seeds the cache; `remove_ticker` drops it from the cache |
