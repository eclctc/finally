"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getAiChange, subscribeAiChanges, type AiChangeKind, type AiChangePhase } from "./aiChangeStore";

/** Highlight phase of one row; re-renders only when that row's phase changes. */
export function useAiChange(kind: AiChangeKind, ticker: string): AiChangePhase | null {
  const getSnapshot = useCallback(() => getAiChange(kind, ticker), [kind, ticker]);
  return useSyncExternalStore(subscribeAiChanges, getSnapshot, () => null);
}

const HIGHLIGHT_CLASS = {
  hold: "bg-primary/20 transition-none",
  fadeToTransparent: "bg-transparent transition-colors duration-1000 ease-out motion-reduce:transition-none",
  fadeToSurface: "bg-surface transition-colors duration-1000 ease-out motion-reduce:transition-none",
};

/** The one background utility for a highlighted row; the fade targets the row's resting fill. */
export function aiHighlightClass(phase: AiChangePhase, resting: "transparent" | "surface"): string {
  if (phase === "hold") return HIGHLIGHT_CLASS.hold;
  return resting === "surface" ? HIGHLIGHT_CLASS.fadeToSurface : HIGHLIGHT_CLASS.fadeToTransparent;
}
