import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergeFrame } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";
import { useTickerPrice } from "@/lib/usePrice";
import { makeFrame, makeFrameEntry } from "@/test/fixtures";
import { FLASH_HOLD_MS, FlashingPrice } from "./FlashingPrice";

function Probe() {
  return <FlashingPrice ticker="AAPL" entry={useTickerPrice("AAPL")} />;
}

const tick = (price: number, timestamp: number) =>
  act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", price, timestamp))));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const cell = () => screen.getByTestId(testIds.watchlistPrice("AAPL"));

describe("FlashingPrice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render(<Probe />);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows -- without an entry and never flashes on the first price", () => {
    expect(cell()).toHaveTextContent("--");
    tick(190, 1);
    expect(cell()).toHaveTextContent("190.00");
    expect(cell()).not.toHaveAttribute("data-flash");
  });

  it("flashes up with the up tint and keeps the text color", () => {
    tick(190, 1);
    tick(191, 2);
    expect(cell()).toHaveAttribute("data-flash", "up");
    expect(cell()).toHaveClass("bg-up/25", "transition-none", "text-text");
  });

  it("holds for 49 ms and clears at 50 ms into the fade classes", () => {
    expect(FLASH_HOLD_MS).toBe(50);
    tick(190, 1);
    tick(191, 2);
    advance(49);
    expect(cell()).toHaveAttribute("data-flash", "up");
    advance(1);
    expect(cell()).not.toHaveAttribute("data-flash");
    expect(cell()).toHaveClass("bg-transparent", "transition-colors", "duration-500", "ease-out");
  });

  it("flashes down with the down tint on a lower price", () => {
    tick(190, 1);
    tick(189, 2);
    expect(cell()).toHaveAttribute("data-flash", "down");
    expect(cell()).toHaveClass("bg-down/25");
  });

  it("does not flash when an identical frame is merged again", () => {
    tick(190, 1);
    tick(191, 2);
    advance(50);
    tick(191, 2);
    expect(cell()).not.toHaveAttribute("data-flash");
  });

  it("does not flash an equal price even when the frame direction says up", () => {
    tick(190, 1);
    const stickyUp = { ...makeFrameEntry("AAPL", 190, 2), direction: "up" };
    act(() => mergeFrame(makeFrame(stickyUp)));
    expect(cell()).not.toHaveAttribute("data-flash");
  });

  it("decides direction on raw prices, not on the rendered text", () => {
    tick(191, 1);
    tick(191.001, 2);
    expect(cell()).toHaveAttribute("data-flash", "up");
    expect(cell()).toHaveTextContent("191.00");
  });

  it("replaces the direction on a new tick and restarts the hold", () => {
    tick(190, 1);
    tick(191, 2);
    advance(30);
    tick(190.5, 3);
    expect(cell()).toHaveAttribute("data-flash", "down");
    advance(49);
    expect(cell()).toHaveAttribute("data-flash", "down");
    advance(1);
    expect(cell()).not.toHaveAttribute("data-flash");
  });

  it("clears the flash at once on an equal-price tick during the hold", () => {
    tick(190, 1);
    tick(191, 2);
    advance(10);
    tick(191, 3);
    expect(cell()).not.toHaveAttribute("data-flash");
  });

  it("paints nothing under reduced motion", () => {
    tick(190, 1);
    tick(191, 2);
    expect(cell()).toHaveClass("motion-reduce:bg-transparent");
    advance(50);
    expect(cell()).toHaveClass("motion-reduce:transition-none");
  });
});
