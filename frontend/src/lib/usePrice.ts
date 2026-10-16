import { useCallback, useSyncExternalStore } from "react";
import {
  EMPTY_HISTORY,
  getEntry,
  getHistory,
  getStatus,
  getVersion,
  subscribeStatus,
  subscribeTicker,
  subscribeVersion,
  type ConnectionStatus,
  type PriceEntry,
} from "./priceStore";

/** Latest entry for one ticker; re-renders only when that ticker changes. */
export function useTickerPrice(ticker: string): PriceEntry | undefined {
  const subscribe = useCallback((listener: () => void) => subscribeTicker(ticker, listener), [ticker]);
  return useSyncExternalStore(subscribe, () => getEntry(ticker), () => undefined);
}

/** Price history for one ticker, oldest first. */
export function useTickerHistory(ticker: string): readonly number[] {
  const subscribe = useCallback((listener: () => void) => subscribeTicker(ticker, listener), [ticker]);
  return useSyncExternalStore(subscribe, () => getHistory(ticker), () => EMPTY_HISTORY);
}

/** Current stream connection status. */
export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(subscribeStatus, getStatus, () => "reconnecting");
}

/** Counter that changes whenever any ticker changes. */
export function usePriceVersion(): number {
  return useSyncExternalStore(subscribeVersion, getVersion, () => 0);
}
