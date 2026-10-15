"use client";

import { useState } from "react";
import { useChat } from "@/hooks/useChat";
import { usePortfolio } from "@/hooks/usePortfolio";
import { usePriceStream } from "@/hooks/usePriceStream";
import { useWatchlist } from "@/hooks/useWatchlist";
import { submitTrade } from "@/lib/api";
import { revaluePortfolio } from "@/lib/portfolio";
import type { TradeSide } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";
import { Header } from "./Header";
import { Heatmap } from "./Heatmap";
import { MainChart } from "./MainChart";
import { Panel } from "./Panel";
import { PnlChart } from "./PnlChart";
import { PositionsTable } from "./PositionsTable";
import { TradeBar } from "./TradeBar";
import { Watchlist } from "./Watchlist";

/** The full trading workstation: wires live data into every panel. */
export function Dashboard() {
  const { prices, history, status } = usePriceStream();
  const { portfolio, snapshots, refresh: refreshPortfolio } = usePortfolio();
  const watchlist = useWatchlist();
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [tradeTicker, setTradeTicker] = useState<string | null>(null);
  const chat = useChat(() => {
    refreshPortfolio();
    watchlist.refresh();
  });

  const livePortfolio = portfolio ? revaluePortfolio(portfolio, prices) : null;
  const positions = livePortfolio?.positions ?? [];
  const activeTicker = selectedTicker ?? watchlist.entries[0]?.ticker ?? null;

  function selectTicker(ticker: string) {
    setSelectedTicker(ticker);
    setTradeTicker(ticker);
  }

  async function trade(ticker: string, quantity: number, side: TradeSide) {
    await submitTrade(ticker, quantity, side);
    await refreshPortfolio();
  }

  return (
    <div className="flex h-screen min-w-[1024px] flex-col">
      <Header
        totalValue={livePortfolio?.total_value ?? null}
        cashBalance={livePortfolio?.cash_balance ?? null}
        unrealizedPnl={livePortfolio?.unrealized_pnl ?? null}
        status={status}
      />
      <div className="flex min-h-0 flex-1">
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(300px,340px)_1fr] gap-px bg-line">
          <Watchlist
            entries={watchlist.entries}
            prices={prices}
            history={history}
            selectedTicker={activeTicker}
            onSelect={selectTicker}
            onAdd={watchlist.add}
            onRemove={watchlist.remove}
          />
          <div className="grid min-h-0 grid-cols-[1fr_1fr_260px] grid-rows-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.85fr)] gap-px">
            <div className="col-span-2 min-h-0">
              <MainChart
                ticker={activeTicker}
                points={activeTicker ? (history[activeTicker] ?? []) : []}
                update={activeTicker ? prices[activeTicker] : undefined}
              />
            </div>
            <Panel title="Trade">
              <TradeBar ticker={tradeTicker ?? activeTicker ?? ""} onTickerChange={setTradeTicker} onTrade={trade} />
            </Panel>
            <Heatmap positions={positions} />
            <div className="col-span-2 min-h-0">
              <PnlChart snapshots={snapshots} />
            </div>
            <div className="col-span-3 min-h-0">
              <Panel title="Positions" className="h-full">
                <div className="h-full overflow-auto">
                  <PositionsTable positions={positions} onSelect={selectTicker} />
                </div>
              </Panel>
            </div>
          </div>
        </main>
        <ChatPanel entries={chat.entries} loading={chat.loading} error={chat.error} onSend={chat.send} />
      </div>
    </div>
  );
}
