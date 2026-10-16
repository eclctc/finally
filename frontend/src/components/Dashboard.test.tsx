import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/Dashboard";
import { testIds } from "@/lib/testIds";
import { jsonResponse, makePortfolio, makePosition, makeTradeResponse } from "@/test/fixtures";
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

/** Fetch stub routed by "METHOD /path"; anything unmapped never resolves. */
const routeFetch = (routes: Record<string, (init?: RequestInit) => Response>) =>
  vi.fn((path: string, init?: RequestInit) => {
    const handler = routes[`${init?.method ?? "GET"} ${path}`];
    return handler ? Promise.resolve(handler(init)) : new Promise(() => {});
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

  it("names every panel as a region landmark", () => {
    render(<Dashboard />);
    for (const title of ["Watchlist", "Chart", "Trade", "Heatmap", "P&L", "Positions", "AI Chat"]) {
      expect(screen.getByRole("region", { name: title })).toBeInTheDocument();
    }
  });

  it("lays out the 1280px grid with fixed 320 / 224 / 320 columns", () => {
    const { container } = render(<Dashboard />);
    expect(container.firstElementChild).toHaveClass("min-w-[1280px]");
    const main = screen.getByRole("main");
    expect(main).toHaveClass("min-w-0", "grid-cols-[320px_minmax(0,1fr)]");
    expect(screen.getByRole("region", { name: "Trade" }).parentElement).toHaveClass(
      "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_224px]",
    );
    expect(screen.getByRole("complementary")).toHaveClass("w-[320px]");
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

  it("a Buy updates the header cash from the trade response", async () => {
    const fetchMock = routeFetch({
      "GET /api/portfolio": () => jsonResponse(makePortfolio(10000)),
      "POST /api/portfolio/trade": () =>
        jsonResponse(
          makeTradeResponse(
            { ticker: "MSFT", side: "buy", quantity: 2, price: 412.3 },
            makePortfolio(9175.4, [makePosition("MSFT", 2, 412.3, 412.3)]),
          ),
        ),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance)).toHaveTextContent("$10,000.00"));

    await user.type(screen.getByTestId(testIds.tradeTicker), "msft");
    await user.type(screen.getByTestId(testIds.tradeQuantity), "2");
    await user.click(screen.getByTestId(testIds.tradeBuy));

    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance)).toHaveTextContent("$9,175.40"));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({ ticker: "MSFT", side: "buy", quantity: 2 });
    expect(post[1]!.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/portfolio")).toHaveLength(1);
  });
});
