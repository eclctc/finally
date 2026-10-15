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
