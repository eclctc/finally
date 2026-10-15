"use client";

import { useCallback, useEffect, useState } from "react";
import { addTicker, fetchWatchlist, removeTicker } from "@/lib/api";
import type { WatchlistEntry } from "@/lib/types";

/** Watchlist entries from the backend with add/remove actions. */
export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);

  const refresh = useCallback(async () => {
    setEntries(await fetchWatchlist());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from the API
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (ticker: string) => {
      await addTicker(ticker);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (ticker: string) => {
      await removeTicker(ticker);
      await refresh();
    },
    [refresh],
  );

  return { entries, add, remove, refresh };
}
