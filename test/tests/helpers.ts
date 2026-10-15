import { APIRequestContext, Locator, expect } from "@playwright/test";

/** Parse a displayed money/number string like "$10,000.00" into a number. */
export function parseNumber(text: string): number {
  return Number(text.replace(/[^0-9.-]/g, ""));
}

/** Read a locator's text content as a number. */
export async function readNumber(locator: Locator): Promise<number> {
  return parseNumber((await locator.textContent()) ?? "");
}

export async function getPortfolio(request: APIRequestContext) {
  const response = await request.get("/api/portfolio");
  expect(response.ok()).toBeTruthy();
  return response.json();
}

/** Return the held quantity of a ticker, 0 if not held. */
export async function heldQuantity(request: APIRequestContext, ticker: string): Promise<number> {
  const portfolio = await getPortfolio(request);
  const position = portfolio.positions.find((p: { ticker: string }) => p.ticker === ticker);
  return position ? position.quantity : 0;
}

export async function tradeViaApi(
  request: APIRequestContext,
  ticker: string,
  side: "buy" | "sell",
  quantity: number,
) {
  const response = await request.post("/api/portfolio/trade", { data: { ticker, side, quantity } });
  expect(response.ok(), await response.text()).toBeTruthy();
}

/** Sell any held shares of a ticker so the test starts without a position. */
export async function closePosition(request: APIRequestContext, ticker: string) {
  const quantity = await heldQuantity(request, ticker);
  if (quantity > 0) await tradeViaApi(request, ticker, "sell", quantity);
}

/** Remove a ticker from the watchlist if present (404 when absent is fine). */
export async function unwatch(request: APIRequestContext, ticker: string) {
  await request.delete(`/api/watchlist/${ticker}`);
}

export async function watch(request: APIRequestContext, ticker: string) {
  const response = await request.post("/api/watchlist", { data: { ticker } });
  expect(response.ok(), await response.text()).toBeTruthy();
}
