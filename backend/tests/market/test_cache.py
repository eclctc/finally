from app.market import PriceCache


def test_first_update_sets_open_and_previous():
    cache = PriceCache()
    update = cache.update("AAPL", 190.123, timestamp=1.0)
    assert update.price == 190.12
    assert update.previous_price == 190.12
    assert update.open_price == 190.12
    assert update.direction == "flat"
    assert cache.version == 1


def test_second_update_shifts_previous_and_keeps_open():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    update = cache.update("AAPL", 191.0)
    assert update.previous_price == 190.0
    assert update.open_price == 190.0
    assert update.change == 1.0
    assert update.change_percent == round(1 / 190 * 100, 4)
    assert update.direction == "up"


def test_to_dict_has_sse_fields():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    payload = cache.update("AAPL", 189.5, timestamp=2.0).to_dict()
    assert set(payload) == {
        "ticker", "price", "previous_price", "open_price",
        "timestamp", "change", "change_percent", "direction",
    }
    assert payload["direction"] == "down"


def test_remove_bumps_version_only_when_present():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    cache.remove("AAPL")
    assert cache.version == 2
    cache.remove("AAPL")
    assert cache.version == 2
    assert cache.get_price("AAPL") is None
