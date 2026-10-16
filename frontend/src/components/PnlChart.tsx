"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/ChartTooltip";
import { formatCurrency, formatPrice, formatSignedCurrency, signClass } from "@/lib/format";
import { formatDateClock, formatHourMinute, formatMonthDay } from "@/lib/formatTime";
import { buildPnlSeries, STARTING_CASH, type ValuePoint } from "@/lib/pnlSeries";
import { liveTotalValue, type Portfolio } from "@/lib/portfolioValue";
import { getEntry } from "@/lib/priceStore";
import { usePriceVersion } from "@/lib/usePrice";

const DAY_MS = 86_400_000;
const PLOT_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
const TICK_STYLE = { fontSize: 11, fill: "var(--color-muted)" };
const LINE_STYLE = { stroke: "var(--color-line)" };
const START_LABEL = {
  value: "Start $10,000",
  position: "insideTopLeft",
  fontSize: 11,
  fill: "var(--color-muted)",
} as const;

/** Tooltip body for the hovered point: time, total value and the change vs the starting cash. */
export function PnlTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as ValuePoint;
  const sinceStart = point.value - STARTING_CASH;
  const sinceStartText = formatSignedCurrency(sinceStart);
  return (
    <ChartTooltip time={formatDateClock(point.t)}>
      <p className="flex justify-between gap-2">
        <span className="text-muted">Total value</span>
        <span className="figures text-text">{formatCurrency(point.value)}</span>
      </p>
      <p className="flex justify-between gap-2">
        <span className="text-muted">vs start</span>
        <span className={`figures ${signClass(sinceStart, sinceStartText)}`}>{sinceStartText}</span>
      </p>
    </ChartTooltip>
  );
}

/** Portfolio value line: downsampled history plus a live tail at the header total. */
export function PnlChart({
  history,
  failed,
  portfolio,
}: {
  history: ValuePoint[] | null;
  failed: boolean;
  portfolio: Portfolio | null;
}) {
  usePriceVersion();
  if (failed) {
    return (
      <p role="alert" className="break-words px-2 py-2 text-down">
        Portfolio history unavailable. Reload the page to try again.
      </p>
    );
  }
  if (history === null) return <p className="px-2 py-2 text-muted">Loading portfolio history...</p>;

  const total = portfolio ? liveTotalValue(portfolio, (ticker) => getEntry(ticker)?.price) : undefined;
  const series = buildPnlSeries(history, total, Date.now());
  if (series.length < 2) return <p className="py-12 text-center text-muted">Waiting for portfolio history.</p>;

  const tail = total === undefined ? undefined : series[series.length - 1];
  const spansDay = series[series.length - 1].t - series[0].t >= DAY_MS;
  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={PLOT_MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickCount={4}
            tickFormatter={spansDay ? formatMonthDay : formatHourMinute}
            tick={TICK_STYLE}
            axisLine={LINE_STYLE}
            tickLine={LINE_STYLE}
          />
          <YAxis
            width={64}
            domain={["auto", "auto"]}
            tickCount={4}
            tickFormatter={formatPrice}
            tick={TICK_STYLE}
            axisLine={LINE_STYLE}
            tickLine={LINE_STYLE}
          />
          <ReferenceLine
            y={STARTING_CASH}
            stroke="var(--color-muted)"
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={START_LABEL}
          />
          <Tooltip
            isAnimationActive={false}
            cursor={LINE_STYLE}
            content={(props) => <PnlTooltip active={props.active} payload={props.payload} />}
          />
          <Line dataKey="value" stroke="var(--color-primary)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          {tail && (
            <ReferenceDot x={tail.t} y={tail.value} r={3} fill="var(--color-primary)" stroke="var(--color-surface)" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
