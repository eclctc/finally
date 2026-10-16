"use client";

import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useTickerSeries } from "@/lib/usePrice";
import { testIds } from "@/lib/testIds";

const PLOT_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };

/** Caption strip and price line for the selected ticker. */
function MainChartBody({ ticker }: { ticker: string }) {
  const series = useTickerSeries(ticker);
  return (
    <>
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-line px-2">
        <span className="font-semibold text-text">{ticker}</span>
      </div>
      {series.length < 2 ? (
        <p className="py-12 text-center text-muted">Waiting for price data.</p>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={PLOT_MARGIN}>
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} />
              <YAxis orientation="right" width={56} domain={["auto", "auto"]} />
              <Line
                dataKey="price"
                stroke="var(--color-primary)"
                strokeWidth={1.5}
                dot={false}
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
