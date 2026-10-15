import random

import pytest

from app.db import get_connection, init_db
from app.market import PriceCache
from app.market.simulator import GBMSimulator, SimulatorDataSource


@pytest.fixture
def conn(tmp_path, monkeypatch):
    monkeypatch.setenv("FINALLY_DB_PATH", str(tmp_path / "test.db"))
    init_db()
    with get_connection() as connection:
        yield connection


@pytest.fixture
def cache():
    cache = PriceCache()
    cache.update("AAPL", 100.0)
    cache.update("MSFT", 400.0)
    return cache


@pytest.fixture
def source(cache):
    """A simulator source that is never started, so prices stay fixed."""
    source = SimulatorDataSource(cache, GBMSimulator(random.Random(0)))
    for ticker in cache.all():
        source.simulator.add(ticker)
    return source
