"use client";

import { useCallback, useEffect } from "react";
import type { Portfolio } from "@/lib/portfolioValue";
import { connectPriceStream } from "@/lib/priceStream";
import { testIds } from "@/lib/testIds";
import { usePortfolio } from "@/lib/usePortfolio";
import { Header } from "./Header";
import { Panel } from "./Panel";
import { TradeBar } from "./TradeBar";
import { Watchlist } from "./Watchlist";

/** Terminal layout: header above the titled panels; owns the one shared portfolio source. */
export function Dashboard() {
  const { portfolio, failed, setPortfolio } = usePortfolio();
  useEffect(() => connectPriceStream(), []);

  const handleFilled = useCallback((next: Portfolio) => setPortfolio(next), [setPortfolio]);

  return (
    <div className="flex h-screen min-w-[1280px] flex-col bg-surface text-text">
      <Header portfolio={portfolio} failed={failed} />
      <div className="flex min-h-0 flex-1 gap-px bg-line">
        <main className="grid min-h-0 min-w-0 flex-1 grid-cols-[320px_minmax(0,1fr)] gap-px">
          <Watchlist />
          <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_224px] grid-rows-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.85fr)] gap-px">
            <Panel title="Chart" className="col-span-2" />
            <Panel title="Trade">
              <TradeBar onFilled={handleFilled} />
            </Panel>
            <Panel title="Heatmap" testId={testIds.heatmap} />
            <Panel title="P&L" testId={testIds.pnlChart} className="col-span-2" />
            <Panel title="Positions" testId={testIds.positionsTable} className="col-span-3" />
          </div>
        </main>
        <aside className="w-[320px] shrink-0">
          <Panel title="AI Chat" testId={testIds.chatPanel} className="h-full" />
        </aside>
      </div>
    </div>
  );
}
