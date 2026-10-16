import { useCallback, useEffect, useState } from "react";
import { request } from "./api";
import { snapshotTime, type Snapshot, type ValuePoint } from "./pnlSeries";

/**
 * Shared portfolio history source: GET /api/portfolio/history on mount, oldest first.
 * `failed` is true only while no history has loaded.
 */
export function usePortfolioHistory() {
  const [history, setHistory] = useState<ValuePoint[] | null>(null);
  const [failedLoad, setFailedLoad] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const body = await request<{ snapshots: Snapshot[] }>("/api/portfolio/history");
      setHistory(body.snapshots.map((s) => ({ t: snapshotTime(s.recorded_at), value: s.total_value })));
      setFailedLoad(false);
      return true;
    } catch {
      setFailedLoad(true);
      return false;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { history, failed: failedLoad && history === null, refresh };
}
