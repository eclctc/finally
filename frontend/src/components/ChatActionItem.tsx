import { formatPrice, formatQuantity } from "@/lib/format";
import type { ChatAction } from "@/lib/types";

/** Plain-language description of one action the assistant took. */
export function describeAction(action: ChatAction): string {
  if (action.type === "trade") {
    const verb = action.side === "buy" ? "Bought" : "Sold";
    const base = `${verb} ${formatQuantity(action.quantity ?? 0)} ${action.ticker}`;
    if (action.status === "failed") return `${action.side === "buy" ? "Buy" : "Sell"} ${action.ticker} failed`;
    return action.price != null ? `${base} at ${formatPrice(action.price)}` : base;
  }
  const verb = action.action === "add" ? "Added" : "Removed";
  const preposition = action.action === "add" ? "to" : "from";
  if (action.status === "failed") return `Watchlist ${action.action} ${action.ticker} failed`;
  return `${verb} ${action.ticker} ${preposition} watchlist`;
}

/** Inline confirmation or failure for an action executed from chat. */
export function ChatActionItem({ action }: { action: ChatAction }) {
  const ok = action.status === "ok";
  return (
    <li
      data-testid="chat-action"
      data-status={action.status}
      className={`border-l-2 px-2 py-1 text-[12px] ${ok ? "border-up text-up" : "border-down text-down"}`}
    >
      <span className="figures">{describeAction(action)}</span>
      {action.error && <span className="block text-muted">{action.error}</span>}
    </li>
  );
}
