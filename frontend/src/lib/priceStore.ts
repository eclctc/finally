/** Module-level live price store: per-ticker entries, capped history, flash direction and stream status. */

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";
export type Flash = "up" | "down" | null;

export const HISTORY_LIMIT = 300;
/** Shared empty history so unknown tickers return a stable snapshot reference. */
export const EMPTY_HISTORY: readonly number[] = Object.freeze([]);

export interface PriceEntry {
  price: number;
  openPrice: number;
  timestamp: number;
  flash: Flash;
}

export interface FrameEntry {
  ticker: string;
  price: number | null;
  open_price: number | null;
  timestamp: number | null;
}

export type PriceFrame = Record<string, FrameEntry>;

type Listener = () => void;

const entries = new Map<string, PriceEntry>();
const histories = new Map<string, readonly number[]>();
const tickerListeners = new Map<string, Set<Listener>>();
const statusListeners = new Set<Listener>();
const versionListeners = new Set<Listener>();
let status: ConnectionStatus = "reconnecting";
let version = 0;

function notify(listeners: Set<Listener> | undefined) {
  for (const listener of listeners ?? []) listener();
}

function applyTick(ticker: string, next: { price: number; openPrice: number; timestamp: number }, flash: Flash) {
  entries.set(ticker, { ...next, flash });
  histories.set(ticker, [...(histories.get(ticker) ?? []), next.price].slice(-HISTORY_LIMIT));
  notify(tickerListeners.get(ticker));
}

const toTick = (entry: FrameEntry) => ({
  price: entry.price as number,
  openPrice: entry.open_price as number,
  timestamp: entry.timestamp as number,
});

const flashFor = (previous: number | undefined, price: number): Flash => {
  if (previous === undefined || price === previous) return null;
  return price > previous ? "up" : "down";
};

/** Merge a stream frame per ticker; a repeated timestamp or an unpriced entry changes nothing. */
export function mergeFrame(frame: PriceFrame) {
  let changed = false;
  for (const entry of Object.values(frame)) {
    if (entry.price === null) continue;
    const stored = entries.get(entry.ticker);
    if (stored?.timestamp === entry.timestamp) continue;
    applyTick(entry.ticker, toTick(entry), flashFor(stored?.price, entry.price));
    changed = true;
  }
  if (!changed) return;
  version += 1;
  notify(versionListeners);
}

/** Fill tickers that have no entry yet; never overwrites a streamed price. */
export function seedPrices(frame: PriceFrame) {
  let changed = false;
  for (const entry of Object.values(frame)) {
    if (entry.price === null || entries.has(entry.ticker)) continue;
    applyTick(entry.ticker, toTick(entry), null);
    changed = true;
  }
  if (!changed) return;
  version += 1;
  notify(versionListeners);
}

/** Drop a ticker's entry and history, for a removed watchlist row. */
export function clearTicker(ticker: string) {
  entries.delete(ticker);
  histories.delete(ticker);
  notify(tickerListeners.get(ticker));
  version += 1;
  notify(versionListeners);
}

/** Set the connection status, notifying only on a real change. */
export function setStatus(next: ConnectionStatus) {
  if (next === status) return;
  status = next;
  notify(statusListeners);
}

/** Latest entry for a ticker, undefined until a price arrives. */
export const getEntry = (ticker: string) => entries.get(ticker);
/** Price history for a ticker, oldest first, capped at HISTORY_LIMIT. */
export const getHistory = (ticker: string) => histories.get(ticker) ?? EMPTY_HISTORY;
/** Current connection status. */
export const getStatus = () => status;
/** Counter that increments whenever any ticker changes. */
export const getVersion = () => version;

function subscribeTo(listeners: Set<Listener>, listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribe to one ticker's entry and history changes. */
export function subscribeTicker(ticker: string, listener: Listener) {
  const listeners = tickerListeners.get(ticker) ?? new Set<Listener>();
  tickerListeners.set(ticker, listeners);
  return subscribeTo(listeners, listener);
}

/** Subscribe to connection status changes. */
export const subscribeStatus = (listener: Listener) => subscribeTo(statusListeners, listener);
/** Subscribe to the any-ticker-changed version counter. */
export const subscribeVersion = (listener: Listener) => subscribeTo(versionListeners, listener);

/** Restore the initial empty state and drop every listener (tests). */
export function resetPriceStore() {
  entries.clear();
  histories.clear();
  tickerListeners.clear();
  statusListeners.clear();
  versionListeners.clear();
  status = "reconnecting";
  version = 0;
}
