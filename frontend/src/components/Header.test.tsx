import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "./Header";

describe("Header", () => {
  it("shows total value, cash and connection status", () => {
    render(<Header totalValue={12345.6} cashBalance={10000} unrealizedPnl={-20} status="connected" />);
    expect(screen.getByTestId("total-value")).toHaveTextContent("$12,345.60");
    expect(screen.getByTestId("cash-balance")).toHaveTextContent("$10,000.00");
    expect(screen.getByTestId("connection-status")).toHaveAttribute("data-status", "connected");
  });

  it("shows placeholders before the portfolio loads", () => {
    render(<Header totalValue={null} cashBalance={null} unrealizedPnl={null} status="reconnecting" />);
    expect(screen.getByTestId("total-value")).toHaveTextContent("--");
    expect(screen.getByTestId("connection-status")).toHaveAttribute("data-status", "reconnecting");
  });
});
