import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api";
import { snapshotTime, type Snapshot, type ValuePoint } from "./pnlSeries";
import { POLL_MS } from "./usePortfolio";

/**
 * Shared portfolio history source: GET /api/portfolio/history on mount and every POLL_MS, oldest
 * first. A response applies only while it belongs to the latest request, so an older GET never
 * overwrites a newer one. `failed` is true only while no history has loaded.
 */
export function usePortfolioHistory() {
  const [history, setHistory] = useState<ValuePoint[] | null>(null);
  const [failedLoad, setFailedLoad] = useState(false);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++latest.current;
    try {
      const body = await request<{ snapshots: Snapshot[] }>("/api/portfolio/history");
      if (latest.current === mine) {
        setHistory(body.snapshots.map((s) => ({ t: snapshotTime(s.recorded_at), value: s.total_value })));
        setFailedLoad(false);
      }
      return true;
    } catch {
      if (latest.current === mine) setFailedLoad(true);
      return false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { history, failed: failedLoad && history === null, refresh };
}
