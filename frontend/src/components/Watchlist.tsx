"use client";

import { testIds } from "@/lib/testIds";
import { useWatchlist } from "@/lib/useWatchlist";
import { Panel } from "./Panel";
import { WatchlistRow } from "./WatchlistRow";

function WatchlistEmpty() {
  return (
    <div className="py-12 text-center">
      <p className="font-semibold text-text">Watchlist is empty</p>
      <p className="text-muted">Enter a ticker above and press Add.</p>
    </div>
  );
}

function WatchlistList({ tickers, loadFailed }: { tickers: string[] | null; loadFailed: boolean }) {
  if (loadFailed) {
    return (
      <p role="alert" className="break-words px-2 py-2 text-down">
        Watchlist unavailable. Reload the page to try again.
      </p>
    );
  }
  if (tickers === null) return <p className="px-2 py-2 text-muted">Loading watchlist...</p>;
  if (tickers.length === 0) return <WatchlistEmpty />;
  return (
    <ul aria-label="Watchlist tickers">
      {tickers.map((ticker) => <WatchlistRow key={ticker} ticker={ticker} />)}
    </ul>
  );
}

/** Watchlist panel: rows come from GET /api/watchlist, prices from the live store. */
export function Watchlist() {
  const { tickers, loadFailed } = useWatchlist();

  return (
    <Panel title="Watchlist" testId={testIds.watchlist}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <WatchlistList tickers={tickers} loadFailed={loadFailed} />
        </div>
      </div>
    </Panel>
  );
}
