"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchHistory, fetchPortfolio } from "@/lib/api";
import type { Portfolio, Snapshot } from "@/lib/types";

const HISTORY_REFRESH_MS = 30_000;

/** Portfolio and snapshot history from the backend, with a manual refresh. */
export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  const refresh = useCallback(async () => {
    const [nextPortfolio, nextSnapshots] = await Promise.all([fetchPortfolio(), fetchHistory()]);
    setPortfolio(nextPortfolio);
    setSnapshots(nextSnapshots);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from the API
    refresh();
    const timer = setInterval(refresh, HISTORY_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { portfolio, snapshots, setPortfolio, refresh };
}
