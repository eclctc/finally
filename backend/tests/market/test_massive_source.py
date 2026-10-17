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


async def test_readd_keeps_session_open():
    client = FakeClient()
    cache = PriceCache()
    source = MassiveDataSource(cache, client, poll_interval=60)
    await source.start({"AAPL"})
    open_price = cache.get("AAPL").open_price
    client.known["AAPL"] = 200.0
    await source.poll_once()
    await source.remove_ticker("AAPL")
    await source.add_ticker("AAPL")
    assert cache.get("AAPL").open_price == open_price
    assert cache.get_price("AAPL") == 200.0
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
