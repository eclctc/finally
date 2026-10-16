import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POLL_MS } from "@/lib/usePortfolio";
import { usePortfolioHistory } from "@/lib/usePortfolioHistory";
import { jsonResponse, makeSnapshot } from "@/test/fixtures";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A fetch promise the test settles by hand. */
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((res) => (resolve = res));
  return { promise, resolve };
}

const historyBody = (...values: number[]) => ({
  snapshots: values.map((value, i) => makeSnapshot(value, `2026-10-16T21:00:0${i}.000000+00:00`)),
});

describe("usePortfolioHistory", () => {
  it("fetches once on mount and maps snapshots to points in order", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(historyBody(10000, 10050)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePortfolioHistory());
    await waitFor(() => expect(result.current.history).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/portfolio/history", undefined);
    expect(result.current.history).toEqual([
      { t: Date.parse("2026-10-16T21:00:00.000Z"), value: 10000 },
      { t: Date.parse("2026-10-16T21:00:01.000Z"), value: 10050 },
    ]);
  });

  it("polls every 30 s and stops after unmount", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => jsonResponse(historyBody(10000)));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderHook(() => usePortfolioHistory());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(POLL_MS - 1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the later-started refresh when the earlier one resolves last", async () => {
    const first = deferred();
    const second = deferred();
    const fetchMock = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePortfolioHistory());

    let later!: Promise<boolean>;
    act(() => {
      later = result.current.refresh();
    });
    await act(async () => second.resolve(jsonResponse(historyBody(222))));
    await act(async () => first.resolve(jsonResponse(historyBody(111))));
    await later;
    expect(result.current.history?.map((p) => p.value)).toEqual([222]);
  });

  it("flags a failed first load and clears the flag on a later success", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(jsonResponse(historyBody(10000)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePortfolioHistory());
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.history).toBeNull();

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.failed).toBe(false);
    expect(result.current.history).toHaveLength(1);
  });

  it("stays silent when a poll fails after a success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(historyBody(10000)))
      .mockRejectedValueOnce(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePortfolioHistory());
    await waitFor(() => expect(result.current.history).toHaveLength(1));

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.failed).toBe(false);
    expect(result.current.history).toHaveLength(1);
  });

  it("resolves refresh() true after a successful GET and false after a failed one, never rejecting", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(historyBody(10000)))
      .mockResolvedValueOnce(jsonResponse(historyBody(10000)))
      .mockRejectedValueOnce(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePortfolioHistory());
    await waitFor(() => expect(result.current.history).not.toBeNull());

    let ok!: boolean;
    let failed!: boolean;
    await act(async () => {
      ok = await result.current.refresh();
      failed = await result.current.refresh();
    });
    expect(ok).toBe(true);
    expect(failed).toBe(false);
  });
});
