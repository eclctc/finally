from app.market import PriceCache, create_market_data_source
from app.market.massive_source import MassiveDataSource
from app.market.simulator import SimulatorDataSource


def test_no_key_gives_simulator(monkeypatch):
    monkeypatch.delenv("MASSIVE_API_KEY", raising=False)
    assert isinstance(create_market_data_source(PriceCache()), SimulatorDataSource)


def test_blank_key_gives_simulator(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "   ")
    assert isinstance(create_market_data_source(PriceCache()), SimulatorDataSource)


def test_key_gives_massive_with_clamped_interval(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "test-key")
    monkeypatch.setenv("MASSIVE_POLL_INTERVAL", "0.5")
    source = create_market_data_source(PriceCache())
    assert isinstance(source, MassiveDataSource)
    assert source.poll_interval == 2.0


def test_bad_interval_falls_back(monkeypatch):
    monkeypatch.setenv("MASSIVE_API_KEY", "test-key")
    monkeypatch.setenv("MASSIVE_POLL_INTERVAL", "fast")
    assert create_market_data_source(PriceCache()).poll_interval == 15.0
