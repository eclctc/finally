"""POST /api/chat."""

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db import get_connection
from app.deps import get_market_source, get_price_cache

from .llm import LLMError
from .service import handle_chat_message

router = APIRouter()


class ChatRequest(BaseModel):
    message: str


@router.post("/api/chat")
async def chat(body: ChatRequest, request: Request):
    """Send a message to the assistant; returns its reply and the actions it executed."""
    with get_connection() as conn:
        try:
            return await handle_chat_message(
                conn, get_price_cache(request), get_market_source(request), body.message
            )
        except LLMError as exc:
            return JSONResponse(status_code=502, content={"error": str(exc)})
