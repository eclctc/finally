"use client";

import { useState } from "react";
import type { TradeSide } from "@/lib/types";

interface TradeBarProps {
  ticker: string;
  onTickerChange: (ticker: string) => void;
  onTrade: (ticker: string, quantity: number, side: TradeSide) => Promise<void>;
}

/** Market order entry: ticker, quantity, buy and sell. */
export function TradeBar({ ticker, onTickerChange, onTrade }: TradeBarProps) {
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function trade(side: TradeSide) {
    setSubmitting(true);
    try {
      await onTrade(ticker.trim().toUpperCase(), Number(quantity), side);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const sideButton = "flex-1 py-1.5 font-medium text-ink disabled:opacity-50";

  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-2 p-3">
      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-muted">
          Ticker
          <input
            data-testid="trade-ticker"
            value={ticker}
            onChange={(event) => onTickerChange(event.target.value.toUpperCase())}
            maxLength={5}
            className="figures w-full min-w-0 border border-line bg-ink px-2 py-1.5 text-[13px] text-text"
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-muted">
          Quantity
          <input
            data-testid="trade-quantity"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            inputMode="decimal"
            placeholder="0"
            className="figures w-full min-w-0 border border-line bg-ink px-2 py-1.5 text-[13px] text-text placeholder:text-muted"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="trade-buy"
          disabled={submitting}
          onClick={() => trade("buy")}
          className={`${sideButton} bg-up hover:brightness-110`}
        >
          Buy
        </button>
        <button
          type="button"
          data-testid="trade-sell"
          disabled={submitting}
          onClick={() => trade("sell")}
          className={`${sideButton} bg-down hover:brightness-110`}
        >
          Sell
        </button>
      </div>
      {error && (
        <p data-testid="trade-error" role="alert" className="text-[12px] text-down">
          {error}
        </p>
      )}
    </form>
  );
}
