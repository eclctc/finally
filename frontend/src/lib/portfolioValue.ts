/** One held position as returned by GET /api/portfolio. */
export interface PortfolioPosition {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  pnl_percent: number;
}

/** GET /api/portfolio response. */
export interface Portfolio {
  cash_balance: number;
  total_value: number;
  positions_value: number;
  unrealized_pnl: number;
  positions: PortfolioPosition[];
}

/**
 * Cash plus every position at its live price, falling back to the API price when the
 * stream has none. Unrounded: formatCurrency rounds at render.
 */
export function liveTotalValue(
  portfolio: Portfolio,
  livePrice: (ticker: string) => number | undefined,
): number {
  const positionsValue = portfolio.positions.reduce(
    (sum, position) => sum + position.quantity * (livePrice(position.ticker) ?? position.current_price),
    0,
  );
  return portfolio.cash_balance + positionsValue;
}
