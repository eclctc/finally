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
