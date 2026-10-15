import json

from app.market import PriceCache
from app.market.stream import price_events


async def test_stream_sends_only_on_version_change():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    disconnect_after = iter([False, False, False, True])

    async def is_disconnected():
        return next(disconnect_after)

    frames = [frame async for frame in price_events(cache, is_disconnected, interval=0)]
    assert frames[0] == "retry: 1000\n\n"
    data_frames = [f for f in frames if f.startswith("data: ")]
    assert len(data_frames) == 1  # cache did not change after the first send
    payload = json.loads(data_frames[0].removeprefix("data: "))
    assert payload["AAPL"]["price"] == 190.0
    assert payload["AAPL"]["direction"] == "flat"
