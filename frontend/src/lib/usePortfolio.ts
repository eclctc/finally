import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api";
import type { Portfolio } from "./portfolioValue";

export const POLL_MS = 30_000;

/**
 * Shared portfolio source: GET /api/portfolio on mount and every POLL_MS, plus setPortfolio() for
 * trade responses. A response applies only if nothing newer started since, so an older GET never
 * overwrites a trade. `failed` is true only while no portfolio has loaded.
 */
export function usePortfolio() {
  const [portfolio, setStoredPortfolio] = useState<Portfolio | null>(null);
  const [failedLoad, setFailedLoad] = useState(false);
  const generation = useRef(0);

  const setPortfolio = useCallback((next: Portfolio) => {
    generation.current += 1;
    setStoredPortfolio(next);
    setFailedLoad(false);
  }, []);

  const refresh = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const next = await request<Portfolio>("/api/portfolio");
      if (generation.current === mine) {
        setStoredPortfolio(next);
        setFailedLoad(false);
      }
      return true;
    } catch {
      if (generation.current === mine) setFailedLoad(true);
      return false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { portfolio, failed: failedLoad && portfolio === null, refresh, setPortfolio };
}
