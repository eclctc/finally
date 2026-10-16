import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { testIds } from "@/lib/testIds";

const parseNumber = (text: string) => Number(text.replace(/[^0-9.-]/g, ""));

function stubPortfolio(body: { cash_balance: number; total_value: number }) {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("Header", () => {
  it("shows -- in both figures while the portfolio request is pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<Header />);
    expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("--");
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("--");
  });

  it("shows the fetched portfolio as bare currency figures after one request", async () => {
    const fetchMock = stubPortfolio({ cash_balance: 10000, total_value: 10000 });
    render(<Header />);
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$10,000.00"));
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("$10,000.00");
    expect(parseNumber(screen.getByTestId(testIds.cashBalance).textContent!)).toBe(10000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/portfolio", undefined);
  });

  it("puts cash and total value in the right elements", async () => {
    stubPortfolio({ cash_balance: 2500.5, total_value: 12345.678 });
    render(<Header />);
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$2,500.50"));
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("$12,345.68");
  });

  it("starts disconnected because Phase 1 opens no price stream", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<Header />);
    const dot = screen.getByTestId(testIds.connectionStatus);
    expect(dot).toHaveAttribute("data-status", "disconnected");
    expect(dot).toHaveAttribute("title", "Disconnected");
    expect(dot).toHaveAttribute("aria-label", "Disconnected");
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
    stubPortfolio({ cash_balance: 10000, total_value: 10000 });
    render(<Header />);
    expect(screen.queryByRole("alert")).toBeNull();
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$10,000.00"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
