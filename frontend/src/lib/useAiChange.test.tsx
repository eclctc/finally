import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markAiChanged } from "./aiChangeStore";
import { aiHighlightClass, useAiChange } from "./useAiChange";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useAiChange", () => {
  it("follows null, hold, fade and null for its own row", () => {
    const { result } = renderHook(() => useAiChange("position", "AAPL"));
    expect(result.current).toBeNull();
    act(() => markAiChanged("position", "AAPL"));
    expect(result.current).toBe("hold");
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current).toBe("fade");
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBeNull();
  });

  it("ignores marks for other rows", () => {
    const { result } = renderHook(() => useAiChange("position", "AAPL"));
    act(() => markAiChanged("position", "MSFT"));
    act(() => markAiChanged("watchlist", "AAPL"));
    expect(result.current).toBeNull();
  });

  it("renders no highlight on the server", () => {
    markAiChanged("position", "AAPL");
    function Probe() {
      return <p>{String(useAiChange("position", "AAPL"))}</p>;
    }
    expect(renderToString(<Probe />)).toContain("null");
  });
});

describe("aiHighlightClass", () => {
  const cases = [
    ["hold", "transparent"],
    ["hold", "surface"],
    ["fade", "transparent"],
    ["fade", "surface"],
  ] as const;

  it.each(cases)("%s over %s carries exactly one background utility", (phase, resting) => {
    const tokens = aiHighlightClass(phase, resting).split(" ");
    expect(tokens.filter((token) => token.startsWith("bg-"))).toHaveLength(1);
  });

  it.each([["transparent"], ["surface"]] as const)("hold is the blue fill without a transition (%s)", (resting) => {
    const classes = aiHighlightClass("hold", resting);
    expect(classes).toContain("bg-primary/20");
    expect(classes).toContain("transition-none");
  });

  it.each([
    ["transparent", "bg-transparent"],
    ["surface", "bg-surface"],
  ] as const)("fade to %s eases the fill out and respects reduced motion", (resting, fill) => {
    const classes = aiHighlightClass("fade", resting);
    expect(classes).toContain(fill);
    for (const token of ["transition-colors", "duration-1000", "ease-out", "motion-reduce:transition-none"]) {
      expect(classes).toContain(token);
    }
  });
});
