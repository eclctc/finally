import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { priceUpdate } from "@/test/fixtures";
import { FlashingPrice } from "./FlashingPrice";

function priceCell() {
  return screen.getByTestId("watchlist-price-AAPL");
}

describe("FlashingPrice", () => {
  it("flashes green on an uptick", () => {
    render(<FlashingPrice update={priceUpdate({ direction: "up" })} fallbackPrice={null} testId="watchlist-price-AAPL" />);
    expect(priceCell()).toHaveClass("flash-up");
    expect(priceCell()).toHaveTextContent("190.00");
  });

  it("flashes red on a downtick", () => {
    render(<FlashingPrice update={priceUpdate({ direction: "down" })} fallbackPrice={null} testId="watchlist-price-AAPL" />);
    expect(priceCell()).toHaveClass("flash-down");
  });

  it("does not flash on a flat tick or before any tick", () => {
    const { rerender } = render(<FlashingPrice update={undefined} fallbackPrice={150} testId="watchlist-price-AAPL" />);
    expect(priceCell()).toHaveTextContent("150.00");
    expect(priceCell().className).not.toMatch(/flash/);
    rerender(<FlashingPrice update={priceUpdate({ direction: "flat" })} fallbackPrice={150} testId="watchlist-price-AAPL" />);
    expect(priceCell().className).not.toMatch(/flash/);
  });

  it("remounts the cell on each new tick so the animation replays", () => {
    const { rerender } = render(
      <FlashingPrice update={priceUpdate({ timestamp: 1 })} fallbackPrice={null} testId="watchlist-price-AAPL" />,
    );
    const firstCell = priceCell();
    rerender(<FlashingPrice update={priceUpdate({ timestamp: 2, price: 191 })} fallbackPrice={null} testId="watchlist-price-AAPL" />);
    expect(priceCell()).not.toBe(firstCell);
    expect(priceCell()).toHaveTextContent("191.00");
  });
});
