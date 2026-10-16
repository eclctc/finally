import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { mergeFrame } from "@/lib/priceStore";
import { connectPriceStream, RECREATE_DELAY_MS } from "@/lib/priceStream";
import { testIds } from "@/lib/testIds";
import { jsonResponse, makeFrame, makeFrameEntry } from "@/test/fixtures";
import type { FakeEventSource } from "../../vitest.setup";

const Fake = globalThis.EventSource as unknown as typeof FakeEventSource;

const parseNumber = (text: string) => Number(text.replace(/[^0-9.-]/g, ""));

const AAPL_POSITION = {
  ticker: "AAPL",
  quantity: 10,
  avg_cost: 190,
  current_price: 984.5178,
  market_value: 9845.178,
  unrealized_pnl: 0,
  pnl_percent: 0,
};

function makePortfolio(cash: number, totalValue = cash, positions: object[] = []) {
  return { cash_balance: cash, total_value: totalValue, positions_value: 0, unrealized_pnl: 0, positions };
}

function stubPortfolio(body: ReturnType<typeof makePortfolio>) {
  const fetchMock = vi.fn(async () => jsonResponse(body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Header", () => {
  it("shows -- in both figures while the portfolio request is pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<Header />);
    expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("--");
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("--");
  });

  it("shows the fetched portfolio as bare currency figures after one request", async () => {
    const fetchMock = stubPortfolio(makePortfolio(10000));
    render(<Header />);
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$10,000.00"));
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("$10,000.00");
    expect(parseNumber(screen.getByTestId(testIds.cashBalance).textContent!)).toBe(10000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/portfolio", undefined);
  });

  it("revalues the total at live prices while cash stays the same", async () => {
    stubPortfolio(makePortfolio(2500.5, 12345.678, [AAPL_POSITION]));
    render(<Header />);
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$2,500.50"));
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("$12,345.68");

    act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", 1000, 2))));
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("$12,500.50");
    expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$2,500.50");
  });

  it("ignores the API total_value", async () => {
    stubPortfolio(makePortfolio(10000, 99999));
    render(<Header />);
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$10,000.00"));
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("$10,000.00");
  });

  it("never flashes the total or marks it as a live region", async () => {
    stubPortfolio(makePortfolio(2500.5, 12345.678, [AAPL_POSITION]));
    render(<Header />);
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$2,500.50"));
    act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", 1000, 2))));
    const total = screen.getByTestId(testIds.totalValue);
    expect(total).not.toHaveAttribute("data-flash");
    expect(total).not.toHaveAttribute("aria-live");
  });

  it("starts reconnecting", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<Header />);
    const dot = screen.getByRole("status");
    expect(dot).toBe(screen.getByTestId(testIds.connectionStatus));
    expect(dot).toHaveAttribute("data-status", "reconnecting");
    expect(dot).toHaveAttribute("title", "Reconnecting");
    expect(dot).toHaveTextContent("Reconnecting");
    expect(dot).toHaveClass("bg-accent");
    expect(dot).not.toHaveAttribute("aria-label");
  });

  it("follows the stream lifecycle", () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<Header />);
    const stopStream = connectPriceStream();
    const dot = screen.getByTestId(testIds.connectionStatus);
    const expectDot = (status: string, label: string, color: string) => {
      expect(dot).toHaveAttribute("data-status", status);
      expect(dot).toHaveAttribute("title", label);
      expect(dot).toHaveTextContent(label);
      expect(dot).toHaveClass(color);
    };

    act(() => Fake.instances[0].open());
    expectDot("connected", "Connected", "bg-up");
    act(() => Fake.instances[0].fail());
    expectDot("reconnecting", "Reconnecting", "bg-accent");
    act(() => Fake.instances[0].fail(true));
    expectDot("disconnected", "Disconnected", "bg-down");
    act(() => vi.advanceTimersByTime(RECREATE_DELAY_MS));
    expect(Fake.instances).toHaveLength(2);
    act(() => Fake.instances[1].open());
    expectDot("connected", "Connected", "bg-up");

    stopStream();
    vi.useRealTimers();
  });

  it("renders the wordmark as the only h1", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<Header />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("FinAlly");
    expect(screen.getByText("Ally")).toHaveClass("text-accent");
  });

  it("keeps the labels outside the figure elements", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<Header />);
    const total = screen.getByTestId(testIds.totalValue);
    const cash = screen.getByTestId(testIds.cashBalance);
    expect(screen.getByText("Portfolio value")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(total).not.toContainElement(screen.getByText("Portfolio value"));
    expect(cash).not.toContainElement(screen.getByText("Cash"));
  });

  it("keeps -- and shows a sibling alert when the portfolio request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("network down"))));
    render(<Header />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Portfolio unavailable. Reload the page to try again.");
    expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("--");
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("--");
  });

  it("shows no alert while loading or after success", async () => {
    stubPortfolio(makePortfolio(10000));
    render(<Header />);
    expect(screen.queryByRole("alert")).toBeNull();
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$10,000.00"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
