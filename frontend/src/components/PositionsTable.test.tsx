import { act, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { PositionsTable } from "@/components/PositionsTable";
import { mergeFrame, resetPriceStore } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";
import { makeFrame, makeFrameEntry, makePortfolio, makePosition } from "@/test/fixtures";

beforeEach(() => resetPriceStore());

const renderTable = (positions = [makePosition("MSFT", 2.5, 400, 410)]) =>
  render(<PositionsTable portfolio={makePortfolio(1000, positions)} failed={false} />);

const rowIds = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-testid^="position-row-"]')].map((row) =>
    row.getAttribute("data-testid"),
  );

const cells = (ticker: string) => within(screen.getByTestId(testIds.positionRow(ticker))).getAllByRole("cell");

const tick = (ticker: string, price: number) =>
  act(() => mergeFrame(makeFrame(makeFrameEntry(ticker, price, 2))));

describe("PositionsTable states", () => {
  it("shows the muted loading line and no rows before the first load", () => {
    const { container } = render(<PositionsTable portfolio={null} failed={false} />);
    expect(screen.getByText("Loading positions...")).toHaveClass("text-muted");
    expect(rowIds(container)).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the fixed error alert when the first load failed", () => {
    const { container } = render(<PositionsTable portfolio={null} failed />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Positions unavailable. Reload the page to try again.");
    expect(alert).toHaveClass("text-down");
    expect(rowIds(container)).toHaveLength(0);
  });

  it("shows the empty block and no table with zero positions", () => {
    const { container } = renderTable([]);
    expect(screen.getByText("No positions")).toHaveClass("font-semibold", "text-text");
    expect(screen.getByText("Buy shares from the Trade panel to see them here.")).toHaveClass("text-muted");
    expect(screen.getByText("No positions").parentElement).toHaveClass("py-12", "text-center");
    expect(screen.queryByRole("table")).toBeNull();
    expect(rowIds(container)).toHaveLength(0);
  });
});

describe("PositionsTable columns", () => {
  it("renders the six sticky head cells with the two titles", () => {
    renderTable();
    const heads = screen.getAllByRole("columnheader");
    expect(heads.map((head) => head.textContent)).toEqual(["Ticker", "Qty", "Avg cost", "Price", "P&L", "P&L %"]);
    for (const head of heads) expect(head).toHaveClass("sticky", "bg-panel");
    expect(heads[4]).toHaveAttribute("title", "Unrealized P&L");
    expect(heads[5]).toHaveAttribute("title", "Unrealized P&L vs average cost");
  });

  it("uses the fixed table layout with a six column group", () => {
    const { container } = renderTable();
    expect(screen.getByRole("table")).toHaveClass("table-fixed", "border-separate", "border-spacing-0");
    expect(container.querySelectorAll("colgroup col")).toHaveLength(6);
  });

  it("sorts rows by ticker ascending", () => {
    const { container } = renderTable([
      makePosition("NVDA", 1, 100, 100),
      makePosition("AAPL", 1, 100, 100),
      makePosition("MSFT", 1, 100, 100),
    ]);
    expect(rowIds(container)).toEqual(["position-row-AAPL", "position-row-MSFT", "position-row-NVDA"]);
  });

  it("keeps the order while prices tick", () => {
    const { container } = renderTable([makePosition("NVDA", 1, 100, 100), makePosition("AAPL", 1, 100, 100)]);
    tick("NVDA", 500);
    tick("AAPL", 1);
    expect(rowIds(container)).toEqual(["position-row-AAPL", "position-row-NVDA"]);
  });
});

describe("PositionRow values", () => {
  it("falls back to the API price when the store has none", () => {
    renderTable();
    expect(cells("MSFT").map((cell) => cell.textContent)).toEqual([
      "MSFT",
      "2.5",
      "400.00",
      "410.00",
      "+$25.00",
      "+2.50%",
    ]);
    expect(cells("MSFT")[4]).toHaveClass("text-up");
    expect(cells("MSFT")[5]).toHaveClass("text-up");
  });

  it("revalues at the live price and ignores other tickers", () => {
    renderTable([makePosition("MSFT", 2.5, 400, 410), makePosition("AAPL", 1, 100, 100)]);
    tick("MSFT", 390);
    expect(cells("MSFT").map((cell) => cell.textContent)).toEqual([
      "MSFT",
      "2.5",
      "400.00",
      "390.00",
      "-$25.00",
      "-2.50%",
    ]);
    expect(cells("MSFT")[4]).toHaveClass("text-down");
    expect(cells("MSFT")[5]).toHaveClass("text-down");
    expect(cells("AAPL")[3]).toHaveTextContent("100.00");
  });

  it("shows zero P&L muted when the price equals the average cost", () => {
    renderTable([makePosition("MSFT", 1, 100, 105)]);
    tick("MSFT", 100);
    expect(cells("MSFT")[4]).toHaveTextContent(/^\$0\.00$/);
    expect(cells("MSFT")[5]).toHaveTextContent(/^0\.00%$/);
    expect(cells("MSFT")[4]).toHaveClass("text-muted");
    expect(cells("MSFT")[5]).toHaveClass("text-muted");
  });

  it("colors one cent either side of the average cost", () => {
    renderTable([makePosition("UP", 1, 100, 100), makePosition("DOWN", 1, 100, 100)]);
    tick("UP", 100.01);
    tick("DOWN", 99.99);
    expect(cells("UP")[4]).toHaveTextContent("+$0.01");
    expect(cells("UP")[4]).toHaveClass("text-up");
    expect(cells("DOWN")[4]).toHaveTextContent("-$0.01");
    expect(cells("DOWN")[4]).toHaveClass("text-down");
  });

  it("never shows the API unrealized P&L", () => {
    const position = { ...makePosition("MSFT", 1, 100, 110), unrealized_pnl: 999, pnl_percent: 777 };
    renderTable([position]);
    expect(screen.getByTestId(testIds.positionRow("MSFT"))).not.toHaveTextContent(/999|777/);
    expect(cells("MSFT")[4]).toHaveTextContent("+$10.00");
  });

  it("carries no flash, live region or click affordance", () => {
    const { container } = renderTable();
    expect(container.querySelector("[data-flash]")).toBeNull();
    expect(container.querySelector("[aria-live]")).toBeNull();
    expect(screen.getByTestId(testIds.positionRow("MSFT"))).not.toHaveClass("cursor-pointer");
  });

  it("renders a hostile ticker as text", () => {
    const { container } = renderTable([makePosition("<b>X</b>", 1, 100, 100)]);
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("<b>X</b>")).toBeInTheDocument();
  });
});
