import type { ReactNode } from "react";

/** Shared tooltip frame: a muted time line above the chart-specific value. */
export function ChartTooltip({ time, children }: { time: string; children: ReactNode }) {
  return (
    <div className="border border-line bg-surface p-2 text-[11px]">
      <p className="text-muted">{time}</p>
      {children}
    </div>
  );
}
