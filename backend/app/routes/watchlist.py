from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.db import get_connection
from app.deps import get_market_source, get_price_cache
from app.market import MarketDataSource, PriceCache
from app.services.watchlist import add_to_watchlist, get_watchlist, normalize_ticker, remove_from_watchlist

router = APIRouter(prefix="/api/watchlist")


class WatchlistAddRequest(BaseModel):
    ticker: str


@router.get("")
def read_watchlist(cache: PriceCache = Depends(get_price_cache)) -> dict:
    with get_connection() as conn:
        return {"tickers": get_watchlist(conn, cache)}


@router.post("")
async def add_ticker(request: WatchlistAddRequest, source: MarketDataSource = Depends(get_market_source)) -> dict:
    with get_connection() as conn:
        return {"ticker": await add_to_watchlist(conn, source, request.ticker)}


@router.delete("/{ticker}")
async def remove_ticker(ticker: str, source: MarketDataSource = Depends(get_market_source)) -> dict:
    with get_connection() as conn:
        await remove_from_watchlist(conn, source, ticker)
    return {"ticker": normalize_ticker(ticker)}
