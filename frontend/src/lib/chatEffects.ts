import type { ChatAction } from "./chat";

/** Tickers of the watchlist removals the AI executed, in the order returned. */
export function removedTickers(actions: ChatAction[]): string[] {
  return actions
    .filter((action) => action.type === "watchlist" && action.status === "ok" && action.action === "remove")
    .map((action) => action.ticker);
}
