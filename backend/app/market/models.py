from dataclasses import asdict, dataclass


@dataclass(frozen=True, slots=True)
class PriceUpdate:
    """Latest price for one ticker, with the values derived from it."""

    ticker: str
    price: float
    previous_price: float
    open_price: float
    timestamp: float  # Unix seconds, when the backend received the price

    @property
    def change(self) -> float:
        return round(self.price - self.previous_price, 4)

    @property
    def change_percent(self) -> float:
        if not self.previous_price:
            return 0.0
        return round(self.change / self.previous_price * 100, 4)

    @property
    def direction(self) -> str:
        if self.change > 0:
            return "up"
        if self.change < 0:
            return "down"
        return "flat"

    def to_dict(self) -> dict:
        """Serialize for the SSE stream and REST responses."""
        return asdict(self) | {
            "change": self.change,
            "change_percent": self.change_percent,
            "direction": self.direction,
        }
