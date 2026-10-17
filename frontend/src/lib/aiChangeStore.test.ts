import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_HIGHLIGHT_FADE_MS,
  AI_HIGHLIGHT_HOLD_MS,
  getAiChange,
  markAiChanged,
  resetAiChanges,
  subscribeAiChanges,
} from "./aiChangeStore";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const aapl = () => getAiChange("position", "AAPL");

describe("aiChangeStore", () => {
  it("exposes the hold and fade durations", () => {
    expect(AI_HIGHLIGHT_HOLD_MS).toBe(1500);
    expect(AI_HIGHLIGHT_FADE_MS).toBe(1000);
  });

  it("holds for 1,500 ms, fades for 1,000 ms, then clears", () => {
    expect(aapl()).toBeNull();
    markAiChanged("position", "AAPL");
    expect(aapl()).toBe("hold");
    vi.advanceTimersByTime(1499);
    expect(aapl()).toBe("hold");
    vi.advanceTimersByTime(1);
    expect(aapl()).toBe("fade");
    vi.advanceTimersByTime(999);
    expect(aapl()).toBe("fade");
    vi.advanceTimersByTime(1);
    expect(aapl()).toBeNull();
  });

  it("restarts the full window on a repeat mark", () => {
    markAiChanged("position", "AAPL");
    vi.advanceTimersByTime(2000);
    expect(aapl()).toBe("fade");
    markAiChanged("position", "AAPL");
    expect(aapl()).toBe("hold");
    vi.advanceTimersByTime(1499);
    expect(aapl()).toBe("hold");
    vi.advanceTimersByTime(1);
    expect(aapl()).toBe("fade");
    vi.advanceTimersByTime(1000);
    expect(aapl()).toBeNull();
  });

  it("keeps kinds and tickers independent", () => {
    markAiChanged("watchlist", "AAPL");
    expect(aapl()).toBeNull();
    expect(getAiChange("watchlist", "MSFT")).toBeNull();
    expect(getAiChange("watchlist", "AAPL")).toBe("hold");
  });

  it("notifies a subscriber on hold, fade and removal, and not after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAiChanges(listener);
    markAiChanged("position", "AAPL");
    vi.advanceTimersByTime(2500);
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    markAiChanged("position", "AAPL");
    vi.advanceTimersByTime(2500);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("resetAiChanges clears the phase and cancels timers and listeners", () => {
    const listener = vi.fn();
    subscribeAiChanges(listener);
    markAiChanged("position", "AAPL");
    expect(listener).toHaveBeenCalledTimes(1);
    resetAiChanges();
    expect(aapl()).toBeNull();
    vi.advanceTimersByTime(5000);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
