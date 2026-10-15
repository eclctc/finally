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
