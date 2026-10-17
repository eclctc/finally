/** Module-level store of rows the AI just changed, each held then faded on timers. */

export const AI_HIGHLIGHT_HOLD_MS = 1500;
export const AI_HIGHLIGHT_FADE_MS = 1000;

export type AiChangeKind = "watchlist" | "position";
export type AiChangePhase = "hold" | "fade";

type Listener = () => void;

const phases = new Map<string, AiChangePhase>();
const timers = new Map<string, ReturnType<typeof setTimeout>[]>();
const listeners = new Set<Listener>();

const keyOf = (kind: AiChangeKind, ticker: string) => `${kind}:${ticker}`;

function notify() {
  for (const listener of listeners) listener();
}

function setPhase(key: string, phase: AiChangePhase | null) {
  if (phase === null) {
    phases.delete(key);
    timers.delete(key);
  } else {
    phases.set(key, phase);
  }
  notify();
}

/** Highlight a row: hold, then fade, then clear; a repeat mark restarts the full window. */
export function markAiChanged(kind: AiChangeKind, ticker: string) {
  const key = keyOf(kind, ticker);
  timers.get(key)?.forEach(clearTimeout);
  timers.set(key, [
    setTimeout(() => setPhase(key, "fade"), AI_HIGHLIGHT_HOLD_MS),
    setTimeout(() => setPhase(key, null), AI_HIGHLIGHT_HOLD_MS + AI_HIGHLIGHT_FADE_MS),
  ]);
  setPhase(key, "hold");
}

/** Current highlight phase of a row, null when it is not highlighted. */
export const getAiChange = (kind: AiChangeKind, ticker: string): AiChangePhase | null =>
  phases.get(keyOf(kind, ticker)) ?? null;

/** Subscribe to any highlight change. */
export function subscribeAiChanges(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Clear every mark, timer and listener (tests). */
export function resetAiChanges() {
  timers.forEach((pending) => pending.forEach(clearTimeout));
  timers.clear();
  phases.clear();
  listeners.clear();
}
