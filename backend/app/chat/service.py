"""Chat turn orchestration: build prompt, get reply, execute actions, store messages."""

from app.db import repository
from app.errors import NotFoundError, ValidationError
from app.market import MarketDataError
from app.services.portfolio import execute_trade_and_sync, get_portfolio
from app.services.watchlist import add_to_watchlist, remove_from_watchlist

from .llm import generate_reply
from .prompt import build_messages
from .schemas import TradeInstruction, WatchlistChange

HISTORY_LIMIT = 20
ACTION_ERRORS = (ValidationError, NotFoundError, MarketDataError)


def watchlist_with_prices(conn, cache) -> list[dict]:
    """Watched tickers with their latest cached price (None if unpriced)."""
    return [{"ticker": ticker, "price": cache.get_price(ticker)} for ticker in repository.list_watchlist(conn)]


async def apply_watchlist_change(conn, source, change: WatchlistChange) -> dict:
    """Apply one watchlist change and describe the outcome."""
    action = {"type": "watchlist", "ticker": change.ticker.upper(), "action": change.action}
    try:
        if change.action == "add":
            await add_to_watchlist(conn, source, change.ticker)
        else:
            await remove_from_watchlist(conn, source, change.ticker.upper())
    except ACTION_ERRORS as exc:
        return {**action, "status": "failed", "error": str(exc)}
    return {**action, "status": "ok"}


async def apply_trade(conn, cache, source, trade: TradeInstruction) -> dict:
    """Execute one trade and describe the outcome."""
    action = {"type": "trade", "ticker": trade.ticker.upper(), "side": trade.side, "quantity": trade.quantity}
    try:
        executed = await execute_trade_and_sync(conn, cache, source, trade.ticker, trade.side, trade.quantity)
    except ACTION_ERRORS as exc:
        return {**action, "status": "failed", "error": str(exc)}
    return {**action, "status": "ok", "price": executed.price}


async def handle_chat_message(conn, cache, source, message: str) -> dict:
    """Run one chat turn. Raises LLMError before anything is executed or stored."""
    messages = build_messages(
        get_portfolio(conn, cache),
        watchlist_with_prices(conn, cache),
        repository.recent_chat_messages(conn, limit=HISTORY_LIMIT),
        message,
    )
    reply = await generate_reply(messages, message)

    actions = [await apply_watchlist_change(conn, source, change) for change in reply.watchlist_changes]
    actions += [await apply_trade(conn, cache, source, trade) for trade in reply.trades]

    repository.insert_chat_message(conn, "user", message, None)
    repository.insert_chat_message(conn, "assistant", reply.message, actions)
    return {"message": reply.message, "actions": actions}
