import { test, expect } from "@playwright/test";
import { readNumber } from "./helpers";

const ONE_EVENT_THEN_CLOSE =
  "retry: 500\n\n" +
  'data: {"AAPL": {"ticker": "AAPL", "price": 1.0, "previous_price": 1.0, "open_price": 1.0, ' +
  '"timestamp": 0, "change": 0, "change_percent": 0, "direction": "flat"}}\n\n';

/**
 * The first stream connection sends one event and closes (a server drop).
 * Reconnect attempts fail while the server is "down", then pass through to the real stream.
 */
test("price stream reconnects after the server drops the connection", async ({ page }) => {
  let serverMode: "drop" | "down" | "up" = "drop";
  await page.route("**/api/stream/prices", async (route) => {
    if (serverMode === "drop") {
      serverMode = "down";
      await route.fulfill({ status: 200, contentType: "text/event-stream", body: ONE_EVENT_THEN_CLOSE });
    } else if (serverMode === "down") {
      await route.abort("connectionrefused");
    } else {
      await route.continue();
    }
  });

  await page.goto("/");
  const status = page.getByTestId("connection-status");
  const price = page.getByTestId("watchlist-price-AAPL");
  await expect.poll(() => readNumber(price)).toBe(1);
  await expect(status).toHaveAttribute("data-status", "reconnecting");

  serverMode = "up";
  await expect(status).toHaveAttribute("data-status", "connected");

  await expect.poll(() => readNumber(price)).toBeGreaterThan(100);
  const priceAfterReconnect = await price.textContent();
  await expect.poll(() => price.textContent()).not.toBe(priceAfterReconnect);
});
