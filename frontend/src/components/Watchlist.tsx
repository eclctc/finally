"use client";

import { useEffect, useState } from "react";
import { request } from "@/lib/api";
import { seedPrices, type FrameEntry } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";
import { Panel } from "./Panel";
import { WatchlistRow } from "./WatchlistRow";

/** Watchlist panel: rows come from GET /api/watchlist, prices from the live store. */
export function Watchlist() {
  const [tickers, setTickers] = useState<string[] | null>(null);

  useEffect(() => {
    request<{ tickers: FrameEntry[] }>("/api/watchlist").then(({ tickers: list }) => {
      seedPrices(Object.fromEntries(list.map((entry) => [entry.ticker, entry])));
      setTickers(list.map((entry) => entry.ticker));
    });
  }, []);

  return (
    <Panel title="Watchlist" testId={testIds.watchlist}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul aria-label="Watchlist tickers">
            {tickers?.map((ticker) => <WatchlistRow key={ticker} ticker={ticker} />)}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
