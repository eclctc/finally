import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mergeFrame } from "@/lib/priceStore";
import { makeFrame, makeFrameEntry } from "@/test/fixtures";
import { MainChart } from "./MainChart";

const WAITING = "Waiting for price data.";

const tick = (ticker: string, price: number, timestamp: number) =>
  act(() => mergeFrame(makeFrame(makeFrameEntry(ticker, price, timestamp))));

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
});
