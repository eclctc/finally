"use client";

import { useCallback, useEffect, useState } from "react";
import { request } from "./api";
import { seedPrices, type FrameEntry } from "./priceStore";

/** Owns watchlist membership: the ticker names in GET /api/watchlist order, or null until the first load settles. */
export function useWatchlist() {
  const [tickers, setTickers] = useState<string[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

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

  return { tickers, loadFailed };
}
