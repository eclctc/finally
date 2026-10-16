"use client";

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { buildPnlSeries, type ValuePoint } from "@/lib/pnlSeries";
import { liveTotalValue, type Portfolio } from "@/lib/portfolioValue";
import { getEntry } from "@/lib/priceStore";
import { usePriceVersion } from "@/lib/usePrice";

const PLOT_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };

/** Portfolio value line: downsampled history plus a live tail at the header total. */
export function PnlChart({
  history,
  portfolio,
}: {
  history: ValuePoint[] | null;
  failed: boolean;
  portfolio: Portfolio | null;
}) {
  usePriceVersion();
  if (history === null) return <p className="px-2 py-2 text-muted">Loading portfolio history...</p>;

  const total = portfolio ? liveTotalValue(portfolio, (ticker) => getEntry(ticker)?.price) : undefined;
  const series = buildPnlSeries(history, total, Date.now());
  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={PLOT_MARGIN}>
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} />
          <YAxis width={64} domain={["auto", "auto"]} />
          <Line dataKey="value" stroke="var(--color-primary)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
