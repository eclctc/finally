"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatClock, formatCurrency } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { AXIS_TICK, TOOLTIP_STYLE } from "./chartTheme";
import { Panel } from "./Panel";

interface PnlChartProps {
  snapshots: Snapshot[];
}

/** Total portfolio value over time from recorded snapshots. */
export function PnlChart({ snapshots }: PnlChartProps) {
  const data = snapshots.map((snapshot) => ({
    time: Date.parse(snapshot.recorded_at),
    value: snapshot.total_value,
  }));

  return (
    <Panel title="Portfolio value" testId="pnl-chart" className="h-full">
      {data.length === 0 ? (
        <p className="p-4 text-muted">Value history appears after the first snapshot.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 200 }}>
          <LineChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatClock}
              tick={AXIS_TICK}
              stroke="var(--color-line)"
              minTickGap={60}
            />
            <YAxis
              orientation="right"
              domain={["auto", "auto"]}
              tickFormatter={(value: number) => value.toFixed(0)}
              tick={AXIS_TICK}
              stroke="var(--color-line)"
              width={56}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              labelFormatter={(label) => formatClock(Number(label))}
              formatter={(value) => [formatCurrency(Number(value)), "Value"]}
            />
            <Line
              type="stepAfter"
              dataKey="value"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              dot={data.length < 30}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
