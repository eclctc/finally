import { test, expect, Page } from "@playwright/test";
import { closePosition, heldQuantity, readNumber, tradeViaApi } from "./helpers";

async function submitTrade(page: Page, ticker: string, quantity: number, side: "buy" | "sell") {
  await page.getByTestId("trade-ticker").fill(ticker);
  await page.getByTestId("trade-quantity").fill(String(quantity));
  await page.getByTestId(`trade-${side}`).click();
}

test("buying shares lowers cash and adds a position", async ({ page, request }) => {
  await closePosition(request, "MSFT");
  await page.goto("/");
  const cash = page.getByTestId("cash-balance");
  await expect.poll(() => readNumber(cash)).toBeGreaterThan(0);
  const cashBefore = await readNumber(cash);

  await submitTrade(page, "MSFT", 2, "buy");

  await expect.poll(() => readNumber(cash)).toBeLessThan(cashBefore);
  await expect(page.getByTestId("position-row-MSFT")).toBeVisible();
  await expect(page.getByTestId("positions-table")).toContainText("MSFT");
  expect(await heldQuantity(request, "MSFT")).toBe(2);
});

test("selling part of a position raises cash and keeps the position", async ({ page, request }) => {
  await closePosition(request, "NVDA");
  await tradeViaApi(request, "NVDA", "buy", 3);
  await page.goto("/");
  const cash = page.getByTestId("cash-balance");
  await expect(page.getByTestId("position-row-NVDA")).toBeVisible();
  const cashBefore = await readNumber(cash);

  await submitTrade(page, "NVDA", 1, "sell");

  await expect.poll(() => readNumber(cash)).toBeGreaterThan(cashBefore);
  await expect(page.getByTestId("position-row-NVDA")).toBeVisible();
  expect(await heldQuantity(request, "NVDA")).toBe(2);
});

test("selling an entire position removes it from the table", async ({ page, request }) => {
  await closePosition(request, "AMZN");
  await tradeViaApi(request, "AMZN", "buy", 2);
  await page.goto("/");
  const cash = page.getByTestId("cash-balance");
  await expect(page.getByTestId("position-row-AMZN")).toBeVisible();
  const cashBefore = await readNumber(cash);

  await submitTrade(page, "AMZN", 2, "sell");

  await expect.poll(() => readNumber(cash)).toBeGreaterThan(cashBefore);
  await expect(page.getByTestId("position-row-AMZN")).toHaveCount(0);
});

test("selling more shares than held shows a trade error", async ({ page, request }) => {
  await closePosition(request, "TSLA");
  await page.goto("/");
  await expect(page.getByTestId("watchlist-row-TSLA")).toBeVisible();

  await submitTrade(page, "TSLA", 1, "sell");

  await expect(page.getByTestId("trade-error")).toBeVisible();
  await expect(page.getByTestId("position-row-TSLA")).toHaveCount(0);
});
