from dataclasses import asdict

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.db import get_connection, repository
from app.db.models import Trade
from app.deps import get_market_source, get_price_cache
from app.market import MarketDataSource, PriceCache
from app.services.portfolio import execute_trade_and_sync, get_portfolio

router = APIRouter(prefix="/api/portfolio")


class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str


def trade_summary(trade: Trade) -> dict:
    """Trade fields exposed by the API (no user_id)."""
    return {key: value for key, value in asdict(trade).items() if key != "user_id"}


@router.get("")
def read_portfolio(cache: PriceCache = Depends(get_price_cache)) -> dict:
    with get_connection() as conn:
        return get_portfolio(conn, cache)


@router.post("/trade")
async def trade(
    request: TradeRequest,
    cache: PriceCache = Depends(get_price_cache),
    source: MarketDataSource = Depends(get_market_source),
) -> dict:
    with get_connection() as conn:
        executed = await execute_trade_and_sync(
            conn, cache, source, request.ticker, request.side, request.quantity
        )
        return {"trade": trade_summary(executed), "portfolio": get_portfolio(conn, cache)}


@router.get("/history")
def read_history() -> dict:
    with get_connection() as conn:
        snapshots = repository.list_snapshots(conn)
    return {"snapshots": [{"total_value": s.total_value, "recorded_at": s.recorded_at} for s in snapshots]}
