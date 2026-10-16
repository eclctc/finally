"use client";

import { useEffect } from "react";
import { connectPriceStream } from "@/lib/priceStream";
import { testIds } from "@/lib/testIds";
import { Header } from "./Header";
import { Panel } from "./Panel";
import { Watchlist } from "./Watchlist";

/** Terminal layout: header above the titled panels. */
export function Dashboard() {
  useEffect(() => connectPriceStream(), []);

  return (
    <div className="flex h-screen min-w-[1280px] flex-col bg-surface text-text">
      <Header />
      <div className="flex min-h-0 flex-1 gap-px bg-line">
        <main className="grid min-h-0 min-w-0 flex-1 grid-cols-[320px_minmax(0,1fr)] gap-px">
          <Watchlist />
          <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_224px] grid-rows-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.85fr)] gap-px">
            <Panel title="Chart" className="col-span-2" />
            <Panel title="Trade" />
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
