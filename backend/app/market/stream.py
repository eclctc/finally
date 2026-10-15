import asyncio
import json
from collections.abc import AsyncIterator, Awaitable, Callable

from .cache import PriceCache

STREAM_INTERVAL_SECONDS = 0.5
KEEPALIVE_SECONDS = 15.0
RETRY_MILLISECONDS = 1000


async def price_events(
    cache: PriceCache,
    is_disconnected: Callable[[], Awaitable[bool]],
    interval: float = STREAM_INTERVAL_SECONDS,
) -> AsyncIterator[str]:
    """SSE frames: the full price map whenever the cache version changes."""
    yield f"retry: {RETRY_MILLISECONDS}\n\n"
    last_version = -1
    idle = 0.0
    while not await is_disconnected():
        if cache.version != last_version:
            last_version = cache.version
            payload = {ticker: update.to_dict() for ticker, update in cache.all().items()}
            yield f"data: {json.dumps(payload)}\n\n"
            idle = 0.0
        elif idle >= KEEPALIVE_SECONDS:
            yield ": keepalive\n\n"  # comment line; EventSource ignores it
            idle = 0.0
        await asyncio.sleep(interval)
        idle += interval
