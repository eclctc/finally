import { formatPrice, formatQuantity } from "./format";

/** One trade or watchlist change the AI attempted, as returned by POST /api/chat. */
export type ChatAction =
  | { type: "trade"; ticker: string; side: "buy" | "sell"; quantity: number; status: "ok"; price: number }
  | { type: "trade"; ticker: string; side: "buy" | "sell"; quantity: number; status: "failed"; error: string }
  | { type: "watchlist"; ticker: string; action: "add" | "remove"; status: "ok" }
  | { type: "watchlist"; ticker: string; action: "add" | "remove"; status: "failed"; error: string };

/** POST /api/chat 200 body. */
export interface ChatReply {
  message: string;
  actions: ChatAction[];
}

/** Chip text for one action; failure reasons are kept verbatim. */
export function describeAction(action: ChatAction): string {
  if (action.type === "trade") {
    const head = `${action.side.toUpperCase()} ${formatQuantity(action.quantity)} ${action.ticker}`;
    return action.status === "ok" ? `${head} @ ${formatPrice(action.price)}` : `${head} failed - ${action.error}`;
  }
  if (action.status === "ok") return `${action.action === "add" ? "Added" : "Removed"} ${action.ticker}`;
  return `${action.action === "add" ? "Add" : "Remove"} ${action.ticker} failed - ${action.error}`;
}
