import { test, expect } from "@playwright/test";
import { readNumber } from "./helpers";

const DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"];

test("fresh start shows the default watchlist, $10,000 cash, and streaming prices", async ({ page }) => {
  await page.goto("/");

  for (const ticker of DEFAULT_TICKERS) {
    await expect(page.getByTestId(`watchlist-row-${ticker}`)).toBeVisible();
  }
  await expect(page.getByTestId("watchlist").locator('[data-testid^="watchlist-row-"]')).toHaveCount(10);

  await expect.poll(() => readNumber(page.getByTestId("cash-balance"))).toBe(10000);
  await expect.poll(() => readNumber(page.getByTestId("total-value"))).toBe(10000);

  await expect(page.getByTestId("connection-status")).toHaveAttribute("data-status", "connected");

  const price = page.getByTestId("watchlist-price-AAPL");
  await expect.poll(() => readNumber(price)).toBeGreaterThan(0);
  const firstPrice = await price.textContent();
  await expect.poll(() => price.textContent(), { timeout: 15_000 }).not.toBe(firstPrice);
});
