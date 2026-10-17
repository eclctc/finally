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

/**
 * Starter questions shown in the empty chat. No entry may contain buy, sell or add as a
 * case-insensitive substring, because backend/app/chat/mock.py keys its trades on them.
 */
export const QUICK_PROMPTS = ["Analyze my portfolio", "What is my biggest risk?", "Summarize my P&L"] as const;
