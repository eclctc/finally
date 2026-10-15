from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from .stream import price_events

router = APIRouter(prefix="/api/stream")


@router.get("/prices")
async def stream_prices(request: Request) -> StreamingResponse:
    return StreamingResponse(
        price_events(request.app.state.price_cache, request.is_disconnected),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
