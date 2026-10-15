import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { priceUpdate } from "@/test/fixtures";
import { Watchlist } from "./Watchlist";

const entries = [
  { ticker: "AAPL", price: 190, open_price: 188 },
  { ticker: "MSFT", price: null, open_price: null },
];

function renderWatchlist(overrides = {}) {
  const props = {
    entries,
    prices: { AAPL: priceUpdate({ price: 191.5 }) },
    history: {},
    selectedTicker: "AAPL",
    onSelect: vi.fn(),
    onAdd: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<Watchlist {...props} />);
  return props;
}

describe("Watchlist", () => {
  it("renders a row per entry with the streamed price", () => {
    renderWatchlist();
    expect(screen.getByTestId("watchlist-row-AAPL")).toBeInTheDocument();
    expect(screen.getByTestId("watchlist-price-AAPL")).toHaveTextContent("191.50");
    expect(screen.getByTestId("watchlist-price-MSFT")).toHaveTextContent("--");
  });

  it("adds an upper-cased ticker and clears the input", async () => {
    const props = renderWatchlist();
    await userEvent.type(screen.getByTestId("watchlist-add-input"), "pypl");
    await userEvent.click(screen.getByTestId("watchlist-add-button"));
    expect(props.onAdd).toHaveBeenCalledWith("PYPL");
    expect(screen.getByTestId("watchlist-add-input")).toHaveValue("");
  });

  it("shows the error when an add is rejected", async () => {
    renderWatchlist({ onAdd: vi.fn().mockRejectedValue(new Error("Unknown ticker: ZZZZ")) });
    await userEvent.type(screen.getByTestId("watchlist-add-input"), "ZZZZ");
    await userEvent.click(screen.getByTestId("watchlist-add-button"));
    expect(await screen.findByText("Unknown ticker: ZZZZ")).toBeInTheDocument();
  });

  it("removes without selecting the row", async () => {
    const props = renderWatchlist();
    await userEvent.click(screen.getByTestId("watchlist-remove-MSFT"));
    expect(props.onRemove).toHaveBeenCalledWith("MSFT");
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("selects a ticker on row click", async () => {
    const props = renderWatchlist();
    await userEvent.click(screen.getByTestId("watchlist-row-MSFT"));
    expect(props.onSelect).toHaveBeenCalledWith("MSFT");
  });
});
