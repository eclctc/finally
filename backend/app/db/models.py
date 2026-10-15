"""Dataclasses mirroring the database tables."""

from dataclasses import dataclass


@dataclass
class Position:
    id: str
    user_id: str
    ticker: str
    quantity: float
    avg_cost: float
    updated_at: str


@dataclass
class Trade:
    id: str
    user_id: str
    ticker: str
    side: str
    quantity: float
    price: float
    executed_at: str


@dataclass
class Snapshot:
    id: str
    user_id: str
    total_value: float
    recorded_at: str


@dataclass
class ChatMessage:
    id: str
    user_id: str
    role: str
    content: str
    actions: list[dict] | None
    created_at: str
