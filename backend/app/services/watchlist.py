import re

from app.db import repository, savepoint
from app.errors import NotFoundError, ValidationError
from app.market import MarketDataSource, PriceCache

TICKER_PATTERN = re.compile(r"^[A-Z]{1,5}$")
PRICE_FIELDS = ("price", "previous_price", "open_price", "change", "change_percent", "direction", "timestamp")


def normalize_ticker(raw_ticker: str) -> str:
    return raw_ticker.strip().upper()


async def add_to_watchlist(conn, source: MarketDataSource, raw_ticker: str) -> str:
    """Validate, price and watch a ticker. Already watched is a no-op success.

    The source is asked for a price before the row is written, so a watched
    ticker always has a price. Raises ValidationError or MarketDataError.
    """
    ticker = normalize_ticker(raw_ticker)
    if not TICKER_PATTERN.fullmatch(ticker):
        raise ValidationError(f"Invalid ticker: {raw_ticker!r}")
    if repository.is_watched(conn, ticker):
        return ticker
    if not await source.add_ticker(ticker):
        raise ValidationError(f"Unknown ticker: {ticker}")
    with savepoint(conn):
        repository.insert_watchlist_row(conn, ticker)
    return ticker


async def remove_from_watchlist(conn, source: MarketDataSource, ticker: str) -> None:
    """Unwatch a ticker; keep pricing it while it is still held. Raises NotFoundError."""
    ticker = normalize_ticker(ticker)
    with savepoint(conn):
        removed = repository.delete_watchlist_row(conn, ticker)
    if not removed:
        raise NotFoundError(f"{ticker} is not on the watchlist")
    if not repository.has_position(conn, ticker):
        await source.remove_ticker(ticker)


def get_watchlist(conn, cache: PriceCache) -> list[dict]:
    """Watched tickers with their latest prices (null price fields if unpriced)."""
    return [watchlist_entry(ticker, cache) for ticker in repository.list_watchlist(conn)]


def watchlist_entry(ticker: str, cache: PriceCache) -> dict:
    update = cache.get(ticker)
    if update is None:
        return {"ticker": ticker} | dict.fromkeys(PRICE_FIELDS)
    return update.to_dict()


def tracked_tickers(conn) -> set[str]:
    """Watchlist plus held positions: every ticker that must always have a price."""
    held = {position.ticker for position in repository.list_positions(conn)}
    return set(repository.list_watchlist(conn)) | held
