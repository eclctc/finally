import pytest

from app.db import repository
from app.errors import ValidationError
from app.services.portfolio import execute_trade, execute_trade_and_sync, get_portfolio


def test_buy_creates_position_and_spends_cash(conn, cache):
    trade = execute_trade(conn, cache, "aapl", "BUY", 2.5)
    assert (trade.ticker, trade.side, trade.price) == ("AAPL", "buy", 100.0)
    assert repository.get_cash(conn) == 9750.0
    position = repository.get_position(conn, "AAPL")
    assert (position.quantity, position.avg_cost) == (2.5, 100.0)


def test_buy_updates_weighted_average_cost(conn, cache):
    execute_trade(conn, cache, "AAPL", "buy", 10)
    cache.update("AAPL", 130.0)
    execute_trade(conn, cache, "AAPL", "buy", 5)
    assert repository.get_position(conn, "AAPL").avg_cost == pytest.approx(110.0)


def test_sell_keeps_avg_cost_and_adds_cash(conn, cache):
    execute_trade(conn, cache, "AAPL", "buy", 10)
    cache.update("AAPL", 80.0)  # selling at a loss
    execute_trade(conn, cache, "AAPL", "sell", 4)
    position = repository.get_position(conn, "AAPL")
    assert (position.quantity, position.avg_cost) == (6, 100.0)
    assert repository.get_cash(conn) == 9000.0 + 320.0


def test_selling_everything_deletes_position(conn, cache):
    execute_trade(conn, cache, "AAPL", "buy", 0.1)
    execute_trade(conn, cache, "AAPL", "buy", 0.2)
    execute_trade(conn, cache, "AAPL", "sell", 0.3)
    assert repository.get_position(conn, "AAPL") is None
    assert repository.get_cash(conn) == 10000.0


@pytest.mark.parametrize(
    ("ticker", "side", "quantity", "reason"),
    [
        ("AAPL", "hold", 1, "Side"),
        ("AAPL", "buy", 0, "Quantity"),
        ("AAPL", "buy", -1, "Quantity"),
        ("ZZZZ", "buy", 1, "Unknown ticker"),
        ("AAPL", "buy", 101, "Insufficient cash"),
        ("AAPL", "sell", 1, "Insufficient shares"),
    ],
)
def test_invalid_trades_rejected_without_writes(conn, cache, ticker, side, quantity, reason):
    with pytest.raises(ValidationError, match=reason):
        execute_trade(conn, cache, ticker, side, quantity)
    assert repository.get_cash(conn) == 10000.0
    assert repository.list_positions(conn) == []


def test_get_portfolio_values_positions(conn, cache):
    execute_trade(conn, cache, "AAPL", "buy", 10)
    cache.update("AAPL", 110.0)
    portfolio = get_portfolio(conn, cache)
    assert portfolio["cash_balance"] == 9000.0
    assert portfolio["positions_value"] == 1100.0
    assert portfolio["total_value"] == 10100.0
    assert portfolio["unrealized_pnl"] == 100.0
    assert portfolio["positions"][0] == {
        "ticker": "AAPL", "quantity": 10, "avg_cost": 100.0, "current_price": 110.0,
        "market_value": 1100.0, "unrealized_pnl": 100.0, "pnl_percent": 10.0,
    }


async def test_trade_and_sync_records_snapshot(conn, cache, source):
    await execute_trade_and_sync(conn, cache, source, "AAPL", "buy", 1)
    assert [s.total_value for s in repository.list_snapshots(conn)] == [10000.0]


async def test_closing_unwatched_position_stops_tracking(conn, cache, source):
    repository.delete_watchlist_row(conn, "AAPL")
    await execute_trade_and_sync(conn, cache, source, "AAPL", "buy", 1)
    await execute_trade_and_sync(conn, cache, source, "AAPL", "sell", 1)
    assert "AAPL" not in cache and "AAPL" not in source.tickers


async def test_closing_watched_position_keeps_tracking(conn, cache, source):
    await execute_trade_and_sync(conn, cache, source, "AAPL", "buy", 1)
    await execute_trade_and_sync(conn, cache, source, "AAPL", "sell", 1)
    assert "AAPL" in cache
