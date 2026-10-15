from fastapi import APIRouter, Depends

from app.deps import get_market_source
from app.market import MarketDataSource

router = APIRouter(prefix="/api")


@router.get("/health")
def health(source: MarketDataSource = Depends(get_market_source)) -> dict:
    return {"status": "ok", "market_data": source.status()}
