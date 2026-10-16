import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/Dashboard";
import { testIds } from "@/lib/testIds";
import type { FakeEventSource } from "../../vitest.setup";

const Fake = globalThis.EventSource as unknown as typeof FakeEventSource;

const unpricedEntry = (ticker: string) => ({
  ticker,
  price: null,
  previous_price: null,
  open_price: null,
  change: null,
  change_percent: null,
  direction: null,
  timestamp: null,
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});
afterEach(() => vi.unstubAllGlobals());

describe("Dashboard", () => {
  it("renders every panel heading", () => {
    render(<Dashboard />);
    for (const title of ["Watchlist", "Chart", "Trade", "Heatmap", "P&L", "Positions", "AI Chat"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
  });

  it("attaches the wrapper testids", () => {
    render(<Dashboard />);
    for (const id of [testIds.watchlist, testIds.heatmap, testIds.pnlChart, testIds.positionsTable, testIds.chatPanel]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it("attaches no watchlist row testids and no main chart testid yet", () => {
    const { container } = render(<Dashboard />);
    expect(container.querySelectorAll('[data-testid^="watchlist-row-"]')).toHaveLength(0);
    expect(screen.queryByTestId(testIds.mainChart)).toBeNull();
  });

  it("still renders the header figures", () => {
    render(<Dashboard />);
    expect(screen.getByTestId(testIds.cashBalance)).toBeInTheDocument();
    expect(screen.getByTestId(testIds.totalValue)).toBeInTheDocument();
  });

  it("streams a live price into its watchlist row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) =>
        path === "/api/watchlist"
          ? Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({ tickers: [unpricedEntry("AAPL"), unpricedEntry("MSFT")] }),
            })
          : new Promise(() => {}),
      ),
    );
    const { unmount } = render(<Dashboard />);
    const row = await screen.findByTestId(testIds.watchlistRow("AAPL"));
    expect(screen.getByTestId(testIds.watchlistPrice("AAPL"))).toHaveTextContent(/^--$/);
    expect(screen.getByTestId(testIds.watchlistPrice("MSFT"))).toHaveTextContent(/^--$/);
    expect(Fake.instances).toHaveLength(1);
    expect(Fake.instances[0].url).toBe("/api/stream/prices");

    const stream = Fake.instances[0];
    act(() => {
      stream.open();
      stream.emit({
        AAPL: {
          ticker: "AAPL",
          price: 190.5,
          previous_price: 190,
          open_price: 190,
          timestamp: 1,
          change: 0.5,
          change_percent: 9.99,
          direction: "up",
        },
      });
    });
    expect(screen.getByTestId(testIds.watchlistPrice("AAPL"))).toHaveTextContent(/^190\.50$/);
    expect(screen.getByTestId(testIds.watchlistPrice("MSFT"))).toHaveTextContent(/^--$/);
    expect(within(row).getByTitle("Change vs session open")).toHaveTextContent("+0.26%");

    unmount();
    expect(stream.readyState).toBe(2);
  });
});
