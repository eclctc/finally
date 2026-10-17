import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/Dashboard";
import { getEntry, mergeFrame } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";
import {
  jsonResponse,
  makeChatReply,
  makeFailedTrade,
  makeFailedWatchlistChange,
  makeFrame,
  makeFrameEntry,
  makeOkTrade,
  makeOkWatchlistChange,
  makePortfolio,
  makePosition,
  makeSnapshot,
  makeTradeResponse,
  makeWatchlistEntry,
} from "@/test/fixtures";
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

  it("attaches no watchlist row testids and an unselected main chart while the watchlist loads", () => {
    const { container } = render(<Dashboard />);
    expect(container.querySelectorAll('[data-testid^="watchlist-row-"]')).toHaveLength(0);
    expect(screen.getByTestId(testIds.mainChart)).toBeInTheDocument();
    expect(screen.getByTestId(testIds.mainChart)).not.toHaveAttribute("data-ticker");
  });

  it("clicking a watchlist row selects it in the main chart and the trade bar", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        "GET /api/watchlist": () =>
          jsonResponse({ tickers: [makeWatchlistEntry("AAPL"), makeWatchlistEntry("NVDA")] }),
      }),
    );
    const user = userEvent.setup();
    render(<Dashboard />);
    await user.click(await screen.findByTestId(testIds.watchlistRow("NVDA")));

    expect(screen.getByTestId(testIds.mainChart)).toHaveAttribute("data-ticker", "NVDA");
    expect(screen.getByTestId(testIds.tradeTicker)).toHaveValue("NVDA");
    expect(screen.getByTestId(testIds.mainChart)).toHaveTextContent("NVDA");
  });

  it("selects the first watchlist ticker on a fresh load", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        "GET /api/watchlist": () =>
          jsonResponse({ tickers: [makeWatchlistEntry("AAPL"), makeWatchlistEntry("MSFT")] }),
      }),
    );
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId(testIds.mainChart)).toHaveAttribute("data-ticker", "AAPL"));
    await waitFor(() => expect(screen.getByTestId(testIds.tradeTicker)).toHaveValue("AAPL"));
  });

  it("the heatmap shows a held position as a labeled tile", async () => {
    vi.stubGlobal(
      "fetch",
      routeFetch({
        "GET /api/portfolio": () => jsonResponse(makePortfolio(7900, [makePosition("JPM", 10, 200, 210)])),
      }),
    );
    render(<Dashboard />);
    const heatmap = screen.getByTestId(testIds.heatmap);
    expect(await within(heatmap).findByText("JPM")).toBeInTheDocument();
    const firstRect = heatmap.querySelector("svg rect");
    expect(Number(firstRect?.getAttribute("width"))).toBeGreaterThan(0);
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
    await act(async () => {});
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

  it("a Buy adds a position row and a full Sell removes it", async () => {
    const responses = [
      makeTradeResponse(
        { ticker: "MSFT", side: "buy", quantity: 2, price: 410 },
        makePortfolio(9180, [makePosition("MSFT", 2, 410, 410)]),
      ),
      makeTradeResponse({ ticker: "MSFT", side: "sell", quantity: 2, price: 410 }, makePortfolio(10000)),
    ];
    vi.stubGlobal(
      "fetch",
      routeFetch({
        "GET /api/portfolio": () => jsonResponse(makePortfolio(10000)),
        "POST /api/portfolio/trade": () => jsonResponse(responses.shift()),
      }),
    );
    const user = userEvent.setup();
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance)).toHaveTextContent("$10,000.00"));

    await user.type(screen.getByTestId(testIds.tradeTicker), "MSFT");
    await user.type(screen.getByTestId(testIds.tradeQuantity), "2");
    await user.click(screen.getByTestId(testIds.tradeBuy));

    const row = await screen.findByTestId(testIds.positionRow("MSFT"));
    expect(row).toHaveTextContent("MSFT");
    expect(row).toHaveTextContent("2");
    expect(screen.getByTestId(testIds.positionsTable)).toHaveTextContent("MSFT");

    await user.type(screen.getByTestId(testIds.tradeQuantity), "2");
    await user.click(screen.getByTestId(testIds.tradeSell));
    await waitFor(() => expect(screen.queryByTestId(testIds.positionRow("MSFT"))).not.toBeInTheDocument());
  });

  it("a trade refreshes the P&L history and the chart draws a line", async () => {
    const fetchMock = routeFetch({
      "GET /api/portfolio": () => jsonResponse(makePortfolio(9790, [makePosition("JPM", 1, 210, 210)])),
      "GET /api/portfolio/history": () =>
        jsonResponse({ snapshots: [makeSnapshot(10000, "2026-10-16T21:00:00.000000+00:00")] }),
      "POST /api/portfolio/trade": () =>
        jsonResponse(
          makeTradeResponse(
            { ticker: "JPM", side: "buy", quantity: 1, price: 210 },
            makePortfolio(9580, [makePosition("JPM", 2, 210, 210)]),
          ),
        ),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<Dashboard />);
    const pnl = screen.getByTestId(testIds.pnlChart);
    await waitFor(() => expect(pnl.querySelectorAll("svg path.recharts-curve")).toHaveLength(1));

    await user.type(screen.getByTestId(testIds.tradeTicker), "JPM");
    await user.type(screen.getByTestId(testIds.tradeQuantity), "1");
    await user.click(screen.getByTestId(testIds.tradeBuy));

    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([path]) => path === "/api/portfolio/history")).toHaveLength(2),
    );
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/portfolio")).toHaveLength(1);
  });

  it("a chat buy shows the reply and its chip and adds the position row", async () => {
    const portfolios = [makePortfolio(10000), makePortfolio(9809.88, [makePosition("AAPL", 1, 190.1234, 190.1234)])];
    const fetchMock = routeFetch({
      "GET /api/portfolio": () => jsonResponse(portfolios.length > 1 ? portfolios.shift() : portfolios[0]),
      "GET /api/portfolio/history": () => jsonResponse({ snapshots: [] }),
      "POST /api/chat": () =>
        jsonResponse(makeChatReply("Done. Buying 1 share of AAPL.", [makeOkTrade("AAPL", "buy", 1, 190.1234)])),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const { container } = render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance)).toHaveTextContent("$10,000.00"));

    await user.type(screen.getByTestId(testIds.chatInput), "Please buy some Apple");
    await user.click(screen.getByTestId(testIds.chatSend));

    const assistant = await screen.findAllByText(/Done\. Buying 1 share of AAPL\./);
    expect(assistant).toHaveLength(1);
    const userMessages = container.querySelectorAll('[data-testid="chat-message"][data-role="user"]');
    expect(userMessages[userMessages.length - 1]).toHaveTextContent("Please buy some Apple");
    expect(container.querySelectorAll('[data-testid="chat-message"][data-role="assistant"]')).toHaveLength(1);
    const chips = screen.getAllByTestId(testIds.chatAction);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveAttribute("data-status", "ok");
    expect(chips[0]).toHaveTextContent("BUY 1 AAPL @ 190.12");
    expect(await screen.findByTestId(testIds.positionRow("AAPL"))).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([path, init]) => path === "/api/chat" && init?.method === "POST")!;
    expect(JSON.parse(post[1]!.body as string)).toEqual({ message: "Please buy some Apple" });
    expect(post[1]!.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/portfolio")).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/portfolio/history")).toHaveLength(2);
    expect(screen.getByTestId(testIds.chatInput)).toHaveValue("");
  });

  it("an AI buy highlights the new position row", async () => {
    const portfolios = [makePortfolio(10000), makePortfolio(9809.88, [makePosition("AAPL", 1, 190.1234, 190.1234)])];
    vi.stubGlobal(
      "fetch",
      routeFetch({
        "GET /api/watchlist": () => jsonResponse({ tickers: [makeWatchlistEntry("AAPL")] }),
        "GET /api/portfolio": () => jsonResponse(portfolios.length > 1 ? portfolios.shift() : portfolios[0]),
        "GET /api/portfolio/history": () => jsonResponse({ snapshots: [] }),
        "POST /api/chat": () =>
          jsonResponse(makeChatReply("Done. Buying 1 share of AAPL.", [makeOkTrade("AAPL", "buy", 1, 190.1234)])),
      }),
    );
    const user = userEvent.setup();
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance)).toHaveTextContent("$10,000.00"));

    await user.type(screen.getByTestId(testIds.chatInput), "Please buy some Apple");
    await user.click(screen.getByTestId(testIds.chatSend));

    await waitFor(() =>
      expect(screen.getByTestId(testIds.positionRow("AAPL"))).toHaveAttribute("data-ai-changed", "true"),
    );
  });

  it("an AI add shows the new watchlist row without a reload", async () => {
    const watchlists = [
      { tickers: [makeWatchlistEntry("AAPL")] },
      { tickers: [makeWatchlistEntry("AAPL"), makeWatchlistEntry("PYPL")] },
    ];
    const fetchMock = routeFetch({
      "GET /api/watchlist": () => jsonResponse(watchlists.length > 1 ? watchlists.shift() : watchlists[0]),
      "GET /api/portfolio": () => jsonResponse(makePortfolio(10000)),
      "GET /api/portfolio/history": () => jsonResponse({ snapshots: [] }),
      "POST /api/chat": () =>
        jsonResponse(makeChatReply("Added PYPL to your watchlist.", [makeOkWatchlistChange("PYPL", "add")])),
    });
    vi.stubGlobal("fetch", fetchMock);
    const watchlistGets = () => fetchMock.mock.calls.filter(([path]) => path === "/api/watchlist");
    const user = userEvent.setup();
    render(<Dashboard />);
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    expect(watchlistGets()).toHaveLength(1);

    await user.type(screen.getByTestId(testIds.chatInput), "Please add PayPal");
    await user.click(screen.getByTestId(testIds.chatSend));

    expect(await screen.findByTestId(testIds.watchlistRow("PYPL"))).toBeInTheDocument();
    expect(watchlistGets()).toHaveLength(2);
  });

  /** Chat reply stub: the watchlist reloads to `after`, the portfolio gains an AAPL position, history can fail on reload. */
  const stubAiReply = (
    reply: ReturnType<typeof makeChatReply>,
    { after = ["AAPL", "MSFT"], historyFailsAfterFirst = false } = {},
  ) => {
    const watchlists = [
      { tickers: [makeWatchlistEntry("AAPL"), makeWatchlistEntry("MSFT")] },
      { tickers: after.map((ticker) => makeWatchlistEntry(ticker)) },
    ];
    const portfolios = [makePortfolio(10000), makePortfolio(9810, [makePosition("AAPL", 1, 190, 190)])];
    let historyCalls = 0;
    const fetchMock = routeFetch({
      "GET /api/watchlist": () => jsonResponse(watchlists.length > 1 ? watchlists.shift() : watchlists[0]),
      "GET /api/portfolio": () => jsonResponse(portfolios.length > 1 ? portfolios.shift() : portfolios[0]),
      "GET /api/portfolio/history": () => {
        historyCalls += 1;
        return historyFailsAfterFirst && historyCalls > 1
          ? jsonResponse({ error: "boom" }, 500)
          : jsonResponse({ snapshots: [] });
      },
      "POST /api/chat": () => jsonResponse(reply),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  const sendChat = async (text: string) => {
    const user = userEvent.setup();
    render(<Dashboard />);
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance)).toHaveTextContent("$10,000.00"));
    await user.type(screen.getByTestId(testIds.chatInput), text);
    await user.click(screen.getByTestId(testIds.chatSend));
  };

  const getCount = (fetchMock: ReturnType<typeof stubAiReply>, path: string) =>
    fetchMock.mock.calls.filter(([called]) => called === path).length;
  const changedRows = () => document.body.querySelectorAll("[data-ai-changed]");

  it("an AI add plus buy highlights the new watchlist row and the position row, not the traded ticker's watchlist row", async () => {
    stubAiReply(
      makeChatReply("Added PYPL and bought AAPL.", [
        makeOkWatchlistChange("PYPL", "add"),
        makeOkTrade("AAPL", "buy", 1, 190),
      ]),
      { after: ["AAPL", "PYPL"] },
    );
    await sendChat("Add PayPal and buy Apple");

    await waitFor(() =>
      expect(screen.getByTestId(testIds.watchlistRow("PYPL"))).toHaveAttribute("data-ai-changed", "true"),
    );
    expect(screen.getByTestId(testIds.positionRow("AAPL"))).toHaveAttribute("data-ai-changed", "true");
    expect(screen.getByTestId(testIds.watchlistRow("AAPL"))).not.toHaveAttribute("data-ai-changed");
  });

  it("an ok add of an already watched ticker highlights the existing row", async () => {
    stubAiReply(makeChatReply("AAPL is already on your list.", [makeOkWatchlistChange("AAPL", "add")]));
    await sendChat("Add Apple");

    await waitFor(() =>
      expect(screen.getByTestId(testIds.watchlistRow("AAPL"))).toHaveAttribute("data-ai-changed", "true"),
    );
  });

  it("marks nothing when the history refresh fails", async () => {
    const fetchMock = stubAiReply(makeChatReply("Added PYPL.", [makeOkWatchlistChange("PYPL", "add")]), {
      after: ["AAPL", "PYPL"],
      historyFailsAfterFirst: true,
    });
    await sendChat("Add PayPal");

    await screen.findByTestId(testIds.watchlistRow("PYPL"));
    await waitFor(() => expect(getCount(fetchMock, "/api/portfolio/history")).toBe(2));
    await act(async () => {});
    expect(changedRows()).toHaveLength(0);
  });

  it.each([
    ["a failed add", makeChatReply("Could not add it.", [makeFailedWatchlistChange("ZZZZ", "add", "Unknown ticker")]), 1],
    ["an ok remove", makeChatReply("Removed MSFT.", [makeOkWatchlistChange("MSFT", "remove")]), 2],
  ])("%s highlights no row", async (_name, reply, historyCalls) => {
    const fetchMock = stubAiReply(reply);
    await sendChat("Change my list");

    await screen.findByText(reply.message);
    await waitFor(() => expect(getCount(fetchMock, "/api/portfolio/history")).toBe(historyCalls));
    await act(async () => {});
    expect(changedRows()).toHaveLength(0);
  });

  it("an AI remove clears the price store, drops the row and moves the chart to the first remaining ticker", async () => {
    const watchlists = [
      { tickers: [makeWatchlistEntry("AAPL"), makeWatchlistEntry("MSFT")] },
      { tickers: [makeWatchlistEntry("MSFT")] },
    ];
    vi.stubGlobal(
      "fetch",
      routeFetch({
        "GET /api/watchlist": () => jsonResponse(watchlists.length > 1 ? watchlists.shift() : watchlists[0]),
        "GET /api/portfolio": () => jsonResponse(makePortfolio(10000)),
        "GET /api/portfolio/history": () => jsonResponse({ snapshots: [] }),
        "POST /api/chat": () =>
          jsonResponse(makeChatReply("Removed AAPL.", [makeOkWatchlistChange("AAPL", "remove")])),
      }),
    );
    const user = userEvent.setup();
    render(<Dashboard />);
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    await waitFor(() => expect(screen.getByTestId(testIds.mainChart)).toHaveAttribute("data-ticker", "AAPL"));
    await act(async () => {});
    act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", 190, 1))));
    expect(getEntry("AAPL")).toBeDefined();

    await user.type(screen.getByTestId(testIds.chatInput), "Remove Apple");
    await user.click(screen.getByTestId(testIds.chatSend));

    await waitFor(() => expect(screen.queryByTestId(testIds.watchlistRow("AAPL"))).not.toBeInTheDocument());
    expect(getEntry("AAPL")).toBeUndefined();
    await waitFor(() => expect(screen.getByTestId(testIds.mainChart)).toHaveAttribute("data-ticker", "MSFT"));
  });

  it("a failed AI remove keeps the price store and reloads nothing", async () => {
    const fetchMock = routeFetch({
      "GET /api/watchlist": () =>
        jsonResponse({ tickers: [makeWatchlistEntry("AAPL"), makeWatchlistEntry("MSFT")] }),
      "GET /api/portfolio": () => jsonResponse(makePortfolio(10000)),
      "GET /api/portfolio/history": () => jsonResponse({ snapshots: [] }),
      "POST /api/chat": () =>
        jsonResponse(
          makeChatReply("I could not remove it.", [
            makeFailedWatchlistChange("AAPL", "remove", "AAPL is not on the watchlist"),
          ]),
        ),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<Dashboard />);
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    await act(async () => {});
    act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", 190, 1))));

    await user.type(screen.getByTestId(testIds.chatInput), "Remove Apple");
    await user.click(screen.getByTestId(testIds.chatSend));

    expect(await screen.findByText("I could not remove it.")).toBeInTheDocument();
    await act(async () => {});
    expect(getEntry("AAPL")).toBeDefined();
    expect(screen.getByTestId(testIds.watchlistRow("AAPL"))).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/watchlist")).toHaveLength(1);
  });

  it.each([
    ["zero actions", makeChatReply("Your portfolio is all cash.")],
    [
      "only failed actions",
      makeChatReply("I could not do that.", [
        makeFailedTrade("AAPL", "buy", 1, "Insufficient cash: need $190.12, have $0.00"),
      ]),
    ],
  ])("a reply with %s refetches nothing", async (_name, reply) => {
    const fetchMock = routeFetch({
      "GET /api/portfolio": () => jsonResponse(makePortfolio(10000)),
      "GET /api/portfolio/history": () => jsonResponse({ snapshots: [] }),
      "POST /api/chat": () => jsonResponse(reply),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId(testIds.cashBalance)).toHaveTextContent("$10,000.00"));

    await user.type(screen.getByTestId(testIds.chatInput), "How am I doing?");
    await user.click(screen.getByTestId(testIds.chatSend));

    expect(await screen.findByText(reply.message)).toBeInTheDocument();
    await act(async () => {});
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/portfolio")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/portfolio/history")).toHaveLength(1);
    for (const chip of screen.queryAllByTestId(testIds.chatAction)) {
      expect(chip).toHaveAttribute("data-status", "failed");
    }
    expect(screen.queryAllByTestId(testIds.chatAction)).toHaveLength(reply.actions.length);
  });
});
