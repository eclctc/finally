import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Watchlist } from "@/components/Watchlist";
import { EMPTY_SERIES, getEntry, getSeries, mergeFrame } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";
import { jsonResponse, makeFrame, makeFrameEntry, makeWatchlistEntry } from "@/test/fixtures";

function WatchlistHarness() {
  const [selected, setSelected] = useState<string | null>(null);
  return <Watchlist selectedTicker={selected} onSelect={setSelected} />;
}

/** Renders the Watchlist inside a harness that holds the selectedTicker state. */
const renderWatchlist = () => render(<WatchlistHarness />);

const LOAD_ERROR = "Watchlist unavailable. Reload the page to try again.";

const stubWatchlist = (...entries: ReturnType<typeof makeWatchlistEntry>[]) =>
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ tickers: entries }))));

const rows = (container: HTMLElement) => [...container.querySelectorAll('[data-testid^="watchlist-row-"]')];

const changeCell = (ticker: string) =>
  within(screen.getByTestId(testIds.watchlistRow(ticker))).getByTitle("Change vs session open");

const priceCell = (ticker: string) => screen.getByTestId(testIds.watchlistPrice(ticker));

/** Flushes the freshly committed rows' store subscriptions, then streams one tick. */
const settleSubscriptions = () => act(async () => {});

const streamTick = async (ticker: string, price: number, openPrice: number) => {
  await settleSubscriptions();
  act(() => mergeFrame(makeFrame(makeFrameEntry(ticker, price, 2, openPrice))));
};

afterEach(() => vi.unstubAllGlobals());

describe("Watchlist states", () => {
  it("shows the loading line and no rows while the request is pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { container } = renderWatchlist();
    expect(screen.getByText("Loading watchlist...")).toHaveClass("text-muted");
    expect(rows(container)).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Watchlist is empty")).toBeNull();
  });

  it("shows the fixed load-failed alert when the request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("socket hang up"))));
    const { container } = renderWatchlist();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(LOAD_ERROR);
    expect(alert).toHaveClass("break-words", "text-down");
    expect(rows(container)).toHaveLength(0);
    expect(screen.queryByText("Loading watchlist...")).toBeNull();
    expect(screen.queryByText("socket hang up")).toBeNull();
  });

  it("shows the same alert, never the response body, on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse({ error: "boom" }, 500))));
    const { container } = renderWatchlist();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(LOAD_ERROR);
    expect(alert).toHaveClass("break-words");
    expect(screen.queryByText(/boom/)).toBeNull();
    expect(rows(container)).toHaveLength(0);
  });

  it("shows the empty state for zero tickers", async () => {
    stubWatchlist();
    const { container } = renderWatchlist();
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
    const { container } = renderWatchlist();
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
    const { container } = renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("MSFT"));
    await streamTick("TSLA", 250, 240);
    expect(screen.queryByTestId(testIds.watchlistRow("TSLA"))).toBeNull();
    expect(rows(container)).toHaveLength(3);
  });

  it("shows a REST price before any stream frame arrives", async () => {
    stubWatchlist(makeWatchlistEntry("AAPL", 190.5));
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    expect(priceCell("AAPL")).toHaveTextContent(/^190\.50$/);
  });

  it("renders a placeholder price and change for a REST entry without a price", async () => {
    stubWatchlist(makeWatchlistEntry("AAPL"));
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    expect(priceCell("AAPL")).toHaveTextContent(/^--$/);
    expect(changeCell("AAPL")).toHaveTextContent(/^--$/);
    expect(changeCell("AAPL")).toHaveClass("text-muted");
  });

  it("leaves other rows unchanged when a frame carries one ticker", async () => {
    stubWatchlist(makeWatchlistEntry("AAPL", 190.5), makeWatchlistEntry("MSFT", 410));
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    await streamTick("AAPL", 191, 190);
    expect(priceCell("AAPL")).toHaveTextContent(/^191\.00$/);
    expect(priceCell("MSFT")).toHaveTextContent(/^410\.00$/);
  });

  it.each([1, 3])("uses the same h-7 row layout for %i ticker(s)", async (count) => {
    stubWatchlist(...["AAPL", "MSFT", "V"].slice(0, count).map((ticker) => makeWatchlistEntry(ticker)));
    const { container } = renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    expect(rows(container)).toHaveLength(count);
    for (const row of rows(container)) expect(row).toHaveClass("flex", "h-7", "items-center", "gap-1", "px-2");
  });
});

describe("Watchlist daily change", () => {
  const watchAapl = async () => {
    stubWatchlist(makeWatchlistEntry("AAPL"));
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
  };

  it("computes (price - open) / open on raw values, ignoring the per-tick change_percent", async () => {
    await watchAapl();
    await settleSubscriptions();
    act(() =>
      mergeFrame(makeFrame({ ...makeFrameEntry("AAPL", 110, 2, 100), change_percent: 0.5 })),
    );
    expect(changeCell("AAPL")).toHaveTextContent("+10.00%");
    expect(changeCell("AAPL")).toHaveClass("text-up");
    expect(changeCell("AAPL")).not.toHaveTextContent("0.50%");
  });

  it("shows a negative change one cent below the open in text-down", async () => {
    await watchAapl();
    await streamTick("AAPL", 99.99, 100);
    expect(changeCell("AAPL").textContent).toMatch(/^-/);
    expect(changeCell("AAPL")).toHaveClass("text-down");
  });

  it("shows a positive change one cent above the open in text-up", async () => {
    await watchAapl();
    await streamTick("AAPL", 100.01, 100);
    expect(changeCell("AAPL").textContent).toMatch(/^\+/);
    expect(changeCell("AAPL")).toHaveClass("text-up");
  });

  it("shows 0.00% in text-muted when the price equals the open", async () => {
    await watchAapl();
    await streamTick("AAPL", 100, 100);
    expect(changeCell("AAPL")).toHaveTextContent(/^0\.00%$/);
    expect(changeCell("AAPL")).toHaveClass("text-muted");
  });
});

type WatchlistEntry = ReturnType<typeof makeWatchlistEntry>;
type PostHandler = (ticker: string) => Promise<Response>;

const POST_INIT = (ticker: string) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ticker }),
});

/**
 * Fetch stub: GET /api/watchlist serves the mutable list; POST and DELETE run their handlers
 * (defaults: add the ticker, drop the ticker).
 */
const stubApi = (list: WatchlistEntry[], onPost?: PostHandler, onDelete?: PostHandler) => {
  const addToList: PostHandler = (ticker) => {
    list.push(makeWatchlistEntry(ticker));
    return Promise.resolve(jsonResponse({ ticker }));
  };
  const dropFromList: PostHandler = (ticker) => {
    list.splice(list.findIndex((entry) => entry.ticker === ticker), 1);
    return Promise.resolve(jsonResponse({ ticker }));
  };
  const fetchMock = vi.fn((path: string, init?: RequestInit) => {
    if (init?.method === "POST") return (onPost ?? addToList)(JSON.parse(init.body as string).ticker);
    if (init?.method === "DELETE") return (onDelete ?? dropFromList)(decodeURIComponent(path.split("/").pop()!));
    return Promise.resolve(jsonResponse({ tickers: list }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const postCalls = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

const addInput = () => screen.getByTestId(testIds.watchlistAddInput) as HTMLInputElement;
const addButton = () => screen.getByTestId(testIds.watchlistAddButton);
const scrollMock = () => window.HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>;

describe("Watchlist add form", () => {
  it("uppercases typed text, posts the trimmed ticker and shows the new row", async () => {
    const fetchMock = stubApi([makeWatchlistEntry("AAPL")]);
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    scrollMock().mockClear();
    const user = userEvent.setup();
    await user.type(addInput(), " dis ");
    expect(addInput()).toHaveValue(" DIS ");
    await user.click(addButton());
    const row = await screen.findByTestId(testIds.watchlistRow("DIS"));
    expect(fetchMock).toHaveBeenCalledWith("/api/watchlist", POST_INIT("DIS"));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/watchlist", undefined);
    expect(addInput()).toHaveValue("");
    expect(addInput()).toHaveFocus();
    expect(scrollMock()).toHaveBeenCalledWith({ block: "nearest" });
    expect(scrollMock().mock.contexts).toEqual([row]);
  });

  it("submits on Enter the same way", async () => {
    const fetchMock = stubApi([makeWatchlistEntry("AAPL")]);
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    const user = userEvent.setup();
    await user.type(addInput(), "dis{Enter}");
    await screen.findByTestId(testIds.watchlistRow("DIS"));
    expect(postCalls(fetchMock)).toEqual([["/api/watchlist", POST_INIT("DIS")]]);
  });

  it("scrolls once per add, not on later list reloads", async () => {
    stubApi([makeWatchlistEntry("AAPL")]);
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    scrollMock().mockClear();
    const user = userEvent.setup();
    await user.type(addInput(), "dis{Enter}");
    const dis = await screen.findByTestId(testIds.watchlistRow("DIS"));
    await user.type(addInput(), "v{Enter}");
    const v = await screen.findByTestId(testIds.watchlistRow("V"));
    expect(scrollMock().mock.contexts).toEqual([dis, v]);
  });

  it("disables Add for whitespace-only input and sends nothing on Enter", async () => {
    const fetchMock = stubApi([makeWatchlistEntry("AAPL")]);
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    const user = userEvent.setup();
    expect(addButton()).toBeDisabled();
    await user.type(addInput(), "   {Enter}");
    expect(addButton()).toBeDisabled();
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  it("keeps Add disabled and labelled Add while a POST is pending, and sends one POST", async () => {
    const fetchMock = stubApi([makeWatchlistEntry("AAPL")], () => new Promise(() => {}));
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    const user = userEvent.setup();
    await user.type(addInput(), "dis{Enter}");
    await user.keyboard("{Enter}");
    expect(addButton()).toBeDisabled();
    expect(addButton()).toHaveTextContent(/^Add$/);
    expect(addButton()).toHaveClass("disabled:opacity-50", "disabled:cursor-not-allowed");
    expect(postCalls(fetchMock)).toHaveLength(1);
  });

  it("shows a 400 error inline, keeps the text and flags the input until the next keystroke", async () => {
    stubApi([makeWatchlistEntry("AAPL")], () =>
      Promise.resolve(jsonResponse({ error: "Invalid ticker: 'TOOLONGX'" }, 400)),
    );
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    const user = userEvent.setup();
    await user.type(addInput(), "toolongx{Enter}");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid ticker: 'TOOLONGX'");
    expect(alert).toHaveClass("break-words", "text-down");
    expect(addInput()).toHaveValue("TOOLONGX");
    expect(addInput()).toHaveAttribute("aria-invalid", "true");
    expect(addInput()).toHaveAttribute("aria-describedby", alert.id);
    expect(addInput()).toHaveClass("border-down");
    expect(addInput()).toHaveFocus();
    await user.type(addInput(), "Y");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(addInput()).not.toHaveAttribute("aria-invalid");
    expect(addInput()).not.toHaveAttribute("aria-describedby");
  });

  it("renders a hostile error body as literal text, never as markup", async () => {
    const payload = "<img src=x onerror=alert(1)>";
    stubApi([makeWatchlistEntry("AAPL")], () => Promise.resolve(jsonResponse({ error: payload }, 400)));
    const { container } = renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    const user = userEvent.setup();
    await user.type(addInput(), "x{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(payload);
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the fixed network-failure copy when the POST rejects", async () => {
    stubApi([makeWatchlistEntry("AAPL")], () => Promise.reject(new TypeError("Failed to fetch")));
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    const user = userEvent.setup();
    await user.type(addInput(), "dis{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Request failed. Try again.");
  });

  it("keeps a loaded list when the reload after an add fails", async () => {
    let gets = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_path: string, init?: RequestInit) => {
        if (init?.method === "POST") return Promise.resolve(jsonResponse({ ticker: "DIS" }));
        return ++gets === 1 ? Promise.resolve(jsonResponse({ tickers: [makeWatchlistEntry("AAPL")] })) : Promise.reject(new Error("down"));
      }),
    );
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    await userEvent.setup().type(addInput(), "dis{Enter}");
    await waitFor(() => expect(gets).toBe(2));
    await waitFor(() => expect(addButton()).toBeDisabled());
    expect(screen.getByTestId(testIds.watchlistRow("AAPL"))).toBeInTheDocument();
    expect(screen.queryByText(LOAD_ERROR)).toBeNull();
  });

  it("ignores an older reload that resolves after a newer one", async () => {
    let resolveStale: (response: Response) => void = () => {};
    let gets = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_path: string, init?: RequestInit) => {
        if (init?.method) return Promise.resolve(jsonResponse({ ticker: "x" }));
        gets += 1;
        if (gets === 1) return Promise.resolve(jsonResponse({ tickers: [makeWatchlistEntry("AAPL")] }));
        if (gets === 2) return new Promise<Response>((resolve) => (resolveStale = resolve));
        return Promise.resolve(jsonResponse({ tickers: [makeWatchlistEntry("DIS")] }));
      }),
    );
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    const user = userEvent.setup();
    await user.type(addInput(), "dis{Enter}");
    await waitFor(() => expect(gets).toBe(2));
    await user.click(screen.getByTestId(testIds.watchlistRemove("AAPL")));
    await screen.findByTestId(testIds.watchlistRow("DIS"));
    await act(async () => resolveStale(jsonResponse({ tickers: [makeWatchlistEntry("AAPL")] })));
    expect(screen.getByTestId(testIds.watchlistRow("DIS"))).toBeInTheDocument();
    expect(screen.queryByTestId(testIds.watchlistRow("AAPL"))).toBeNull();
  });

  it("keeps the form visible while loading, load-failed, empty and populated", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const loading = renderWatchlist();
    expect(addInput()).toBeInTheDocument();
    loading.unmount();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    const failed = renderWatchlist();
    await screen.findByRole("alert");
    expect(addInput()).toBeInTheDocument();
    failed.unmount();
    stubWatchlist();
    const empty = renderWatchlist();
    await screen.findByText("Watchlist is empty");
    expect(addInput()).toBeInTheDocument();
    empty.unmount();
    stubWatchlist(makeWatchlistEntry("AAPL"));
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    expect(addInput()).toBeInTheDocument();
  });

  it("puts no length limit on the input so the backend validator decides", () => {
    stubWatchlist();
    renderWatchlist();
    expect(addInput()).not.toHaveAttribute("maxlength");
    expect(addInput()).toHaveAttribute("placeholder", "Ticker");
    expect(addInput()).toHaveAttribute("aria-label", "Ticker to add");
    expect(addButton()).toHaveClass("bg-submit");
  });

  it("keeps a streamed price and its history across the reload an add triggers", async () => {
    const list = [makeWatchlistEntry("AAPL", 190)];
    stubApi(list);
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    await streamTick("AAPL", 200, 190);
    const historyLength = getSeries("AAPL").length;
    const user = userEvent.setup();
    await user.type(addInput(), "dis{Enter}");
    await screen.findByTestId(testIds.watchlistRow("DIS"));
    expect(priceCell("AAPL")).toHaveTextContent(/^200\.00$/);
    expect(getSeries("AAPL")).toHaveLength(historyLength);
  });
});

describe("Watchlist remove", () => {
  const removeButton = (ticker: string) => screen.getByTestId(testIds.watchlistRemove(ticker));

  const watchApiList = async (
    onDelete?: PostHandler,
    list = [makeWatchlistEntry("AAPL", 190), makeWatchlistEntry("MSFT", 410)],
  ) => {
    const fetchMock = stubApi(list, undefined, onDelete);
    renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow("AAPL"));
    fetchMock.mockClear();
    return fetchMock;
  };

  it("gives each row a labelled x button as its last cell", async () => {
    await watchApiList();
    const button = removeButton("AAPL");
    expect(button).toHaveTextContent(/^×$/);
    expect(button).toHaveAttribute("aria-label", "Remove AAPL");
    expect(button).toHaveAttribute("title", "Remove AAPL");
    expect(button).toHaveClass("size-6", "text-muted", "hover:text-down");
  });

  it("deletes, reloads, then drops the row, its store entry and history, and focuses the input", async () => {
    const fetchMock = await watchApiList();
    await streamTick("AAPL", 191, 190);
    await userEvent.setup().click(removeButton("AAPL"));
    await waitFor(() => expect(screen.queryByTestId(testIds.watchlistRow("AAPL"))).toBeNull());
    expect(fetchMock.mock.calls).toEqual([
      ["/api/watchlist/AAPL", { method: "DELETE" }],
      ["/api/watchlist", undefined],
    ]);
    expect(screen.getByTestId(testIds.watchlistRow("MSFT"))).toBeInTheDocument();
    expect(getEntry("AAPL")).toBeUndefined();
    expect(getSeries("AAPL")).toBe(EMPTY_SERIES);
    expect(addInput()).toHaveFocus();
  });

  it("disables the x with opacity while its DELETE is pending and sends one DELETE", async () => {
    const fetchMock = await watchApiList(() => new Promise(() => {}));
    const user = userEvent.setup();
    await user.click(removeButton("AAPL"));
    await user.click(removeButton("AAPL"));
    expect(removeButton("AAPL")).toBeDisabled();
    expect(removeButton("AAPL")).toHaveClass("disabled:opacity-50");
    expect(removeButton("MSFT")).toBeEnabled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE")).toHaveLength(1);
  });

  it("treats a 404 as already removed: no alert, and the reload drops the row", async () => {
    const list = [makeWatchlistEntry("AAPL", 190), makeWatchlistEntry("MSFT", 410)];
    await watchApiList((ticker) => {
      list.splice(list.findIndex((entry) => entry.ticker === ticker), 1);
      return Promise.resolve(jsonResponse({ error: `${ticker} is not on the watchlist` }, 404));
    }, list);
    await userEvent.setup().click(removeButton("AAPL"));
    await waitFor(() => expect(screen.queryByTestId(testIds.watchlistRow("AAPL"))).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getEntry("AAPL")).toBeUndefined();
  });

  it("shows another failure in the add-error slot and keeps the row", async () => {
    await watchApiList(() => Promise.resolve(jsonResponse({ error: "Market data unavailable, try again" }, 500)));
    await userEvent.setup().click(removeButton("AAPL"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Market data unavailable, try again");
    expect(screen.getByTestId(testIds.watchlistRow("AAPL"))).toBeInTheDocument();
    expect(removeButton("AAPL")).toBeEnabled();
  });

  it("shows the network-failure copy when the DELETE rejects", async () => {
    await watchApiList(() => Promise.reject(new TypeError("Failed to fetch")));
    await userEvent.setup().click(removeButton("AAPL"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Request failed. Try again.");
  });

  it("encodes the ticker in the DELETE path", async () => {
    const fetchMock = await watchApiList(undefined, [
      makeWatchlistEntry("AAPL", 190),
      makeWatchlistEntry("A/B", 10),
    ]);
    await userEvent.setup().click(removeButton("A/B"));
    await waitFor(() => expect(screen.queryByTestId(testIds.watchlistRow("A/B"))).toBeNull());
    expect(fetchMock.mock.calls[0]).toEqual(["/api/watchlist/A%2FB", { method: "DELETE" }]);
  });

  it("does not scroll again after a remove reloads the list", async () => {
    await watchApiList();
    const user = userEvent.setup();
    await user.type(addInput(), "dis{Enter}");
    await screen.findByTestId(testIds.watchlistRow("DIS"));
    scrollMock().mockClear();
    await user.click(removeButton("MSFT"));
    await waitFor(() => expect(screen.queryByTestId(testIds.watchlistRow("MSFT"))).toBeNull());
    expect(scrollMock()).not.toHaveBeenCalled();
  });

  it("orders the row cells ticker, price, change, sparkline, remove", async () => {
    await watchApiList();
    await streamTick("AAPL", 195, 190);
    const cells = [...screen.getByTestId(testIds.watchlistRow("AAPL")).children];
    expect(cells).toHaveLength(5);
    expect(cells[0]).toHaveTextContent(/^AAPL$/);
    expect(cells[1]).toBe(priceCell("AAPL"));
    expect(cells[1]).toHaveAttribute("data-flash", "up");
    expect(cells[2]).toBe(changeCell("AAPL"));
    expect(cells[3]).toHaveAttribute("title", "Since page load");
    expect(cells[4]).toBe(removeButton("AAPL"));
  });
});

describe("Watchlist selection", () => {
  const li = (ticker: string) => screen.getByTestId(testIds.watchlistRow(ticker));
  const tickerSpan = (ticker: string) => within(li(ticker)).getByText(ticker);
  const removeX = (ticker: string) => screen.getByTestId(testIds.watchlistRemove(ticker));

  const watch = async (...tickers: string[]) => {
    const fetchMock = stubApi(tickers.map((ticker) => makeWatchlistEntry(ticker, 100)));
    const view = renderWatchlist();
    await screen.findByTestId(testIds.watchlistRow(tickers[0]));
    return { fetchMock, ...view };
  };

  it("selects the first ticker by default and no other", async () => {
    await watch("MSFT", "AAPL");
    await waitFor(() => expect(li("MSFT")).toHaveAttribute("aria-current", "true"));
    expect(li("AAPL")).not.toHaveAttribute("aria-current");
  });

  it("moves the selection and its styles on click", async () => {
    await watch("MSFT", "AAPL");
    await userEvent.setup().click(li("AAPL"));
    expect(li("AAPL")).toHaveAttribute("aria-current", "true");
    expect(li("AAPL")).toHaveClass("bg-surface", "cursor-pointer");
    expect(tickerSpan("AAPL")).toHaveClass("text-accent", "font-semibold");
    expect(li("MSFT")).not.toHaveAttribute("aria-current");
    expect(li("MSFT")).toHaveClass("hover:bg-surface/60", "cursor-pointer");
    expect(tickerSpan("MSFT")).toHaveClass("text-text");
    expect(tickerSpan("MSFT")).not.toHaveClass("text-accent");
  });

  it("makes every row focusable and selects on Enter and Space", async () => {
    await watch("MSFT", "AAPL", "V");
    expect(li("V")).toHaveAttribute("tabindex", "0");
    const user = userEvent.setup();
    li("AAPL").focus();
    await user.keyboard("{Enter}");
    expect(li("AAPL")).toHaveAttribute("aria-current", "true");
    li("V").focus();
    await user.keyboard(" ");
    expect(li("V")).toHaveAttribute("aria-current", "true");
  });

  it("does not select when a key is pressed on the x button", async () => {
    await watch("MSFT", "AAPL");
    removeX("AAPL").focus();
    fireEvent.keyDown(removeX("AAPL"), { key: "Enter" });
    expect(li("AAPL")).not.toHaveAttribute("aria-current");
  });

  it("removes an unselected row with the x and keeps the selection", async () => {
    await watch("MSFT", "AAPL");
    await userEvent.setup().click(removeX("AAPL"));
    await waitFor(() => expect(screen.queryByTestId(testIds.watchlistRow("AAPL"))).toBeNull());
    expect(li("MSFT")).toHaveAttribute("aria-current", "true");
  });

  it("falls back to the first remaining ticker when the selected one is removed", async () => {
    await watch("MSFT", "AAPL", "V");
    const user = userEvent.setup();
    await user.click(li("AAPL"));
    await user.click(removeX("AAPL"));
    await waitFor(() => expect(screen.queryByTestId(testIds.watchlistRow("AAPL"))).toBeNull());
    await waitFor(() => expect(li("MSFT")).toHaveAttribute("aria-current", "true"));
  });

  it("leaves no selection after the last row is removed", async () => {
    await watch("AAPL");
    await userEvent.setup().click(removeX("AAPL"));
    await waitFor(() => expect(screen.queryByTestId(testIds.watchlistRow("AAPL"))).toBeNull());
    expect(document.querySelector("[aria-current]")).toBeNull();
  });

  it("shows a change of +0.004% as 0.00% in text-muted", async () => {
    await watch("AAPL");
    await streamTick("AAPL", 190.0076, 190);
    expect(changeCell("AAPL")).toHaveTextContent(/^0\.00%$/);
    expect(changeCell("AAPL")).toHaveClass("text-muted");
  });
});
