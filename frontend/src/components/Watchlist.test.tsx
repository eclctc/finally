import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Watchlist } from "@/components/Watchlist";
import { mergeFrame } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";
import { jsonResponse, makeFrame, makeFrameEntry, makeWatchlistEntry } from "@/test/fixtures";

const LOAD_ERROR = "Watchlist unavailable. Reload the page to try again.";

const stubWatchlist = (...entries: ReturnType<typeof makeWatchlistEntry>[]) =>
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ tickers: entries }))));

const rows = (container: HTMLElement) => [...container.querySelectorAll('[data-testid^="watchlist-row-"]')];

const changeCell = (ticker: string) =>
  within(screen.getByTestId(testIds.watchlistRow(ticker))).getByTitle("Change vs session open");

const priceCell = (ticker: string) => screen.getByTestId(testIds.watchlistPrice(ticker));

const streamTick = (ticker: string, price: number, openPrice: number) =>
  act(() => mergeFrame(makeFrame(makeFrameEntry(ticker, price, 2, openPrice))));

afterEach(() => vi.unstubAllGlobals());

describe("Watchlist states", () => {
  it("shows the loading line and no rows while the request is pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { container } = render(<Watchlist />);
    expect(screen.getByText("Loading watchlist...")).toHaveClass("text-muted");
    expect(rows(container)).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Watchlist is empty")).toBeNull();
  });

  it("shows the fixed load-failed alert when the request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("socket hang up"))));
    const { container } = render(<Watchlist />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(LOAD_ERROR);
    expect(alert).toHaveClass("break-words", "text-down");
    expect(rows(container)).toHaveLength(0);
    expect(screen.queryByText("Loading watchlist...")).toBeNull();
    expect(screen.queryByText("socket hang up")).toBeNull();
  });

  it("shows the same alert, never the response body, on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ error: "boom" }, 500))));
    const { container } = render(<Watchlist />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(LOAD_ERROR);
    expect(alert).toHaveClass("break-words");
    expect(screen.queryByText(/boom/)).toBeNull();
    expect(rows(container)).toHaveLength(0);
  });

  it("shows the empty state for zero tickers", async () => {
    stubWatchlist();
    const { container } = render(<Watchlist />);
    const heading = await screen.findByText("Watchlist is empty");
    expect(heading).toHaveClass("font-semibold", "text-text");
    expect(screen.getByText("Enter a ticker above and press Add.")).toHaveClass("text-muted");
    expect(heading.parentElement).toHaveClass("py-12", "text-center");
    expect(rows(container)).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Watchlist rows", () => {
  it("lists rows in response order, one per REST ticker", async () => {
    stubWatchlist(makeWatchlistEntry("MSFT"), makeWatchlistEntry("AAPL"), makeWatchlistEntry("V"));
    const { container } = render(<Watchlist />);
    await screen.findByTestId(testIds.watchlistRow("MSFT"));
    expect(rows(container).map((row) => row.getAttribute("data-testid"))).toEqual([
      testIds.watchlistRow("MSFT"),
      testIds.watchlistRow("AAPL"),
      testIds.watchlistRow("V"),
    ]);
    expect(screen.getByRole("list", { name: "Watchlist tickers" })).toBeInTheDocument();
  });

  it("gives no row to a streamed ticker that is not watched", async () => {
    stubWatchlist(makeWatchlistEntry("MSFT"), makeWatchlistEntry("AAPL"), makeWatchlistEntry("V"));
    const { container } = render(<Watchlist />);
    await screen.findByTestId(testIds.watchlistRow("MSFT"));
    streamTick("TSLA", 250, 240);
    expect(screen.queryByTestId(testIds.watchlistRow("TSLA"))).toBeNull();
    expect(rows(container)).toHaveLength(3);
  });

  it("shows a REST price before any stream frame arrives", async () => {
    stubWatchlist(makeWatchlistEntry("AAPL", 190.5));
    render(<Watchlist />);
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    expect(priceCell("AAPL")).toHaveTextContent(/^190\.50$/);
  });

  it("renders a placeholder price and change for a REST entry without a price", async () => {
    stubWatchlist(makeWatchlistEntry("AAPL"));
    render(<Watchlist />);
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    expect(priceCell("AAPL")).toHaveTextContent(/^--$/);
    expect(changeCell("AAPL")).toHaveTextContent(/^--$/);
    expect(changeCell("AAPL")).toHaveClass("text-muted");
  });

  it("leaves other rows unchanged when a frame carries one ticker", async () => {
    stubWatchlist(makeWatchlistEntry("AAPL", 190.5), makeWatchlistEntry("MSFT", 410));
    render(<Watchlist />);
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    streamTick("AAPL", 191, 190);
    expect(priceCell("AAPL")).toHaveTextContent(/^191\.00$/);
    expect(priceCell("MSFT")).toHaveTextContent(/^410\.00$/);
  });

  it.each([1, 3])("uses the same h-7 row layout for %i ticker(s)", async (count) => {
    stubWatchlist(...["AAPL", "MSFT", "V"].slice(0, count).map((ticker) => makeWatchlistEntry(ticker)));
    const { container } = render(<Watchlist />);
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    expect(rows(container)).toHaveLength(count);
    for (const row of rows(container)) expect(row).toHaveClass("flex", "h-7", "items-center", "gap-1", "px-2");
  });
});

describe("Watchlist daily change", () => {
  const watchAapl = async () => {
    stubWatchlist(makeWatchlistEntry("AAPL"));
    render(<Watchlist />);
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
  };

  it("computes (price - open) / open on raw values, ignoring the per-tick change_percent", async () => {
    await watchAapl();
    act(() =>
      mergeFrame(makeFrame({ ...makeFrameEntry("AAPL", 110, 2, 100), change_percent: 0.5 })),
    );
    expect(changeCell("AAPL")).toHaveTextContent("+10.00%");
    expect(changeCell("AAPL")).toHaveClass("text-up");
    expect(changeCell("AAPL")).not.toHaveTextContent("0.50%");
  });

  it("shows a negative change one cent below the open in text-down", async () => {
    await watchAapl();
    streamTick("AAPL", 99.99, 100);
    expect(changeCell("AAPL").textContent).toMatch(/^-/);
    expect(changeCell("AAPL")).toHaveClass("text-down");
  });

  it("shows a positive change one cent above the open in text-up", async () => {
    await watchAapl();
    streamTick("AAPL", 100.01, 100);
    expect(changeCell("AAPL").textContent).toMatch(/^\+/);
    expect(changeCell("AAPL")).toHaveClass("text-up");
  });

  it("shows 0.00% in text-muted when the price equals the open", async () => {
    await watchAapl();
    streamTick("AAPL", 100, 100);
    expect(changeCell("AAPL")).toHaveTextContent(/^0\.00%$/);
    expect(changeCell("AAPL")).toHaveClass("text-muted");
  });
});
