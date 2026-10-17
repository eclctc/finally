import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWatchlist } from "@/lib/useWatchlist";
import { jsonResponse, makeWatchlistEntry } from "@/test/fixtures";

afterEach(() => vi.unstubAllGlobals());

/** A fetch promise the test settles by hand. */
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((res) => (resolve = res));
  return { promise, resolve };
}

describe("useWatchlist load", () => {
  it("resolves true after a successful GET and updates the tickers", async () => {
    const lists = [[makeWatchlistEntry("AAPL")], [makeWatchlistEntry("AAPL"), makeWatchlistEntry("PYPL")]];
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ tickers: lists.length > 1 ? lists.shift() : lists[0] })));
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.tickers).toEqual(["AAPL"]));

    let loaded: boolean | undefined;
    await act(async () => {
      loaded = await result.current.load();
    });

    expect(loaded).toBe(true);
    expect(result.current.tickers).toEqual(["AAPL", "PYPL"]);
  });

  it("resolves false when the fetch rejects and never rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("socket hang up"))));
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loadFailed).toBe(true));

    let loaded: boolean | undefined;
    await act(async () => {
      loaded = await result.current.load();
    });

    expect(loaded).toBe(false);
    expect(result.current.loadFailed).toBe(true);
  });

  it("resolves false on a 500 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "boom" }, 500)));
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loadFailed).toBe(true));

    let loaded: boolean | undefined;
    await act(async () => {
      loaded = await result.current.load();
    });

    expect(loaded).toBe(false);
  });

  it("resolves false for a load superseded by a newer one and keeps the newer list", async () => {
    const older = deferred();
    const responses = [
      Promise.resolve(jsonResponse({ tickers: [makeWatchlistEntry("AAPL")] })),
      older.promise,
      Promise.resolve(jsonResponse({ tickers: [makeWatchlistEntry("FRESH")] })),
    ];
    vi.stubGlobal("fetch", vi.fn(() => responses.shift()!));
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.tickers).toEqual(["AAPL"]));

    let olderLoad!: Promise<boolean>;
    let newerLoaded: boolean | undefined;
    act(() => {
      olderLoad = result.current.load();
    });
    await act(async () => {
      newerLoaded = await result.current.load();
    });
    expect(newerLoaded).toBe(true);
    expect(result.current.tickers).toEqual(["FRESH"]);

    await act(async () => {
      older.resolve(jsonResponse({ tickers: [makeWatchlistEntry("STALE")] }));
      expect(await olderLoad).toBe(false);
    });
    expect(result.current.tickers).toEqual(["FRESH"]);
  });
});
