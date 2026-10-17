import type { AiChangeKind } from "./aiChangeStore";
import type { ChatAction } from "./chat";

/** Tickers of the watchlist removals the AI executed, in the order returned. */
export function removedTickers(actions: ChatAction[]): string[] {
  return actions
    .filter((action) => action.type === "watchlist" && action.status === "ok" && action.action === "remove")
    .map((action) => action.ticker);
}

/** Rows the AI successfully changed: a position per ok trade, a watchlist row per ok add. */
export function aiChangeTargets(actions: ChatAction[]): { kind: AiChangeKind; ticker: string }[] {
  return actions.flatMap((action): { kind: AiChangeKind; ticker: string }[] => {
    if (action.status !== "ok") return [];
    if (action.type === "trade") return [{ kind: "position", ticker: action.ticker }];
    return action.action === "add" ? [{ kind: "watchlist", ticker: action.ticker }] : [];
  });
}
