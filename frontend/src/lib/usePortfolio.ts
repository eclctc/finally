import { useCallback, useEffect, useState } from "react";
import { request } from "./api";
import type { Portfolio } from "./portfolioValue";

/** GET /api/portfolio on mount; refresh() re-reads it and setPortfolio() applies a trade response. */
export function usePortfolio() {
  const [portfolio, setStoredPortfolio] = useState<Portfolio | null>(null);
  const [failed, setFailed] = useState(false);

  const setPortfolio = useCallback((next: Portfolio) => {
    setStoredPortfolio(next);
    setFailed(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setPortfolio(await request<Portfolio>("/api/portfolio"));
      return true;
    } catch {
      setFailed(true);
      return false;
    }
  }, [setPortfolio]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { portfolio, failed, refresh, setPortfolio };
}
