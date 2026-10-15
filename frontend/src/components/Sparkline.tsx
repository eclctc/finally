"use client";

import { Line, LineChart, YAxis } from "recharts";
import type { PricePoint } from "@/lib/types";

interface SparklineProps {
  points: PricePoint[];
  rising: boolean;
}

/** Tiny price line accumulated from the stream since page load. */
export function Sparkline({ points, rising }: SparklineProps) {
  return (
    <LineChart width={72} height={22} data={points}>
      <YAxis hide domain={["dataMin", "dataMax"]} />
      <Line
        type="linear"
        dataKey="price"
        stroke={rising ? "var(--color-up)" : "var(--color-down)"}
        strokeWidth={1.25}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
