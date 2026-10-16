"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/ChartTooltip";
import { formatPercent, formatPrice, signClass } from "@/lib/format";
import { formatClock } from "@/lib/formatTime";
import { HISTORY_LIMIT, type PricePoint } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";
import { useTickerPrice, useTickerSeries } from "@/lib/usePrice";

const PLOT_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
const TICK_STYLE = { fontSize: 11, fill: "var(--color-muted)" };
const LINE_STYLE = { stroke: "var(--color-line)" };
const ACTIVE_DOT = { r: 3, fill: "var(--color-primary)", stroke: "var(--color-surface)" };
const OPEN_LABEL = { value: "Open", position: "insideTopLeft", fontSize: 11, fill: "var(--color-muted)" } as const;

/** Tooltip body for the hovered point: clock time over the price. */
export function PriceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as PricePoint;
  return (
    <ChartTooltip time={formatClock(point.t)}>
      <p className="figures text-text">{formatPrice(point.price)}</p>
    </ChartTooltip>
  );
}

/** Ticker, live price, change vs session open and the history window label. */
function Caption({ ticker, windowFull }: { ticker: string; windowFull: boolean }) {
  const entry = useTickerPrice(ticker);
  const change = entry && (entry.price - entry.openPrice) / entry.openPrice;
  const changeText = change === undefined ? "--" : formatPercent(change);
  return (
    <div className="flex h-7 shrink-0 items-center gap-2 border-b border-line px-2">
      <span className="font-semibold text-text">{ticker}</span>
      <span className="figures text-text">{entry ? formatPrice(entry.price) : "--"}</span>
      <span
        title="Change vs session open"
        className={`figures ${change === undefined ? "text-muted" : signClass(change, changeText)}`}
      >
        {changeText}
      </span>
      <span className="ml-auto text-[11px] text-muted">{windowFull ? "Last 10 min" : "Since page load"}</span>
    </div>
  );
}

/** Caption strip and price plot for the selected ticker. */
function MainChartBody({ ticker }: { ticker: string }) {
  const series = useTickerSeries(ticker);
  const entry = useTickerPrice(ticker);
  return (
    <>
      <Caption ticker={ticker} windowFull={series.length >= HISTORY_LIMIT} />
      {series.length < 2 ? (
        <p className="py-12 text-center text-muted">Waiting for price data.</p>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={PLOT_MARGIN}>
              <CartesianGrid vertical={false} stroke="var(--color-line)" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatClock}
                tickCount={4}
                tick={TICK_STYLE}
                axisLine={LINE_STYLE}
                tickLine={LINE_STYLE}
              />
              <YAxis
                orientation="right"
                width={56}
                domain={["auto", "auto"]}
                tickCount={4}
                tickFormatter={formatPrice}
                tick={TICK_STYLE}
                axisLine={LINE_STYLE}
                tickLine={LINE_STYLE}
              />
              {entry && (
                <ReferenceLine
                  y={entry.openPrice}
                  stroke="var(--color-muted)"
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                  label={OPEN_LABEL}
                />
              )}
              <Tooltip
                isAnimationActive={false}
                cursor={LINE_STYLE}
                content={(props) => <PriceTooltip active={props.active} payload={props.payload} />}
              />
              <Line
                dataKey="price"
                stroke="var(--color-primary)"
                strokeWidth={1.5}
                dot={false}
                activeDot={ACTIVE_DOT}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

/** Main chart wrapper: always mounted, `data-ticker` follows the watchlist selection. */
export function MainChart({ selectedTicker }: { selectedTicker: string | null }) {
  return (
    <div
      data-testid={testIds.mainChart}
      data-ticker={selectedTicker ?? undefined}
      className="flex h-full min-h-0 flex-col"
    >
      {selectedTicker === null ? (
        <p className="py-12 text-center text-muted">Select a ticker from the watchlist.</p>
      ) : (
        <MainChartBody ticker={selectedTicker} />
      )}
    </div>
  );
}
