"use client";

export function Sparkline({ history }: { history: readonly number[] }) {
  return <div data-points={history.length} />;
}
