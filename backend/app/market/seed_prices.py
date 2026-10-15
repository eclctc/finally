from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TickerProfile:
    """Starting price and GBM parameters for one ticker."""

    seed_price: float
    sigma: float  # annual volatility
    mu: float  # annual drift
    sector: str


KNOWN_TICKERS: dict[str, TickerProfile] = {
    # Default watchlist
    "AAPL": TickerProfile(190.0, 0.25, 0.08, "tech"),
    "GOOGL": TickerProfile(175.0, 0.28, 0.08, "tech"),
    "MSFT": TickerProfile(420.0, 0.24, 0.08, "tech"),
    "META": TickerProfile(500.0, 0.35, 0.10, "tech"),
    "NVDA": TickerProfile(130.0, 0.50, 0.15, "tech"),
    "AMZN": TickerProfile(185.0, 0.30, 0.08, "consumer"),
    "TSLA": TickerProfile(250.0, 0.60, 0.05, "consumer"),
    "NFLX": TickerProfile(650.0, 0.35, 0.08, "consumer"),
    "JPM": TickerProfile(200.0, 0.20, 0.06, "finance"),
    "V": TickerProfile(280.0, 0.18, 0.06, "finance"),
    # Likely additions (PYPL is the ticker the mock LLM adds)
    "PYPL": TickerProfile(70.0, 0.40, 0.05, "finance"),
    "AMD": TickerProfile(160.0, 0.50, 0.12, "tech"),
    "INTC": TickerProfile(30.0, 0.40, 0.02, "tech"),
    "DIS": TickerProfile(100.0, 0.28, 0.05, "consumer"),
    "BAC": TickerProfile(40.0, 0.25, 0.06, "finance"),
}

UNKNOWN_PRICE_RANGE = (20.0, 400.0)
UNKNOWN_SIGMA = 0.35
UNKNOWN_MU = 0.05
UNKNOWN_SECTOR = "other"
