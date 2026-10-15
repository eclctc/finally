from types import SimpleNamespace

from app.chat.prompt import build_messages

PORTFOLIO = {
    "cash_balance": 8000.0,
    "total_value": 10100.0,
    "positions_value": 2100.0,
    "unrealized_pnl": 100.0,
    "positions": [
        {
            "ticker": "AAPL",
            "quantity": 10,
            "avg_cost": 200.0,
            "current_price": 210.0,
            "market_value": 2100.0,
            "unrealized_pnl": 100.0,
            "pnl_percent": 5.0,
        }
    ],
}
WATCHLIST = [{"ticker": "AAPL", "price": 210.0}, {"ticker": "PYPL", "price": None}]


def test_system_prompt_contains_context():
    messages = build_messages(PORTFOLIO, WATCHLIST, [], "hello")
    system = messages[0]["content"]
    assert messages[0]["role"] == "system"
    assert "FinAlly, an AI trading assistant" in system
    assert "Cash: $8000.00" in system
    assert "Total portfolio value: $10100.00" in system
    assert "AAPL: 10 shares, avg cost $200.00, price $210.00, P&L $100.00 (5.00%)" in system
    assert "PYPL: no price yet" in system


def test_history_then_user_message():
    history = [
        SimpleNamespace(role="user", content="buy 1000 TSLA", actions=None),
        SimpleNamespace(
            role="assistant",
            content="Trying.",
            actions=[{"type": "trade", "ticker": "TSLA", "status": "failed", "error": "Insufficient cash"}],
        ),
    ]
    messages = build_messages(PORTFOLIO, WATCHLIST, history, "why?")
    assert [m["role"] for m in messages] == ["system", "user", "assistant", "user"]
    assert messages[1]["content"] == "buy 1000 TSLA"
    assert "Insufficient cash" in messages[2]["content"]
    assert messages[3]["content"] == "why?"


def test_empty_portfolio():
    empty = {**PORTFOLIO, "positions": []}
    assert "Positions:\n- none" in build_messages(empty, [], [], "hi")[0]["content"]
