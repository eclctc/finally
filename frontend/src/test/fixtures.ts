import type { Portfolio, Position, PriceUpdate } from "@/lib/types";

export function priceUpdate(overrides: Partial<PriceUpdate> = {}): PriceUpdate {
  return {
    ticker: "AAPL",
    price: 190,
    previous_price: 189.5,
    open_price: 188,
    timestamp: 1000,
    change: 0.5,
    change_percent: 0.26,
    direction: "up",
    ...overrides,
  };
}

export function position(overrides: Partial<Position> = {}): Position {
  return {
    ticker: "AAPL",
    quantity: 10,
    avg_cost: 180,
    current_price: 185,
    market_value: 1850,
    unrealized_pnl: 50,
    pnl_percent: 2.78,
    ...overrides,
  };
}

export function portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    cash_balance: 5000,
    total_value: 6850,
    positions_value: 1850,
    unrealized_pnl: 50,
    positions: [position()],
    ...overrides,
  };
}
