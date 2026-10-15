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
