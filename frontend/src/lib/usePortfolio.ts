import { useCallback, useEffect, useState } from "react";
import { request } from "./api";
import type { Portfolio } from "./portfolioValue";

/** GET /api/portfolio on mount; refresh() re-reads it (Phase 4 calls it after a trade). */
export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(() => {
    request<Portfolio>("/api/portfolio")
      .then((next) => {
        setPortfolio(next);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(refresh, [refresh]);

  return { portfolio, failed, refresh };
}
