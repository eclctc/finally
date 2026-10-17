import { describe, expect, it } from "vitest";
import { removedTickers } from "@/lib/chatEffects";
import {
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
