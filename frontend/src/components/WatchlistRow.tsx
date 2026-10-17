"use client";

import { memo } from "react";
import { formatPercent, signClass } from "@/lib/format";
import type { PriceEntry } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";
import { aiHighlightClass, useAiChange } from "@/lib/useAiChange";
import { useTickerHistory, useTickerPrice } from "@/lib/usePrice";
import { FlashingPrice } from "./FlashingPrice";
import { Sparkline } from "./Sparkline";

const dailyChange = (entry: PriceEntry) => (entry.price - entry.openPrice) / entry.openPrice;

const ROW_BASE = "flex h-7 cursor-pointer items-center gap-1 px-2 focus-visible:outline-2 outline-primary -outline-offset-2";
const ROW_FILL = { selected: "bg-surface", idle: "hover:bg-surface/60" };

interface WatchlistRowProps {
  ticker: string;
  selected: boolean;
  removing: boolean;
  onSelect: (ticker: string) => void;
  onRemove: (ticker: string) => void;
}

/** One watchlist row: ticker, live price, daily change vs the session open, sparkline and remove button. */
export const WatchlistRow = memo(function WatchlistRow({ ticker, selected, removing, onSelect, onRemove }: WatchlistRowProps) {
  const entry = useTickerPrice(ticker);
  const history = useTickerHistory(ticker);
  const aiPhase = useAiChange("watchlist", ticker);
  const fill = aiPhase
    ? aiHighlightClass(aiPhase, selected ? "surface" : "transparent")
    : selected
      ? ROW_FILL.selected
      : ROW_FILL.idle;
  const change = entry && dailyChange(entry);
  const changeText = change === undefined ? "--" : formatPercent(change);
  return (
    <li
      data-testid={testIds.watchlistRow(ticker)}
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      data-ai-changed={aiPhase ? "true" : undefined}
      onClick={() => onSelect(ticker)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect(ticker);
      }}
      className={`${ROW_BASE} ${fill}`}
    >
      <span
        className={
          selected
            ? "min-w-0 flex-1 truncate font-semibold text-accent"
            : "min-w-0 flex-1 truncate font-semibold text-text"
        }
      >
        {ticker}
      </span>
      <FlashingPrice ticker={ticker} entry={entry} />
      <span
        title="Change vs session open"
        className={`figures w-16 shrink-0 whitespace-nowrap text-right ${change === undefined ? "text-muted" : signClass(change, changeText)}`}
      >
        {changeText}
      </span>
      <Sparkline history={history} />
      <button
        type="button"
        data-testid={testIds.watchlistRemove(ticker)}
        aria-label={`Remove ${ticker}`}
        title={`Remove ${ticker}`}
        disabled={removing}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(ticker);
        }}
        className="size-6 shrink-0 text-muted hover:text-down disabled:opacity-50 focus-visible:outline-2 outline-primary"
      >
        ×
      </button>
    </li>
  );
});
