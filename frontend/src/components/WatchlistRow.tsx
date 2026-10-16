"use client";

import { memo } from "react";
import { formatPercent, formatPrice } from "@/lib/format";
import type { PriceEntry } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";
import { useTickerPrice } from "@/lib/usePrice";

const dailyChange = (entry: PriceEntry) => (entry.price - entry.openPrice) / entry.openPrice;

const changeColor = (change: number | undefined) => {
  if (change === undefined || change === 0) return "text-muted";
  return change > 0 ? "text-up" : "text-down";
};

/** One watchlist row: ticker, live price and daily change vs the session open. */
export const WatchlistRow = memo(function WatchlistRow({ ticker }: { ticker: string }) {
  const entry = useTickerPrice(ticker);
  const change = entry && dailyChange(entry);
  return (
    <li data-testid={testIds.watchlistRow(ticker)} className="flex h-7 items-center gap-1 px-2">
      <span className="min-w-0 flex-1 truncate font-semibold text-text">{ticker}</span>
      <span
        data-testid={testIds.watchlistPrice(ticker)}
        className="figures min-w-[72px] shrink-0 whitespace-nowrap px-1 text-right text-text"
      >
        {entry ? formatPrice(entry.price) : "--"}
      </span>
      <span
        title="Change vs session open"
        className={`figures w-16 shrink-0 whitespace-nowrap text-right ${changeColor(change)}`}
      >
        {change === undefined ? "--" : formatPercent(change)}
      </span>
    </li>
  );
});
