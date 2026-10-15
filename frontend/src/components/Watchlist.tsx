"use client";

import { useState } from "react";
import type { PriceHistory, PriceMap, WatchlistEntry } from "@/lib/types";
import { Panel } from "./Panel";
import { WatchlistRow } from "./WatchlistRow";

interface WatchlistProps {
  entries: WatchlistEntry[];
  prices: PriceMap;
  history: PriceHistory;
  selectedTicker: string | null;
  onSelect: (ticker: string) => void;
  onAdd: (ticker: string) => Promise<void>;
  onRemove: (ticker: string) => Promise<void>;
}

/** Watched tickers with live prices, plus the add-ticker form. */
export function Watchlist({ entries, prices, history, selectedTicker, onSelect, onAdd, onRemove }: WatchlistProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const ticker = draft.trim().toUpperCase();
    if (!ticker) return;
    try {
      await onAdd(ticker);
      setDraft("");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleRemove(ticker: string) {
    try {
      await onRemove(ticker);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Panel title="Watchlist" testId="watchlist" className="h-full">
      <div className="flex h-full flex-col">
        <form onSubmit={handleAdd} className="flex gap-2 border-b border-line p-2">
          <input
            data-testid="watchlist-add-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add ticker"
            aria-label="Ticker to add"
            maxLength={5}
            className="figures min-w-0 flex-1 border border-line bg-ink px-2 py-1 uppercase placeholder:normal-case placeholder:text-muted"
          />
          <button
            type="submit"
            data-testid="watchlist-add-button"
            className="border border-primary px-3 text-primary hover:bg-primary hover:text-ink"
          >
            Add
          </button>
        </form>
        {error && <p className="px-3 py-1 text-[12px] text-down">{error}</p>}
        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {entries.map((entry) => (
            <WatchlistRow
              key={entry.ticker}
              entry={entry}
              update={prices[entry.ticker]}
              points={history[entry.ticker] ?? []}
              selected={entry.ticker === selectedTicker}
              onSelect={onSelect}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      </div>
    </Panel>
  );
}
