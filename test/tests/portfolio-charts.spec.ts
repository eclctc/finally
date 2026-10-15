import { test, expect } from "@playwright/test";
import { tradeViaApi } from "./helpers";

test("heatmap and P&L chart render once a position exists", async ({ page, request }) => {
  await tradeViaApi(request, "JPM", "buy", 1);
  const history = await (await request.get("/api/portfolio/history")).json();
  expect(history.snapshots.length).toBeGreaterThan(0);

  await page.goto("/");

  const heatmap = page.getByTestId("heatmap");
  await expect(heatmap).toBeVisible();
  await expect(heatmap).toContainText("JPM");
  await expect(heatmap.locator("svg rect").first()).toBeVisible();

  const pnlChart = page.getByTestId("pnl-chart");
  await expect(pnlChart).toBeVisible();
  await expect(pnlChart.locator("svg path.recharts-curve").first()).toBeAttached();
});
