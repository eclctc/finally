import { describe, expect, it } from "vitest";
import { aiChangeTargets, removedTickers } from "@/lib/chatEffects";
import {
  makeFailedTrade,
  makeFailedWatchlistChange,
  makeOkTrade,
  makeOkWatchlistChange,
} from "@/test/fixtures";

describe("removedTickers", () => {
  it("returns the ticker of an ok remove", () => {
    expect(removedTickers([makeOkWatchlistChange("AAPL", "remove")])).toEqual(["AAPL"]);
  });

  it("ignores a failed remove", () => {
    expect(removedTickers([makeFailedWatchlistChange("AAPL", "remove", "AAPL is not on the watchlist")])).toEqual([]);
  });

  it("ignores an ok add", () => {
    expect(removedTickers([makeOkWatchlistChange("PYPL", "add")])).toEqual([]);
  });

  it("ignores an ok trade", () => {
    expect(removedTickers([makeOkTrade("AAPL", "buy", 1, 190)])).toEqual([]);
  });

  it("keeps the returned order and skips everything that is not an ok remove", () => {
    const actions = [
      makeOkWatchlistChange("MSFT", "remove"),
      makeOkWatchlistChange("PYPL", "add"),
      makeOkWatchlistChange("AAPL", "remove"),
    ];
    expect(removedTickers(actions)).toEqual(["MSFT", "AAPL"]);
  });
});

describe("aiChangeTargets", () => {
  it("maps ok trades and ok adds in order and skips removes and failed actions", () => {
    const actions = [
      makeOkWatchlistChange("PYPL", "add"),
      makeOkWatchlistChange("MSFT", "remove"),
      makeOkTrade("AAPL", "buy", 1, 190),
      makeOkTrade("NVDA", "sell", 2, 900),
      makeFailedTrade("TSLA", "buy", 1, "Insufficient cash"),
      makeFailedWatchlistChange("ZZZZ", "add", "Unknown ticker"),
    ];
    expect(aiChangeTargets(actions)).toEqual([
      { kind: "watchlist", ticker: "PYPL" },
      { kind: "position", ticker: "AAPL" },
      { kind: "position", ticker: "NVDA" },
    ]);
  });

  it("returns nothing for no actions", () => {
    expect(aiChangeTargets([])).toEqual([]);
  });
});
