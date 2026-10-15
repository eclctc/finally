"""Structured output the LLM must return for every chat turn."""

from typing import Literal

from pydantic import BaseModel


class TradeInstruction(BaseModel):
    """A market order the assistant wants executed."""

    ticker: str
    side: Literal["buy", "sell"]
    quantity: float


class WatchlistChange(BaseModel):
    """A watchlist add or remove the assistant wants applied."""

    ticker: str
    action: Literal["add", "remove"]


class ChatReply(BaseModel):
    """The assistant's full reply: text plus actions to auto-execute."""

    message: str
    trades: list[TradeInstruction]
    watchlist_changes: list[WatchlistChange]
