"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatClock, formatPercent, formatPrice, signClass } from "@/lib/format";
import { sessionChangePercent } from "@/lib/portfolio";
import type { PricePoint, PriceUpdate } from "@/lib/types";
import { AXIS_TICK, TOOLTIP_STYLE } from "./chartTheme";

interface MainChartProps {
  ticker: string | null;
  points: PricePoint[];
  update: PriceUpdate | undefined;
}

/** Larger price chart for the selected ticker, built from the stream since page load. */
export function MainChart({ ticker, points, update }: MainChartProps) {
  const change = update ? sessionChangePercent(update.price, update.open_price) : 0;
  const data = points.map((point) => ({ time: point.time * 1000, price: point.price }));

  return (
    <section data-testid="main-chart" data-ticker={ticker ?? ""} className="flex h-full min-h-0 flex-col bg-panel">
      <header className="flex items-baseline gap-4 px-4 pt-3">
        <span className="text-2xl font-semibold tracking-tight">{ticker ?? "--"}</span>
        <span className="figures text-xl">{formatPrice(update?.price)}</span>
        <span className={`figures ${signClass(change)}`}>{formatPercent(change)} today</span>
      </header>
      <div className="min-h-0 flex-1 px-1 pb-2">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 240 }}>
          <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="main-chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              tickFormatter={(value: number) => value.toFixed(2)}
              tick={AXIS_TICK}
              stroke="var(--color-line)"
              width={60}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              labelFormatter={(label) => formatClock(Number(label))}
              formatter={(value) => [formatPrice(Number(value)), "Price"]}
            />
            <Area
              type="linear"
              dataKey="price"
              stroke="var(--color-primary)"
              strokeWidth={1.5}
              fill="url(#main-chart-fill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
