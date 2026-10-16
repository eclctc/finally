import { describe, expect, it, vi } from "vitest";
import { makeFrame, makeFrameEntry } from "@/test/fixtures";
import {
  EMPTY_SERIES,
  HISTORY_LIMIT,
  clearTicker,
  getEntry,
  getSeries,
  getStatus,
  getVersion,
  mergeFrame,
  resetPriceStore,
  seedPrices,
  setStatus,
  subscribeStatus,
  subscribeTicker,
  subscribeVersion,
} from "./priceStore";

const aapl = (price: number, timestamp: number, openPrice?: number) =>
  makeFrame(makeFrameEntry("AAPL", price, timestamp, openPrice));

const prices = (ticker: string) => getSeries(ticker).map((point) => point.price);

describe("mergeFrame", () => {
  it("stores price, open price and timestamp with no flash on the first tick", () => {
    mergeFrame(aapl(190.5, 1, 190));
    expect(getEntry("AAPL")).toEqual({ price: 190.5, openPrice: 190, timestamp: 1, flash: null });
  });

  it("flashes up, down and null by comparing raw prices and appends one history point per tick", () => {
    mergeFrame(aapl(100, 1));
    mergeFrame(aapl(101, 2));
    expect(getEntry("AAPL")?.flash).toBe("up");
    mergeFrame(aapl(99, 3));
    expect(getEntry("AAPL")?.flash).toBe("down");
    mergeFrame(aapl(99, 4));
    expect(getEntry("AAPL")?.flash).toBeNull();
    expect(prices("AAPL")).toEqual([100, 101, 99, 99]);
  });

  it("ignores a repeated timestamp: same entry object, no listener call, no history point, same version", () => {
    mergeFrame(aapl(100, 1));
    const stored = getEntry("AAPL");
    const version = getVersion();
    const listener = vi.fn();
    subscribeTicker("AAPL", listener);
    mergeFrame(aapl(105, 1));
    expect(getEntry("AAPL")).toBe(stored);
    expect(listener).not.toHaveBeenCalled();
    expect(getSeries("AAPL")).toHaveLength(1);
    expect(getVersion()).toBe(version);
  });

  it("merging the same frame twice changes nothing after the first merge", () => {
    const frame = aapl(100, 1);
    mergeFrame(frame);
    const stored = getEntry("AAPL");
    const history = getSeries("AAPL");
    const version = getVersion();
    mergeFrame(frame);
    expect(getEntry("AAPL")).toBe(stored);
    expect(getSeries("AAPL")).toBe(history);
    expect(getVersion()).toBe(version);
  });

  it("replaces the entry for a lower timestamp (inequality only, never order)", () => {
    mergeFrame(aapl(100, 1792174878));
    mergeFrame(aapl(150, 0));
    expect(getEntry("AAPL")?.price).toBe(150);
  });

  it("an empty frame notifies nobody and keeps the version", () => {
    const listener = vi.fn();
    subscribeVersion(listener);
    mergeFrame({});
    expect(listener).not.toHaveBeenCalled();
    expect(getVersion()).toBe(0);
  });

  it("skips an entry with a null price", () => {
    mergeFrame({ AAPL: { ticker: "AAPL", price: null, open_price: null, timestamp: null } });
    expect(getEntry("AAPL")).toBeUndefined();
    expect(getVersion()).toBe(0);
  });

  it("notifies only the ticker that appears in the frame", () => {
    const aaplListener = vi.fn();
    const msftListener = vi.fn();
    subscribeTicker("AAPL", aaplListener);
    subscribeTicker("MSFT", msftListener);
    mergeFrame(aapl(100, 1));
    expect(aaplListener).toHaveBeenCalledTimes(1);
    expect(msftListener).not.toHaveBeenCalled();
  });

  it("notifies the version listener once per changing frame", () => {
    const listener = vi.fn();
    subscribeVersion(listener);
    mergeFrame(makeFrame(makeFrameEntry("AAPL", 100, 1), makeFrameEntry("MSFT", 200, 1)));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getVersion()).toBe(1);
  });

  it("ignores the frame's sticky direction: an equal price flashes null", () => {
    mergeFrame(aapl(100, 1));
    const stickyUp = { ...makeFrameEntry("AAPL", 100, 2), direction: "up" };
    mergeFrame({ AAPL: stickyUp });
    expect(getEntry("AAPL")?.flash).toBeNull();
  });

  it("keeps price and open price exactly as received", () => {
    mergeFrame(aapl(100.001, 1, 99.999));
    expect(getEntry("AAPL")?.price).toBe(100.001);
    expect(getEntry("AAPL")?.openPrice).toBe(99.999);
  });
});

describe("history", () => {
  const tick = (index: number) => mergeFrame(aapl(100 + index, index + 1));

  it.each([
    [1199, 1199],
    [1200, 1200],
    [1201, 1200],
  ])("holds %i distinct ticks as %i points", (ticks, expected) => {
    for (let i = 0; i < ticks; i++) tick(i);
    expect(getSeries("AAPL")).toHaveLength(expected);
    expect(HISTORY_LIMIT).toBe(1200);
  });

  it("drops the oldest point past the limit", () => {
    for (let i = 0; i < 1201; i++) tick(i);
    expect(getSeries("AAPL")[0].price).toBe(101);
    expect(getSeries("AAPL").at(-1)?.price).toBe(1300);
  });

  it("stores t as exactly the frame timestamp times 1000 with the raw price", () => {
    mergeFrame(aapl(190.123456, 1792174878.5));
    expect(getSeries("AAPL")).toEqual([{ t: 1792174878.5 * 1000, price: 190.123456 }]);
  });

  it("returns a new array after an append and the same reference otherwise", () => {
    tick(0);
    const before = getSeries("AAPL");
    expect(getSeries("AAPL")).toBe(before);
    tick(1);
    expect(getSeries("AAPL")).not.toBe(before);
  });

  it("returns the shared empty history for an unknown ticker", () => {
    expect(getSeries("ZZZ")).toBe(EMPTY_SERIES);
    expect(getSeries("ZZZ")).toBe(getSeries("YYY"));
  });
});

describe("seedPrices", () => {
  it("fills an absent ticker with flash null", () => {
    seedPrices(aapl(190, 1));
    expect(getEntry("AAPL")).toEqual({ price: 190, openPrice: 190, timestamp: 1, flash: null });
    expect(prices("AAPL")).toEqual([190]);
  });

  it("adds one point carrying the REST timestamp", () => {
    seedPrices(aapl(190, 42));
    expect(getSeries("AAPL")).toEqual([{ t: 42000, price: 190 }]);
  });

  it("never overwrites a streamed entry", () => {
    mergeFrame(aapl(200, 5));
    seedPrices(aapl(190, 1));
    expect(getEntry("AAPL")?.price).toBe(200);
  });

  it("skips an unpriced entry", () => {
    seedPrices({ AAPL: { ticker: "AAPL", price: null, open_price: null, timestamp: null } });
    expect(getEntry("AAPL")).toBeUndefined();
  });
});

describe("clearTicker", () => {
  it("removes the entry and history, notifies, and the next tick has no flash", () => {
    mergeFrame(aapl(100, 1));
    const listener = vi.fn();
    subscribeTicker("AAPL", listener);
    clearTicker("AAPL");
    expect(getEntry("AAPL")).toBeUndefined();
    expect(getSeries("AAPL")).toBe(EMPTY_SERIES);
    expect(listener).toHaveBeenCalledTimes(1);
    mergeFrame(aapl(110, 2));
    expect(getEntry("AAPL")?.flash).toBeNull();
  });
});

describe("status", () => {
  it("starts reconnecting and notifies once per real change", () => {
    expect(getStatus()).toBe("reconnecting");
    const listener = vi.fn();
    subscribeStatus(listener);
    setStatus("reconnecting");
    expect(listener).not.toHaveBeenCalled();
    setStatus("connected");
    setStatus("connected");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getStatus()).toBe("connected");
  });
});

describe("subscriptions", () => {
  it("stops calling a listener after it unsubscribes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTicker("AAPL", listener);
    unsubscribe();
    mergeFrame(aapl(100, 1));
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("resetPriceStore", () => {
  it("restores the initial state and drops listeners", () => {
    const listener = vi.fn();
    subscribeTicker("AAPL", listener);
    mergeFrame(aapl(100, 1));
    setStatus("connected");
    listener.mockClear();
    resetPriceStore();
    expect(getEntry("AAPL")).toBeUndefined();
    expect(getSeries("AAPL")).toBe(EMPTY_SERIES);
    expect(getStatus()).toBe("reconnecting");
    expect(getVersion()).toBe(0);
    mergeFrame(aapl(100, 1));
    expect(listener).not.toHaveBeenCalled();
  });
});
