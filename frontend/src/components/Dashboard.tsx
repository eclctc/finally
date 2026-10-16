"use client";

import { useCallback, useEffect, useState } from "react";
import type { Portfolio } from "@/lib/portfolioValue";
import { connectPriceStream } from "@/lib/priceStream";
import { testIds } from "@/lib/testIds";
import { usePortfolio } from "@/lib/usePortfolio";
import { usePortfolioHistory } from "@/lib/usePortfolioHistory";
import { Header } from "./Header";
import { Heatmap } from "./Heatmap";
import { MainChart } from "./MainChart";
import { Panel } from "./Panel";
import { PnlChart } from "./PnlChart";
import { PositionsTable } from "./PositionsTable";
import { TradeBar } from "./TradeBar";
import { Watchlist } from "./Watchlist";

/** Terminal layout: header above the titled panels; owns the one shared portfolio source. */
export function Dashboard() {
  const { portfolio, failed, setPortfolio, refresh } = usePortfolio();
  const { history, failed: historyFailed, refresh: refreshHistory } = usePortfolioHistory();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  useEffect(() => connectPriceStream(), []);

  const handleFilled = useCallback(
    (next: Portfolio) => {
      setPortfolio(next);
      refreshHistory();
    },
    [setPortfolio, refreshHistory],
  );

  return (
    <div className="flex h-screen min-w-[1280px] flex-col bg-surface text-text">
      <Header portfolio={portfolio} failed={failed} />
      <div className="flex min-h-0 flex-1 gap-px bg-line">
        <main className="grid min-h-0 min-w-0 flex-1 grid-cols-[320px_minmax(0,1fr)] gap-px">
          <Watchlist selectedTicker={selectedTicker} onSelect={setSelectedTicker} />
          <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_224px] grid-rows-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.85fr)] gap-px">
            <Panel title="Chart" className="col-span-2">
              <MainChart selectedTicker={selectedTicker} />
            </Panel>
            <Panel title="Trade">
              <TradeBar selectedTicker={selectedTicker} onFilled={handleFilled} onUnconfirmed={refresh} />
            </Panel>
            <Panel title="Heatmap" testId={testIds.heatmap}>
              <Heatmap portfolio={portfolio} failed={failed} />
            </Panel>
            <Panel title="P&L" testId={testIds.pnlChart} className="col-span-2">
              <PnlChart history={history} failed={historyFailed} portfolio={portfolio} />
            </Panel>
            <Panel title="Positions" testId={testIds.positionsTable} className="col-span-3">
              <PositionsTable portfolio={portfolio} failed={failed} />
            </Panel>
          </div>
        </main>
        <aside className="w-[320px] shrink-0">
          <Panel title="AI Chat" testId={testIds.chatPanel} className="h-full" />
        </aside>
      </div>
    </div>
  );
}
