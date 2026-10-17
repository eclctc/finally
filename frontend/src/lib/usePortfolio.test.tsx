import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POLL_MS, usePortfolio } from "@/lib/usePortfolio";
import { jsonResponse, makePortfolio, makePosition } from "@/test/fixtures";

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

describe("usePortfolio", () => {
  it("fetches once on mount and exposes the body", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(makePortfolio(10000)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePortfolio());
    await waitFor(() => expect(result.current.portfolio?.cash_balance).toBe(10000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/portfolio", undefined);
  });

  it("polls every 30 s and stops after unmount", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => jsonResponse(makePortfolio(10000)));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = renderHook(() => usePortfolio());
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

  it("discards a GET that started before setPortfolio and resolved after it", async () => {
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const { result } = renderHook(() => usePortfolio());
    const traded = makePortfolio(9175.4, [makePosition("MSFT", 2, 412.3, 412.3)]);

    act(() => result.current.setPortfolio(traded));
    await act(async () => pending.resolve(jsonResponse(makePortfolio(10000))));
    expect(result.current.portfolio).toEqual(traded);
  });

  it("keeps the later-started refresh when the earlier one resolves last", async () => {
    const first = deferred();
    const second = deferred();
    const fetchMock = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePortfolio());

    let later!: Promise<boolean>;
    act(() => {
      later = result.current.refresh();
    });
    await act(async () => second.resolve(jsonResponse(makePortfolio(222))));
    await act(async () => first.resolve(jsonResponse(makePortfolio(111))));
    await later;
    expect(result.current.portfolio?.cash_balance).toBe(222);
  });

  it("flags a failed first load and clears the flag on a later success", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(jsonResponse(makePortfolio(10000)));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePortfolio());
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.portfolio).toBeNull();

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.failed).toBe(false);
    expect(result.current.portfolio?.cash_balance).toBe(10000);
  });

  it("stays silent when a poll fails after a success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makePortfolio(10000)))
      .mockRejectedValueOnce(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePortfolio());
    await waitFor(() => expect(result.current.portfolio?.cash_balance).toBe(10000));

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.failed).toBe(false);
    expect(result.current.portfolio?.cash_balance).toBe(10000);
  });

  it("resolves refresh() true after a successful GET and false after a failed one, never rejecting", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(makePortfolio(10000)))
      .mockResolvedValueOnce(jsonResponse(makePortfolio(10000)))
      .mockRejectedValueOnce(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePortfolio());
    await waitFor(() => expect(result.current.portfolio).not.toBeNull());

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
