import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TradeBar } from "./TradeBar";

describe("TradeBar", () => {
  it("submits a buy with a numeric quantity", async () => {
    const onTrade = vi.fn().mockResolvedValue(undefined);
    render(<TradeBar ticker="AAPL" onTickerChange={vi.fn()} onTrade={onTrade} />);
    await userEvent.type(screen.getByTestId("trade-quantity"), "2.5");
    await userEvent.click(screen.getByTestId("trade-buy"));
    expect(onTrade).toHaveBeenCalledWith("AAPL", 2.5, "buy");
    expect(screen.queryByTestId("trade-error")).not.toBeInTheDocument();
  });

  it("shows the rejection reason", async () => {
    const onTrade = vi.fn().mockRejectedValue(new Error("Insufficient shares"));
    render(<TradeBar ticker="AAPL" onTickerChange={vi.fn()} onTrade={onTrade} />);
    await userEvent.type(screen.getByTestId("trade-quantity"), "5");
    await userEvent.click(screen.getByTestId("trade-sell"));
    expect(await screen.findByTestId("trade-error")).toHaveTextContent("Insufficient shares");
  });
});
