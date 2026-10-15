"use client";

import { useEffect, useState } from "react";
import { appendPrices } from "@/lib/history";
import { subscribePrices } from "@/lib/priceStream";
import type { ConnectionStatus, PriceHistory, PriceMap } from "@/lib/types";

/** Live prices, per-ticker history since page load, and the stream status. */
export function usePriceStream() {
  const [prices, setPrices] = useState<PriceMap>({});
  const [history, setHistory] = useState<PriceHistory>({});
  const [status, setStatus] = useState<ConnectionStatus>("reconnecting");

  useEffect(
    () =>
      subscribePrices((frame) => {
        setPrices(frame);
        setHistory((current) => appendPrices(current, frame));
      }, setStatus),
    [],
  );

  return { prices, history, status };
}
