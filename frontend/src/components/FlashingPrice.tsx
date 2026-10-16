"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { Flash, PriceEntry } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";

/** Time the tint is painted before the CSS fade starts; a 0 ms hold paints nothing. */
export const FLASH_HOLD_MS = 50;

const CELL_CLASS = "figures min-w-[72px] shrink-0 whitespace-nowrap px-1 text-right text-text";
const FLASH_CLASS = {
  up: "bg-up/25 transition-none motion-reduce:bg-transparent",
  down: "bg-down/25 transition-none motion-reduce:bg-transparent",
};
const IDLE_CLASS = "bg-transparent transition-colors duration-500 ease-out motion-reduce:transition-none";

/** Price cell that tints green or red for FLASH_HOLD_MS on a real move, then fades by CSS transition. */
export function FlashingPrice({ ticker, entry }: { ticker: string; entry: PriceEntry | undefined }) {
  const [flash, setFlash] = useState<Flash>(null);

  useEffect(() => {
    const next = entry?.flash ?? null;
    setFlash(next);
    if (!next) return;
    const timer = setTimeout(() => setFlash(null), FLASH_HOLD_MS);
    return () => clearTimeout(timer);
  }, [entry]);

  return (
    <span
      data-testid={testIds.watchlistPrice(ticker)}
      data-flash={flash ?? undefined}
      className={`${CELL_CLASS} ${flash ? FLASH_CLASS[flash] : IDLE_CLASS}`}
    >
      {entry ? formatPrice(entry.price) : "--"}
    </span>
  );
}
