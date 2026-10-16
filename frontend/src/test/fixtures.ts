import type { Snapshot } from "@/lib/pnlSeries";
import type { Portfolio, PortfolioPosition } from "@/lib/portfolioValue";

/** Full SSE entry for one ticker; open price defaults to the price. */
export const makeFrameEntry = (ticker: string, price: number, timestamp: number, openPrice = price) => ({
  ticker,
  price,
  previous_price: price,
  open_price: openPrice,
  timestamp,
  change: 0,
  change_percent: 0,
  direction: "flat",
});

/** SSE frame keyed by ticker. */
export const makeFrame = (...entries: ReturnType<typeof makeFrameEntry>[]) =>
  Object.fromEntries(entries.map((entry) => [entry.ticker, entry]));

/** GET /api/watchlist entry: priced when a price is given, otherwise all price fields null. */
export const makeWatchlistEntry = (ticker: string, price?: number) =>
  price === undefined
    ? {
        ticker,
        price: null,
        previous_price: null,
        open_price: null,
        change: null,
        change_percent: null,
        direction: null,
        timestamp: null,
      }
    : makeFrameEntry(ticker, price, 1);

/** Minimal fetch Response carrying a JSON body. */
export const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

/** Held position at a current price; market value and P&L are derived from the inputs. */
export const makePosition = (
  ticker: string,
  quantity: number,
  avgCost: number,
  currentPrice: number,
): PortfolioPosition => ({
  ticker,
  quantity,
  avg_cost: avgCost,
  current_price: currentPrice,
  market_value: quantity * currentPrice,
  unrealized_pnl: quantity * (currentPrice - avgCost),
  pnl_percent: ((currentPrice - avgCost) / avgCost) * 100,
});

/** GET /api/portfolio body: totals are derived from cash and positions. */
export const makePortfolio = (cash: number, positions: PortfolioPosition[] = []): Portfolio => {
  const positionsValue = positions.reduce((sum, position) => sum + position.market_value, 0);
  return {
    cash_balance: cash,
    total_value: cash + positionsValue,
    positions_value: positionsValue,
    unrealized_pnl: positions.reduce((sum, position) => sum + position.unrealized_pnl, 0),
    positions,
  };
};

/** POST /api/portfolio/trade 200 body. */
export const makeTradeResponse = (
  trade: { ticker: string; side: "buy" | "sell"; quantity: number; price: number },
  portfolio: Portfolio,
) => ({
  trade: { id: "trade-1", executed_at: "2026-10-16T21:00:59.139123+00:00", ...trade },
  portfolio,
});

/** GET /api/portfolio/history snapshot: the total value recorded at an ISO timestamp. */
export const makeSnapshot = (totalValue: number, recordedAt: string): Snapshot => ({
  total_value: totalValue,
  recorded_at: recordedAt,
});
