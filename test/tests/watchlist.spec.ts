import { test, expect } from "@playwright/test";
import { unwatch } from "./helpers";

const TICKER = "DIS";

test.beforeEach(async ({ request }) => {
  await unwatch(request, TICKER);
});

test("adding and removing a ticker updates the watchlist", async ({ page }) => {
  await page.goto("/");
  const row = page.getByTestId(`watchlist-row-${TICKER}`);
  await expect(page.getByTestId("watchlist-row-AAPL")).toBeVisible();
  await expect(row).toHaveCount(0);

  await page.getByTestId("watchlist-add-input").fill(TICKER);
  await page.getByTestId("watchlist-add-button").click();
  await expect(row).toBeVisible();

  await page.getByTestId(`watchlist-remove-${TICKER}`).click();
  await expect(row).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("watchlist-row-AAPL")).toBeVisible();
  await expect(row).toHaveCount(0);
});

test("clicking a watchlist row selects it in the main chart and trade bar", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("watchlist-row-NVDA").click();
  await expect(page.getByTestId("main-chart")).toHaveAttribute("data-ticker", "NVDA");
  await expect(page.getByTestId("trade-ticker")).toHaveValue("NVDA");
});
