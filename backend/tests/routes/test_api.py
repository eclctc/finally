import json
from types import SimpleNamespace

from app.main import app
from app.market.router import stream_prices

DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]


def buy(client, ticker="AAPL", quantity=1, side="buy"):
    return client.post("/api/portfolio/trade", json={"ticker": ticker, "quantity": quantity, "side": side})


def test_health(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["market_data"]["source"] == "simulator"


def test_fresh_portfolio(client):
    assert client.get("/api/portfolio").json() == {
        "cash_balance": 10000.0, "total_value": 10000.0, "positions_value": 0.0,
        "unrealized_pnl": 0.0, "positions": [],
    }


def test_watchlist_lists_defaults_with_prices(client):
    tickers = client.get("/api/watchlist").json()["tickers"]
    assert [t["ticker"] for t in tickers] == DEFAULT_TICKERS
    assert all(t["price"] > 0 for t in tickers)


def test_watchlist_add_and_remove(client):
    assert client.post("/api/watchlist", json={"ticker": "pypl"}).json() == {"ticker": "PYPL"}
    assert client.post("/api/watchlist", json={"ticker": "PYPL"}).status_code == 200
    assert client.delete("/api/watchlist/pypl").json() == {"ticker": "PYPL"}
    assert "PYPL" not in [t["ticker"] for t in client.get("/api/watchlist").json()["tickers"]]


def test_watchlist_errors(client):
    response = client.post("/api/watchlist", json={"ticker": "bad1"})
    assert response.status_code == 400 and "Invalid ticker" in response.json()["error"]
    response = client.delete("/api/watchlist/ZZZZ")
    assert response.status_code == 404 and "error" in response.json()


def test_trade_returns_trade_and_portfolio(client):
    body = buy(client, quantity=2).json()
    assert set(body["trade"]) == {"id", "ticker", "side", "quantity", "price", "executed_at"}
    assert body["portfolio"]["positions"][0]["ticker"] == "AAPL"
    assert body["portfolio"]["cash_balance"] == round(10000 - 2 * body["trade"]["price"], 2)
    assert len(client.get("/api/portfolio/history").json()["snapshots"]) == 1


def test_sell_closes_position(client):
    buy(client, quantity=3)
    body = buy(client, quantity=3, side="sell").json()
    assert body["portfolio"]["positions"] == []


def test_trade_errors_are_400(client):
    for response in (
        buy(client, quantity=1000),
        buy(client, side="sell"),
        buy(client, ticker="ZZZZ"),
        buy(client, quantity=0),
        client.post("/api/portfolio/trade", json={"ticker": "AAPL", "side": "buy"}),
    ):
        assert response.status_code == 400
        assert set(response.json()) == {"error"}


def test_mock_chat_buy(client):
    body = client.post("/api/chat", json={"message": "buy something"}).json()
    assert body["actions"][0]["status"] == "ok"
    assert client.get("/api/portfolio").json()["positions"][0]["ticker"] == "AAPL"


async def test_stream_route_sends_price_frame(client):
    async def disconnect_after_first_check():
        checks.append(1)
        return len(checks) > 1

    checks = []
    request = SimpleNamespace(app=app, is_disconnected=disconnect_after_first_check)
    response = await stream_prices(request)
    assert response.media_type == "text/event-stream"
    frames = [frame async for frame in response.body_iterator]
    payload = json.loads(frames[1].removeprefix("data: "))
    assert set(DEFAULT_TICKERS) <= set(payload)
