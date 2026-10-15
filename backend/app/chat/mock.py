"""Deterministic replies used when LLM_MOCK=true (PLAN section 9)."""

from .schemas import ChatReply, TradeInstruction, WatchlistChange


def mock_reply(user_message: str) -> ChatReply:
    """Return a fixed reply chosen by keywords in the user's message."""
    text = user_message.lower()
    if "buy" in text:
        return ChatReply(
            message="Done. Buying 1 share of AAPL.",
            trades=[TradeInstruction(ticker="AAPL", side="buy", quantity=1)],
            watchlist_changes=[],
        )
    if "sell" in text:
        return ChatReply(
            message="Done. Selling 1 share of AAPL.",
            trades=[TradeInstruction(ticker="AAPL", side="sell", quantity=1)],
            watchlist_changes=[],
        )
    if "add" in text:
        return ChatReply(
            message="Done. Adding PYPL to your watchlist.",
            trades=[],
            watchlist_changes=[WatchlistChange(ticker="PYPL", action="add")],
        )
    return ChatReply(
        message="Your portfolio is up and running. Ask me to analyze positions, trade, or manage your watchlist.",
        trades=[],
        watchlist_changes=[],
    )
