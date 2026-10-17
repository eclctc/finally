import { describe, expect, it } from "vitest";
import { describeAction } from "@/lib/chat";
import {
  makeFailedTrade,
  makeFailedWatchlistChange,
  makeOkTrade,
  makeOkWatchlistChange,
} from "@/test/fixtures";

describe("describeAction", () => {
  it.each([
    ["ok buy", makeOkTrade("AAPL", "buy", 1, 190.1234), "BUY 1 AAPL @ 190.12"],
    ["ok sell with a fractional quantity", makeOkTrade("NVDA", "sell", 2.5, 120.4), "SELL 2.5 NVDA @ 120.40"],
    [
      "failed buy",
      makeFailedTrade("AAPL", "buy", 1, "Insufficient cash: need $190.12, have $0.00"),
      "BUY 1 AAPL failed - Insufficient cash: need $190.12, have $0.00",
    ],
    [
      "skipped trade",
      makeFailedTrade("AAPL", "buy", 1, "Skipped: only the first 5 trades per message are executed"),
      "BUY 1 AAPL failed - Skipped: only the first 5 trades per message are executed",
    ],
    ["ok add", makeOkWatchlistChange("PYPL", "add"), "Added PYPL"],
    ["ok remove", makeOkWatchlistChange("PYPL", "remove"), "Removed PYPL"],
    [
      "failed add",
      makeFailedWatchlistChange("PYPL", "add", "Unknown ticker: PYPL"),
      "Add PYPL failed - Unknown ticker: PYPL",
    ],
    [
      "failed remove",
      makeFailedWatchlistChange("PYPL", "remove", "PYPL is not on the watchlist"),
      "Remove PYPL failed - PYPL is not on the watchlist",
    ],
  ])("%s", (_name, action, expected) => {
    expect(describeAction(action)).toBe(expected);
  });

  it("keeps a 120-character reason whole", () => {
    const reason = "x".repeat(120);
    expect(describeAction(makeFailedTrade("AAPL", "sell", 1, reason))).toBe(`SELL 1 AAPL failed - ${reason}`);
  });
});
