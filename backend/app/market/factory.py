import logging
import os

from massive import RESTClient

from .cache import PriceCache
from .interface import MarketDataSource
from .massive_source import MassiveDataSource
from .simulator import SimulatorDataSource

logger = logging.getLogger(__name__)

DEFAULT_POLL_INTERVAL = 15.0
MIN_POLL_INTERVAL = 2.0


def create_market_data_source(cache: PriceCache) -> MarketDataSource:
    """Massive when MASSIVE_API_KEY is set and non-empty, otherwise the simulator."""
    api_key = os.getenv("MASSIVE_API_KEY", "").strip()
    if not api_key:
        logger.info("Market data: simulator")
        return SimulatorDataSource(cache)
    poll_interval = _poll_interval()
    logger.info("Market data: Massive, polling every %ss", poll_interval)
    return MassiveDataSource(cache, RESTClient(api_key=api_key), poll_interval)


def _poll_interval() -> float:
    raw = os.getenv("MASSIVE_POLL_INTERVAL", "").strip()
    try:
        value = float(raw) if raw else DEFAULT_POLL_INTERVAL
    except ValueError:
        logger.warning("Invalid MASSIVE_POLL_INTERVAL=%r; using %s", raw, DEFAULT_POLL_INTERVAL)
        value = DEFAULT_POLL_INTERVAL
    return max(value, MIN_POLL_INTERVAL)
