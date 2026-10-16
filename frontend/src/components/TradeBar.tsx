"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage, request } from "@/lib/api";
import { formatCurrency, formatPrice, formatQuantity } from "@/lib/format";
import type { Portfolio } from "@/lib/portfolioValue";
import { testIds } from "@/lib/testIds";
import { useTickerPrice } from "@/lib/usePrice";

interface ExecutedTrade {
  id: string;
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  executed_at: string;
}

interface TradeResponse {
  trade: ExecutedTrade;
  portfolio: Portfolio;
}

type Message = { kind: "filled" | "error"; text: string };

const INPUT_CLASS =
  "h-7 w-full min-w-0 border border-line bg-surface px-2 text-text placeholder:text-muted focus:border-primary focus-visible:outline-2 outline-primary";
const BUTTON_CLASS =
  "h-7 flex-1 bg-submit font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 outline-primary";

/** Trade bar: ticker and quantity inputs, Buy and Sell market orders, inline result line. */
export function TradeBar({
  selectedTicker,
  onFilled,
}: {
  selectedTicker: string | null;
  onFilled: (portfolio: Portfolio) => void;
}) {
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [inFlight, setInFlight] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const livePrice = useTickerPrice(ticker.trim());

  useEffect(() => {
    if (selectedTicker !== null) setTicker(selectedTicker);
  }, [selectedTicker]);

  const amount = Number(quantity);
  const validQuantity = Number.isFinite(amount) && amount > 0;
  const canTrade = !inFlight && ticker.trim() !== "" && validQuantity;
  const estimate = livePrice && validQuantity ? formatCurrency(amount * livePrice.price) : "--";

  async function submit(side: "buy" | "sell") {
    setInFlight(true);
    setMessage(null);
    try {
      const { trade, portfolio } = await request<TradeResponse>("/api/portfolio/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: ticker.trim(), side, quantity: Number(quantity) }),
      });
      onFilled(portfolio);
      setQuantity("");
      setMessage({
        kind: "filled",
        text: `Filled ${trade.side.toUpperCase()} ${formatQuantity(trade.quantity)} ${trade.ticker} @ ${formatPrice(trade.price)}`,
      });
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setInFlight(false);
      quantityRef.current?.focus();
    }
  }

  return (
    <div role="group" aria-label="Trade order" aria-busy={inFlight ? true : undefined} className="flex flex-col gap-2 p-2">
      <input
        data-testid={testIds.tradeTicker}
        value={ticker}
        onChange={(event) => {
          setTicker(event.target.value.toUpperCase());
          setMessage(null);
        }}
        placeholder="Ticker"
        aria-label="Ticker to trade"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        className={INPUT_CLASS}
      />
      <input
        ref={quantityRef}
        data-testid={testIds.tradeQuantity}
        type="text"
        inputMode="decimal"
        value={quantity}
        onChange={(event) => {
          setQuantity(event.target.value);
          setMessage(null);
        }}
        placeholder="Quantity"
        aria-label="Quantity"
        className={`${INPUT_CLASS} figures text-right`}
      />
      <div className="flex gap-2">
        <button type="button" data-testid={testIds.tradeBuy} disabled={!canTrade} onClick={() => submit("buy")} className={BUTTON_CLASS}>
          Buy
        </button>
        <button type="button" data-testid={testIds.tradeSell} disabled={!canTrade} onClick={() => submit("sell")} className={BUTTON_CLASS}>
          Sell
        </button>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-muted">Est. value</span>
        <span className="figures whitespace-nowrap text-text">{estimate}</span>
      </div>
      {message?.kind === "error" && (
        <p data-testid={testIds.tradeError} role="alert" className="break-words text-down">
          {message.text}
        </p>
      )}
      {message?.kind === "filled" && (
        <p role="status" className="break-words text-muted">
          {message.text}
        </p>
      )}
    </div>
  );
}
