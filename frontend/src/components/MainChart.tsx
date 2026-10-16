"use client";

import { testIds } from "@/lib/testIds";

/** Caption strip and (from Plan 04-03) plot for the selected ticker. */
function MainChartBody({ ticker }: { ticker: string }) {
  return (
    <div className="flex h-7 shrink-0 items-center gap-2 border-b border-line px-2">
      <span className="font-semibold text-text">{ticker}</span>
    </div>
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
