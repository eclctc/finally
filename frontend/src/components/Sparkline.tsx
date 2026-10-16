"use client";

import { useMemo } from "react";
import { Line, LineChart, YAxis } from "recharts";

const NO_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };

const strokeFor = (history: readonly number[]) => {
  const first = history[0];
  const last = history[history.length - 1];
  if (last > first) return "var(--color-up)";
  return last < first ? "var(--color-down)" : "var(--color-muted)";
};

/** 64x20 line of a ticker's price history since page load, colored by net move. */
export function Sparkline({ history }: { history: readonly number[] }) {
  const data = useMemo(() => history.map((price) => ({ price })), [history]);
  return (
    <div aria-hidden="true" title="Since page load" className="h-5 w-16 shrink-0">
      {history.length >= 2 && (
        <LineChart width={64} height={20} data={data} margin={NO_MARGIN} accessibilityLayer={false}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            dataKey="price"
            dot={false}
            isAnimationActive={false}
            strokeWidth={1.5}
            stroke={strokeFor(history)}
          />
        </LineChart>
      )}
    </div>
  );
}
