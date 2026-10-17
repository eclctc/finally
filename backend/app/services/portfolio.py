from app.db import repository, savepoint
from app.db.models import Position, Trade
from app.errors import ValidationError
from app.market import MarketDataSource, PriceCache

from .watchlist import normalize_ticker

SIDES = ("buy", "sell")
QUANTITY_TOLERANCE = 1e-9  # float residue below this counts as zero shares


def execute_trade(conn, cache: PriceCache, ticker: str, side: str, quantity: float) -> Trade:
    """Validate and fill a market order at the cached price, as one atomic unit.

    Buys update the weighted average cost; sells leave it unchanged and delete
    the position when it reaches zero. Raises ValidationError.
    """
    ticker = normalize_ticker(ticker)
    side = side.strip().lower()
    if side not in SIDES:
        raise ValidationError(f"Side must be 'buy' or 'sell', got {side!r}")
    if not quantity > 0:
        raise ValidationError("Quantity must be greater than zero")
    price = cache.get_price(ticker)
    if price is None:
        raise ValidationError(f"Unknown ticker: {ticker}")

    with savepoint(conn):
        if side == "buy":
            _apply_buy(conn, ticker, quantity, price)
        else:
            _apply_sell(conn, ticker, quantity, price)
        return repository.insert_trade(conn, ticker, side, quantity, price)


def _apply_buy(conn, ticker: str, quantity: float, price: float) -> None:
    cash = repository.get_cash(conn)
    cost = round(quantity * price, 2)
    if cost > cash:
        raise ValidationError(f"Insufficient cash: need ${cost:,.2f}, have ${cash:,.2f}")
    position = repository.get_position(conn, ticker)
    held = position.quantity if position else 0.0
    held_cost = held * position.avg_cost if position else 0.0
    new_quantity = held + quantity
    repository.upsert_position(conn, ticker, new_quantity, (held_cost + quantity * price) / new_quantity)
    repository.set_cash(conn, round(cash - cost, 2))


def _apply_sell(conn, ticker: str, quantity: float, price: float) -> None:
    position = repository.get_position(conn, ticker)
    held = position.quantity if position else 0.0
    if quantity > held + QUANTITY_TOLERANCE:
        raise ValidationError(f"Insufficient shares: selling {quantity:g} {ticker}, hold {held:g}")
    remaining = held - quantity
    if remaining <= QUANTITY_TOLERANCE:
        repository.delete_position(conn, ticker)
    else:
        repository.upsert_position(conn, ticker, remaining, position.avg_cost)
    repository.set_cash(conn, round(repository.get_cash(conn) + quantity * price, 2))


async def execute_trade_and_sync(
    conn, cache: PriceCache, source: MarketDataSource, ticker: str, side: str, quantity: float
) -> Trade:
    """Record a trade and its snapshot as one unit, then stop pricing a closed, unwatched position."""
    with savepoint(conn):
        trade = execute_trade(conn, cache, ticker, side, quantity)
        record_portfolio_snapshot(conn, cache)
    closed = not repository.has_position(conn, trade.ticker)
    if trade.side == "sell" and closed and not repository.is_watched(conn, trade.ticker):
        await source.remove_ticker(trade.ticker)
    return trade


def position_summary(position: Position, cache: PriceCache) -> dict:
    """One positions-table row. Falls back to avg cost when no price is cached."""
    price = cache.get_price(position.ticker) or position.avg_cost
    market_value = position.quantity * price
    cost_basis = position.quantity * position.avg_cost
    unrealized_pnl = market_value - cost_basis
    return {
        "ticker": position.ticker,
        "quantity": position.quantity,
        "avg_cost": round(position.avg_cost, 4),
        "current_price": price,
        "market_value": round(market_value, 2),
        "unrealized_pnl": round(unrealized_pnl, 2),
        "pnl_percent": round(unrealized_pnl / cost_basis * 100, 2) if cost_basis else 0.0,
    }


def get_portfolio(conn, cache: PriceCache) -> dict:
    """Cash, positions valued at cached prices, and totals."""
    cash = repository.get_cash(conn)
    positions = [position_summary(p, cache) for p in repository.list_positions(conn)]
    positions_value = sum(p["market_value"] for p in positions)
    return {
        "cash_balance": round(cash, 2),
        "total_value": round(cash + positions_value, 2),
        "positions_value": round(positions_value, 2),
        "unrealized_pnl": round(sum(p["unrealized_pnl"] for p in positions), 2),
        "positions": positions,
    }


def record_portfolio_snapshot(conn, cache: PriceCache) -> None:
    repository.insert_snapshot(conn, get_portfolio(conn, cache)["total_value"])
