import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TradeBar } from "@/components/TradeBar";
import { mergeFrame } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";
import { jsonResponse, makeFrame, makeFrameEntry, makePortfolio, makePosition, makeTradeResponse } from "@/test/fixtures";

afterEach(() => vi.unstubAllGlobals());

const FILLED = makeTradeResponse(
  { ticker: "MSFT", side: "buy", quantity: 2, price: 412.3 },
  makePortfolio(9175.4, [makePosition("MSFT", 2, 412.3, 412.3)]),
);

const ticker = () => screen.getByTestId(testIds.tradeTicker) as HTMLInputElement;
const quantity = () => screen.getByTestId(testIds.tradeQuantity) as HTMLInputElement;
const buy = () => screen.getByTestId(testIds.tradeBuy);
const sell = () => screen.getByTestId(testIds.tradeSell);

type FetchMock = ReturnType<typeof vi.fn<(path: string, init?: RequestInit) => Promise<Response>>>;

function setup(fetchMock: FetchMock = vi.fn(async () => jsonResponse(FILLED))) {
  vi.stubGlobal("fetch", fetchMock);
  const onFilled = vi.fn();
  const user = userEvent.setup();
  render(<TradeBar onFilled={onFilled} />);
  return { fetchMock, onFilled, user };
}

const sentBody = (fetchMock: FetchMock) => JSON.parse(fetchMock.mock.calls[0][1]!.body as string);

describe("TradeBar enabled rule", () => {
  it("disables Buy and Sell while the ticker is empty or blank", async () => {
    const { user } = setup();
    await user.type(quantity(), "1");
    expect(buy()).toBeDisabled();
    expect(sell()).toBeDisabled();
    await user.type(ticker(), "  ");
    expect(buy()).toBeDisabled();
  });

  it.each(["", "0", "-1", "abc", "Infinity"])("keeps the buttons disabled for quantity %j", async (value) => {
    const { user } = setup();
    await user.type(ticker(), "MSFT");
    if (value) await user.type(quantity(), value);
    expect(buy()).toBeDisabled();
    expect(sell()).toBeDisabled();
  });

  it.each(["0.25", "1e3"])("enables the buttons for quantity %s", async (value) => {
    const { user } = setup();
    await user.type(ticker(), "MSFT");
    await user.type(quantity(), value);
    expect(buy()).toBeEnabled();
    expect(sell()).toBeEnabled();
  });

  it("uses a decimal text input for the quantity", () => {
    setup();
    expect(quantity()).toHaveAttribute("type", "text");
    expect(quantity()).toHaveAttribute("inputmode", "decimal");
  });
});

describe("TradeBar requests", () => {
  it("uppercases the ticker and sends a buy with a numeric quantity", async () => {
    const { fetchMock, user } = setup();
    await user.type(ticker(), " msft ");
    await user.type(quantity(), "0.25");
    expect(ticker().value).toBe(" MSFT ");
    await user.click(buy());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/portfolio/trade");
    expect(fetchMock.mock.calls[0][1]!.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(sentBody(fetchMock)).toEqual({ ticker: "MSFT", side: "buy", quantity: 0.25 });
  });

  it("sends side sell from the Sell button", async () => {
    const { fetchMock, user } = setup();
    await user.type(ticker(), "MSFT");
    await user.type(quantity(), "1");
    await user.click(sell());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody(fetchMock).side).toBe("sell");
  });

  it("sends exactly one POST for two clicks while the first is pending", async () => {
    const { fetchMock, user } = setup(vi.fn(() => new Promise<Response>(() => {})));
    await user.type(ticker(), "MSFT");
    await user.type(quantity(), "1");
    await user.click(buy());
    await user.click(buy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("locks both buttons and marks the group busy while in flight, keeping the labels", async () => {
    const { user } = setup(vi.fn(() => new Promise<Response>(() => {})));
    await user.type(ticker(), "MSFT");
    await user.type(quantity(), "1");
    await user.click(buy());
    const group = screen.getByRole("group", { name: "Trade order" });
    expect(group).toHaveAttribute("aria-busy", "true");
    expect(buy()).toBeDisabled();
    expect(sell()).toBeDisabled();
    expect(buy()).toHaveTextContent(/^Buy$/);
    expect(sell()).toHaveTextContent(/^Sell$/);
    expect(buy()).toHaveClass("disabled:opacity-50", "disabled:cursor-not-allowed");
  });

  it("sends nothing when Enter is pressed in either input", async () => {
    const { fetchMock, user } = setup();
    await user.type(ticker(), "MSFT{Enter}");
    await user.type(quantity(), "1{Enter}");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(buy()).toHaveAttribute("type", "button");
    expect(sell()).toHaveAttribute("type", "button");
    expect(screen.getByRole("group", { name: "Trade order" }).tagName).toBe("DIV");
  });
});

describe("TradeBar outcome", () => {
  it("clears the quantity, keeps the ticker, reports the fill from the response and focuses the quantity", async () => {
    const { onFilled, user } = setup();
    await user.type(ticker(), "msft");
    await user.type(quantity(), "5");
    await user.click(buy());
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Filled BUY 2 MSFT @ 412.30");
    expect(status).toHaveClass("text-muted", "break-words");
    expect(onFilled).toHaveBeenCalledTimes(1);
    expect(onFilled).toHaveBeenCalledWith(FILLED.portfolio);
    expect(quantity().value).toBe("");
    expect(ticker().value).toBe("MSFT");
    expect(quantity()).toHaveFocus();
  });

  it("shows the backend error verbatim, keeps both inputs and focuses the quantity", async () => {
    const message = "Insufficient shares: selling 1 TSLA, hold 0";
    const { onFilled, user } = setup(vi.fn(async () => jsonResponse({ error: message }, 400)));
    await user.type(ticker(), "TSLA");
    await user.type(quantity(), "1");
    await user.click(sell());
    const alert = await screen.findByRole("alert");
    expect(alert).toBe(screen.getByTestId(testIds.tradeError));
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveClass("text-down", "break-words");
    expect(onFilled).not.toHaveBeenCalled();
    expect(ticker().value).toBe("TSLA");
    expect(quantity().value).toBe("1");
    expect(quantity()).toHaveFocus();
  });

  it("shows Request failed (400) for an error response without a JSON error body", async () => {
    const response = { ok: false, status: 400, json: async () => Promise.reject(new Error("not json")) } as unknown as Response;
    const { user } = setup(vi.fn(async () => response));
    await user.type(ticker(), "MSFT");
    await user.type(quantity(), "1");
    await user.click(buy());
    expect(await screen.findByTestId(testIds.tradeError)).toHaveTextContent("Request failed (400)");
  });

  it("shows the network copy when the fetch rejects", async () => {
    const { user } = setup(vi.fn(() => Promise.reject(new Error("down"))));
    await user.type(ticker(), "MSFT");
    await user.type(quantity(), "1");
    await user.click(buy());
    expect(await screen.findByTestId(testIds.tradeError)).toHaveTextContent("Request failed. Try again.");
  });

  it("renders a hostile error body as literal text", async () => {
    const hostile = "<img src=x onerror=alert(1)>";
    const { user } = setup(vi.fn(async () => jsonResponse({ error: hostile }, 400)));
    await user.type(ticker(), "MSFT");
    await user.type(quantity(), "1");
    await user.click(buy());
    const alert = await screen.findByTestId(testIds.tradeError);
    expect(alert.textContent).toBe(hostile);
    expect(screen.getByRole("group", { name: "Trade order" }).querySelector("img")).toBeNull();
  });

  it("has no message element when idle and clears it when a new trade starts", async () => {
    const fetchMock: FetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Unknown ticker: ZZZZ" }, 400))
      .mockImplementationOnce(() => new Promise<Response>(() => {}));
    const { user } = setup(fetchMock);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    await user.type(ticker(), "ZZZZ");
    await user.type(quantity(), "1");
    await user.click(buy());
    await screen.findByRole("alert");
    await user.click(buy());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the message when either input is edited", async () => {
    const { user } = setup(vi.fn(async () => jsonResponse({ error: "Unknown ticker: ZZZZ" }, 400)));
    await user.type(ticker(), "ZZZZ");
    await user.type(quantity(), "1");
    await user.click(buy());
    await screen.findByRole("alert");
    await user.type(quantity(), "2");
    expect(screen.queryByRole("alert")).toBeNull();

    await user.click(buy());
    await screen.findByRole("alert");
    await user.type(ticker(), "X");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("TradeBar estimate", () => {
  const estimate = () => screen.getByText("Est. value").nextElementSibling!;

  it("shows -- without a live price or a valid quantity", async () => {
    const { user } = setup();
    expect(estimate()).toHaveTextContent(/^--$/);
    await user.type(ticker(), "MSFT");
    await user.type(quantity(), "2");
    expect(estimate()).toHaveTextContent(/^--$/);
  });

  it("shows quantity times the live price for the typed ticker", async () => {
    const { user } = setup();
    act(() => mergeFrame(makeFrame(makeFrameEntry("MSFT", 412.3, 2))));
    await user.type(ticker(), "MSFT");
    expect(estimate()).toHaveTextContent(/^--$/);
    await user.type(quantity(), "2");
    expect(estimate()).toHaveTextContent("$824.60");
    await user.clear(quantity());
    await user.type(quantity(), "abc");
    expect(estimate()).toHaveTextContent(/^--$/);
  });
});
