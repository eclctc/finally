"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, errorMessage, request } from "./api";
import { clearTicker, seedPrices, type FrameEntry } from "./priceStore";

/** Owns watchlist membership: ticker names in GET /api/watchlist order (null until the first load settles), plus add and remove. */
export function useWatchlist() {
  const [tickers, setTickers] = useState<string[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { tickers: list } = await request<{ tickers: FrameEntry[] }>("/api/watchlist");
      seedPrices(Object.fromEntries(list.map((entry) => [entry.ticker, entry])));
      setTickers(list.map((entry) => entry.ticker));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (ticker: string) => {
      setAdding(true);
      setError(null);
      try {
        await request("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker }),
        });
        await load();
        return true;
      } catch (err) {
        setError(errorMessage(err));
        return false;
      } finally {
        setAdding(false);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (ticker: string) => {
      setRemoving(ticker);
      setError(null);
      try {
        await request(`/api/watchlist/${encodeURIComponent(ticker)}`, { method: "DELETE" });
        clearTicker(ticker);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) clearTicker(ticker);
        else setError(errorMessage(err));
      } finally {
        await load();
        setRemoving(null);
      }
    },
    [load],
  );

  const clearError = useCallback(() => setError(null), []);

  return { tickers, loadFailed, error, adding, removing, add, remove, clearError };
}
