"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, request } from "./api";
import { seedPrices, type FrameEntry } from "./priceStore";

const NETWORK_ERROR = "Request failed. Try again.";

const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : NETWORK_ERROR);

/** Owns watchlist membership: ticker names in GET /api/watchlist order (null until the first load settles), plus add. */
export function useWatchlist() {
  const [tickers, setTickers] = useState<string[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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

  const clearError = useCallback(() => setError(null), []);

  return { tickers, loadFailed, error, adding, add, clearError };
}
