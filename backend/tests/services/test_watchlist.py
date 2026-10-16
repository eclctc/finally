import asyncio

import pytest

from app.db import get_connection, repository
from app.errors import NotFoundError, ValidationError
from app.services.portfolio import execute_trade
from app.services.watchlist import add_to_watchlist, get_watchlist, remove_from_watchlist, tracked_tickers


async def test_add_normalizes_and_prices(conn, cache, source):
    assert await add_to_watchlist(conn, source, " pypl ") == "PYPL"
    assert repository.is_watched(conn, "PYPL")
    assert cache.get_price("PYPL") == 70.0


async def test_add_existing_is_noop(conn, cache, source):
    assert await add_to_watchlist(conn, source, "AAPL") == "AAPL"
    assert repository.list_watchlist(conn).count("AAPL") == 1


async def test_concurrent_adds_of_same_ticker_store_one_row(conn, source, monkeypatch):
    real_add_ticker = source.add_ticker

    async def yielding_add_ticker(ticker):
        await asyncio.sleep(0)
        return await real_add_ticker(ticker)

    monkeypatch.setattr(source, "add_ticker", yielding_add_ticker)

    async def add_on_own_connection():
        with get_connection() as own_conn:
            return await add_to_watchlist(own_conn, source, "ZZZZ")

    results = await asyncio.gather(add_on_own_connection(), add_on_own_connection())

    assert results == ["ZZZZ", "ZZZZ"]
    assert repository.list_watchlist(conn).count("ZZZZ") == 1


@pytest.mark.parametrize("raw", ["", "TOOLONG", "AB1", "BRK.B"])
async def test_add_rejects_bad_format(conn, source, raw):
    with pytest.raises(ValidationError, match="Invalid ticker"):
        await add_to_watchlist(conn, source, raw)


async def test_add_rejects_ticker_source_cannot_price(conn, source, monkeypatch):
    async def cannot_price(ticker):
        return False

    monkeypatch.setattr(source, "add_ticker", cannot_price)
    with pytest.raises(ValidationError, match="Unknown ticker"):
        await add_to_watchlist(conn, source, "ZZZZ")
    assert not repository.is_watched(conn, "ZZZZ")


async def test_remove_unwatched_raises_not_found(conn, source):
    with pytest.raises(NotFoundError):
        await remove_from_watchlist(conn, source, "ZZZZ")


async def test_remove_stops_tracking_unless_held(conn, cache, source):
    execute_trade(conn, cache, "MSFT", "buy", 1)
    await remove_from_watchlist(conn, source, "aapl")
    await remove_from_watchlist(conn, source, "MSFT")
    assert "AAPL" not in cache
    assert "MSFT" in cache
    assert tracked_tickers(conn) == set(repository.list_watchlist(conn)) | {"MSFT"}


def test_get_watchlist_has_null_prices_when_unpriced(conn, cache):
    entries = {entry["ticker"]: entry for entry in get_watchlist(conn, cache)}
    assert entries["AAPL"]["price"] == 100.0
    assert entries["GOOGL"]["price"] is None and entries["GOOGL"]["direction"] is None
