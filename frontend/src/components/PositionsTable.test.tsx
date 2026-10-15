import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { position } from "@/test/fixtures";
import { PositionsTable } from "./PositionsTable";

describe("PositionsTable", () => {
  it("renders a row per position with P&L", () => {
    render(<PositionsTable positions={[position(), position({ ticker: "TSLA", unrealized_pnl: -12.5, pnl_percent: -1.2 })]} onSelect={vi.fn()} />);
    expect(screen.getByTestId("position-row-AAPL")).toHaveTextContent("+$50.00");
    expect(screen.getByTestId("position-row-TSLA")).toHaveTextContent("-$12.50");
    expect(screen.getByTestId("position-row-TSLA")).toHaveTextContent("-1.20%");
  });

  it("shows an empty state", () => {
    render(<PositionsTable positions={[]} onSelect={vi.fn()} />);
    expect(screen.getByTestId("positions-table")).toHaveTextContent("No positions yet");
  });
});
