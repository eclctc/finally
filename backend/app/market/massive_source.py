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
