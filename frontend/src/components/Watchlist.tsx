"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
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

const INPUT_CLASS =
  "h-7 min-w-0 flex-1 border bg-surface px-2 text-text placeholder:text-muted focus-visible:outline-2 outline-primary";
const BUTTON_CLASS =
  "h-7 bg-submit px-4 font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 outline-primary";

/** Watchlist panel: add form above rows from GET /api/watchlist, prices from the live store. */
export function Watchlist() {
  const { tickers, loadFailed, error, adding, add, clearError } = useWatchlist();
  const [draft, setDraft] = useState("");
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const errorId = useId();

  useEffect(() => {
    if (scrollTarget === null) return;
    const row = listRef.current?.querySelector(`[data-testid="${testIds.watchlistRow(scrollTarget)}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "nearest" });
    setScrollTarget(null);
  }, [scrollTarget, tickers]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const ticker = draft.trim();
    if (ticker === "" || adding) return;
    if (await add(ticker)) {
      setDraft("");
      setScrollTarget(ticker);
    }
    inputRef.current?.focus();
  }

  return (
    <Panel title="Watchlist" testId={testIds.watchlist}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-line">
          <form onSubmit={handleSubmit} className="flex gap-2 p-2">
            <input
              ref={inputRef}
              data-testid={testIds.watchlistAddInput}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value.toUpperCase());
                clearError();
              }}
              placeholder="Ticker"
              aria-label="Ticker to add"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={`${INPUT_CLASS} ${error ? "border-down" : "border-line focus:border-primary"}`}
            />
            <button
              type="submit"
              data-testid={testIds.watchlistAddButton}
              disabled={adding || draft.trim() === ""}
              className={BUTTON_CLASS}
            >
              Add
            </button>
          </form>
          {error && (
            <p id={errorId} role="alert" className="break-words px-2 pb-2 text-down">
              {error}
            </p>
          )}
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          <WatchlistList tickers={tickers} loadFailed={loadFailed} />
        </div>
      </div>
    </Panel>
  );
}
