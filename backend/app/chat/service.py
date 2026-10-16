"""Chat turn orchestration: build prompt, get reply, execute actions, store messages."""

import logging
from collections.abc import Awaitable, Callable

from app.db import repository, savepoint
from app.errors import NotFoundError, ValidationError
from app.market import MarketDataError
from app.services.portfolio import execute_trade_and_sync, get_portfolio
from app.services.watchlist import add_to_watchlist, remove_from_watchlist

from .llm import generate_reply
from .prompt import MAX_ACTIONS_PER_KIND, build_messages
from .schemas import TradeInstruction, WatchlistChange

logger = logging.getLogger(__name__)

HISTORY_LIMIT = 20
UNEXPECTED_ERROR = "Action failed unexpectedly and was not applied"
ACTION_ERRORS = (ValidationError, NotFoundError, MarketDataError)


def watchlist_with_prices(conn, cache) -> list[dict]:
    """Watched tickers with their latest cached price (None if unpriced)."""
    return [{"ticker": ticker, "price": cache.get_price(ticker)} for ticker in repository.list_watchlist(conn)]


def describe_watchlist_change(change: WatchlistChange) -> dict:
    """The action record for a watchlist change, before its outcome is known."""
    return {"type": "watchlist", "ticker": change.ticker.upper(), "action": change.action}


def describe_trade(trade: TradeInstruction) -> dict:
    """The action record for a trade, before its outcome is known."""
    return {"type": "trade", "ticker": trade.ticker.upper(), "side": trade.side, "quantity": trade.quantity}


async def run_action(action: dict, perform: Callable[[], Awaitable[dict]]) -> dict:
    """Run one action; any failure becomes a failed action instead of aborting the turn.

    The broad catch is deliberate (HARD-05): an unexpected error in one action
    must not abort the turn or lose the record of the other actions. Its detail
    is logged only, because failed actions are shown to the user and replayed
    to the LLM as history.
    """
    try:
        outcome = await perform()
    except ACTION_ERRORS as exc:
        return {**action, "status": "failed", "error": str(exc)}
    except Exception:
        logger.exception("Chat action failed unexpectedly: %s", action)
        return {**action, "status": "failed", "error": UNEXPECTED_ERROR}
    return {**action, "status": "ok", **outcome}


async def apply_watchlist_change(conn, source, change: WatchlistChange) -> dict:
    """Apply one watchlist change and describe the outcome."""

    async def perform() -> dict:
        if change.action == "add":
            await add_to_watchlist(conn, source, change.ticker)
        else:
            await remove_from_watchlist(conn, source, change.ticker.upper())
        return {}

    return await run_action(describe_watchlist_change(change), perform)


async def apply_trade(conn, cache, source, trade: TradeInstruction) -> dict:
    """Execute one trade and describe the outcome."""

    async def perform() -> dict:
        executed = await execute_trade_and_sync(conn, cache, source, trade.ticker, trade.side, trade.quantity)
        return {"price": executed.price}

    return await run_action(describe_trade(trade), perform)


def skipped(action: dict, noun: str) -> dict:
    """Record an action over the per-message cap as failed without running it."""
    error = f"Skipped: only the first {MAX_ACTIONS_PER_KIND} {noun} per message are executed"
    return {**action, "status": "failed", "error": error}


async def run_watchlist_changes(conn, source, changes: list[WatchlistChange]) -> list[dict]:
    """Apply the first MAX_ACTIONS_PER_KIND watchlist changes and record the rest as skipped."""
    actions = [await apply_watchlist_change(conn, source, change) for change in changes[:MAX_ACTIONS_PER_KIND]]
    over_cap = changes[MAX_ACTIONS_PER_KIND:]
    return actions + [skipped(describe_watchlist_change(change), "watchlist changes") for change in over_cap]


async def run_trades(conn, cache, source, trades: list[TradeInstruction]) -> list[dict]:
    """Execute the first MAX_ACTIONS_PER_KIND trades and record the rest as skipped."""
    actions = [await apply_trade(conn, cache, source, trade) for trade in trades[:MAX_ACTIONS_PER_KIND]]
    over_cap = trades[MAX_ACTIONS_PER_KIND:]
    return actions + [skipped(describe_trade(trade), "trades") for trade in over_cap]


async def handle_chat_message(conn, cache, source, message: str) -> dict:
    """Run one chat turn. Raises LLMError before anything is executed or stored."""
    messages = build_messages(
        get_portfolio(conn, cache),
        watchlist_with_prices(conn, cache),
        repository.recent_chat_messages(conn, limit=HISTORY_LIMIT),
        message,
    )
    reply = await generate_reply(messages, message)

    actions = await run_watchlist_changes(conn, source, reply.watchlist_changes)
    actions += await run_trades(conn, cache, source, reply.trades)

    with savepoint(conn):
        repository.insert_chat_message(conn, "user", message, None)
        repository.insert_chat_message(conn, "assistant", reply.message, actions)
    return {"message": reply.message, "actions": actions}
