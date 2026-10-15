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
