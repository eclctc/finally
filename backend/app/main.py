import asyncio
import contextlib
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.chat.router import router as chat_router
from app.db import get_connection, init_db
from app.market import PriceCache, create_market_data_source
from app.market.router import router as stream_router
from app.routes.error_handlers import register_error_handlers
from app.routes.health import router as health_router
from app.routes.portfolio import router as portfolio_router
from app.routes.watchlist import router as watchlist_router
from app.services.portfolio import record_portfolio_snapshot
from app.services.watchlist import tracked_tickers

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR.parent / ".env")

SNAPSHOT_INTERVAL_SECONDS = 30
STATIC_DIR = Path(os.getenv("STATIC_DIR", BACKEND_DIR / "static"))

logger = logging.getLogger(__name__)


async def record_snapshots_forever(cache: PriceCache) -> None:
    """Record a portfolio value snapshot every SNAPSHOT_INTERVAL_SECONDS."""
    while True:
        await asyncio.sleep(SNAPSHOT_INTERVAL_SECONDS)
        try:
            with get_connection() as conn:
                record_portfolio_snapshot(conn, cache)
        except Exception:
            logger.exception("Portfolio snapshot failed; retrying next interval")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    cache = PriceCache()
    source = create_market_data_source(cache)
    with get_connection() as conn:
        tickers = tracked_tickers(conn)
    await source.start(tickers)
    app.state.price_cache = cache
    app.state.market_source = source
    snapshot_task = asyncio.create_task(record_snapshots_forever(cache), name="portfolio-snapshots")
    yield
    snapshot_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await snapshot_task
    await source.stop()


app = FastAPI(title="FinAlly", lifespan=lifespan)
register_error_handlers(app)
app.include_router(health_router)
app.include_router(stream_router)
app.include_router(portfolio_router)
app.include_router(watchlist_router)
app.include_router(chat_router)

if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
