import { describe, expect, it } from "vitest";
import { livePosition, liveTotalValue, type Portfolio, type PortfolioPosition } from "@/lib/portfolioValue";

const position = (ticker: string, quantity: number, currentPrice: number): PortfolioPosition => ({
  ticker,
  quantity,
  avg_cost: 100,
  current_price: currentPrice,
  market_value: quantity * currentPrice,
  unrealized_pnl: 0,
  pnl_percent: 0,
});

const portfolio = (cash: number, ...positions: PortfolioPosition[]): Portfolio => ({
  cash_balance: cash,
  total_value: 0,
  positions_value: 0,
  unrealized_pnl: 0,
  positions,
});

const noLivePrice = () => undefined;

describe("liveTotalValue", () => {
  it("equals cash when there are no positions", () => {
    expect(liveTotalValue(portfolio(10000), noLivePrice)).toBe(10000);
  });

  it("values a position at its API price when the stream has none", () => {
    const held = portfolio(2500.5, position("AAPL", 10, 984.5178));
    expect(liveTotalValue(held, noLivePrice)).toBeCloseTo(12345.678, 6);
  });

  it("values a position at the live price when the stream has one", () => {
    const held = portfolio(2500.5, position("AAPL", 10, 984.5178));
    expect(liveTotalValue(held, () => 1000)).toBe(12500.5);
  });

  it("sums a live-priced and a fallback-priced position without counting either as zero", () => {
    const held = portfolio(0, position("AAPL", 2, 100), position("MSFT", 3, 50));
    const live = (ticker: string) => (ticker === "AAPL" ? 110 : undefined);
    expect(liveTotalValue(held, live)).toBe(2 * 110 + 3 * 50);
  });
});

describe("livePosition", () => {
  it("values the position at the live price when given", () => {
    expect(livePosition(position("AAPL", 10, 120), 110)).toEqual({
      price: 110,
      marketValue: 1100,
      pnl: 100,
      pnlFraction: 0.1,
    });
  });

  it("falls back to the API current price without a live price", () => {
    expect(livePosition(position("AAPL", 10, 90), undefined)).toEqual({
      price: 90,
      marketValue: 900,
      pnl: -100,
      pnlFraction: -0.1,
    });
  });
});
