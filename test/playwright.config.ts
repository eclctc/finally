import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Tests share one backend database, so they run serially.
 * The "fresh-start" project needs a fresh database and runs before the rest.
 */
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8010",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1600, height: 1000 },
  },
  projects: [
    { name: "fresh-start", testMatch: /fresh-start\.spec\.ts/ },
    { name: "features", testIgnore: /fresh-start\.spec\.ts/, dependencies: ["fresh-start"] },
  ],
});
