"use client";

import { formatPrice } from "@/lib/format";
import type { PriceEntry } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";

export const FLASH_HOLD_MS = 50;

export function FlashingPrice({ ticker, entry }: { ticker: string; entry: PriceEntry | undefined }) {
  return <span data-testid={testIds.watchlistPrice(ticker)}>{entry ? formatPrice(entry.price) : "--"}</span>;
}
