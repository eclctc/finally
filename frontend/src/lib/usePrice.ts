import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  EMPTY_SERIES,
  getEntry,
  getSeries,
  getStatus,
  getVersion,
  subscribeStatus,
  subscribeTicker,
  subscribeVersion,
  type ConnectionStatus,
  type PriceEntry,
  type PricePoint,
} from "./priceStore";

/** Latest entry for one ticker; re-renders only when that ticker changes. */
export function useTickerPrice(ticker: string): PriceEntry | undefined {
  const subscribe = useCallback((listener: () => void) => subscribeTicker(ticker, listener), [ticker]);
  return useSyncExternalStore(subscribe, () => getEntry(ticker), () => undefined);
}

/** Timestamped price series for one ticker, oldest first. */
export function useTickerSeries(ticker: string): readonly PricePoint[] {
  const subscribe = useCallback((listener: () => void) => subscribeTicker(ticker, listener), [ticker]);
  return useSyncExternalStore(subscribe, () => getSeries(ticker), () => EMPTY_SERIES);
}

/** Price history for one ticker, oldest first. */
export function useTickerHistory(ticker: string): readonly number[] {
  const series = useTickerSeries(ticker);
  return useMemo(() => series.map((point) => point.price), [series]);
}

/** Current stream connection status. */
export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(subscribeStatus, getStatus, () => "reconnecting");
}

/** Counter that changes whenever any ticker changes. */
export function usePriceVersion(): number {
  return useSyncExternalStore(subscribeVersion, getVersion, () => 0);
}
