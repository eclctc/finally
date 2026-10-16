import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mergeFrame } from "@/lib/priceStore";
import { makeFrame, makeFrameEntry } from "@/test/fixtures";
import { MainChart, PriceTooltip } from "./MainChart";

const WAITING = "Waiting for price data.";
const CLOCK = /^\d{2}:\d{2}:\d{2}$/;

const tick = (ticker: string, price: number, timestamp: number, openPrice?: number) =>
  act(() => mergeFrame(makeFrame(makeFrameEntry(ticker, price, timestamp, openPrice))));

const tickMany = (count: number) => {
  for (let i = 0; i < count; i++) tick("AAPL", 190 + i / 1000, 1_700_000_000 + i, 190);
};

describe("MainChart", () => {
  it("waits for price data until the selected ticker has two points", () => {
    const { container, getByTestId, queryByText } = render(<MainChart selectedTicker="AAPL" />);
    expect(getByTestId("main-chart")).toHaveAttribute("data-ticker", "AAPL");
    expect(queryByText(WAITING)).not.toBeNull();
    tick("AAPL", 190, 1);
    expect(queryByText(WAITING)).not.toBeNull();
    tick("AAPL", 191, 2);
    expect(queryByText(WAITING)).toBeNull();
    expect(container.querySelectorAll("path.recharts-curve")).toHaveLength(1);
  });

  it("swaps to the new ticker's series and clears the selection", () => {
    tick("AAPL", 190, 1);
    tick("AAPL", 191, 2);
    const { container, getByTestId, queryByText, rerender } = render(<MainChart selectedTicker="AAPL" />);
    expect(container.querySelectorAll("path.recharts-curve")).toHaveLength(1);
    rerender(<MainChart selectedTicker="NVDA" />);
    expect(getByTestId("main-chart")).toHaveAttribute("data-ticker", "NVDA");
    expect(queryByText(WAITING)).not.toBeNull();
    rerender(<MainChart selectedTicker={null} />);
    expect(getByTestId("main-chart")).not.toHaveAttribute("data-ticker");
    expect(queryByText("Select a ticker from the watchlist.")).not.toBeNull();
  });

  it("shows the live price and the change vs session open in the caption", () => {
    tick("AAPL", 190.5, 1, 190);
    render(<MainChart selectedTicker="AAPL" />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("190.50")).toHaveClass("figures", "text-text");
    const change = screen.getByText("+0.26%");
    expect(change).toHaveAttribute("title", "Change vs session open");
    expect(change).toHaveClass("text-up");
  });

  it("shows -- for price and change when the ticker has no entry", () => {
    render(<MainChart selectedTicker="NVDA" />);
    expect(screen.getAllByText("--")).toHaveLength(2);
    expect(screen.getByTitle("Change vs session open")).toHaveClass("text-muted");
  });

  it("says Since page load below 1,200 points and Last 10 min at 1,200", () => {
    tickMany(1199);
    render(<MainChart selectedTicker="AAPL" />);
    expect(screen.getByText("Since page load")).toHaveClass("ml-auto", "text-[11px]", "text-muted");
    tick("AAPL", 191, 1_700_001_199, 190);
    expect(screen.getByText("Last 10 min")).toBeInTheDocument();
    expect(screen.queryByText("Since page load")).toBeNull();
  });

  it("draws the Open reference line and time and price ticks", () => {
    tick("AAPL", 190, 1_700_000_000, 189);
    tick("AAPL", 191, 1_700_000_060, 189);
    const { container } = render(<MainChart selectedTicker="AAPL" />);
    expect(screen.getByText("Open")).toBeInTheDocument();
    const ticks = Array.from(container.querySelectorAll(".recharts-cartesian-axis-tick-value")).map(
      (node) => node.textContent ?? "",
    );
    expect(ticks.some((text) => CLOCK.test(text))).toBe(true);
    expect(ticks.some((text) => /^\d+\.\d{2}$/.test(text))).toBe(true);
  });
});

describe("PriceTooltip", () => {
  const t = new Date(2026, 9, 16, 14, 32, 5).getTime();

  it("renders the clock time and the price in a bordered surface box", () => {
    const { container } = render(<PriceTooltip active payload={[{ payload: { t, price: 190.5 } }]} />);
    expect(screen.getByText("14:32:05")).toHaveClass("text-muted");
    expect(screen.getByText("190.50")).toHaveClass("figures", "text-text");
    expect(container.firstElementChild).toHaveClass("bg-surface", "border-line");
  });

  it.each([
    ["inactive", false, [{ payload: { t, price: 1 } }]],
    ["empty", true, []],
  ])("renders nothing when %s", (_label, active, payload) => {
    const { container } = render(<PriceTooltip active={active} payload={payload} />);
    expect(container).toBeEmptyDOMElement();
  });
});
