import { test, expect } from "@playwright/test";

test("mocked AI chat buys AAPL and shows the trade inline", async ({ page }) => {
  await page.goto("/");
  const assistantMessages = page.locator('[data-testid="chat-message"][data-role="assistant"]');
  const actions = page.getByTestId("chat-action");
  await expect(page.getByTestId("chat-panel")).toBeVisible();
  const messagesBefore = await assistantMessages.count();
  const actionsBefore = await actions.count();

  await page.getByTestId("chat-input").fill("Please buy some Apple");
  await page.getByTestId("chat-send").click();

  await expect(page.locator('[data-testid="chat-message"][data-role="user"]').last()).toContainText("Please buy some Apple");
  await expect(assistantMessages).toHaveCount(messagesBefore + 1);
  await expect(page.getByTestId("chat-loading")).toHaveCount(0);
  await expect(actions).toHaveCount(actionsBefore + 1);
  const action = actions.last();
  await expect(action).toHaveAttribute("data-status", "ok");
  await expect(action).toContainText("AAPL");
  await expect(page.getByTestId("position-row-AAPL")).toBeVisible();
});
