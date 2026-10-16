"use client";

import { ConnectionDot } from "@/components/ConnectionDot";
import { formatCurrency } from "@/lib/format";
import { liveTotalValue } from "@/lib/portfolioValue";
import { getEntry } from "@/lib/priceStore";
import { testIds } from "@/lib/testIds";
import { usePortfolio } from "@/lib/usePortfolio";
import { usePriceVersion } from "@/lib/usePrice";

const show = (n?: number) => (n === undefined ? "--" : formatCurrency(n));

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1 leading-tight">
      <span className="text-[11px] text-muted">{label}</span>
      {children}
    </div>
  );
}

/** Top bar: brand, live portfolio value, cash from the backend, and stream status. */
export function Header() {
  const { portfolio, failed } = usePortfolio();
  usePriceVersion();
  const total = portfolio ? liveTotalValue(portfolio, (ticker) => getEntry(ticker)?.price) : undefined;

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-line bg-panel px-4">
      <h1 className="text-lg font-semibold leading-tight text-text">
        Fin<span className="text-accent">Ally</span>
      </h1>
      <div className="ml-auto flex items-center gap-8">
        {failed && (
          <span role="alert" className="shrink-0 whitespace-nowrap text-[11px] text-down">
            Portfolio unavailable. Reload the page to try again.
          </span>
        )}
        <Figure label="Portfolio value">
          <span data-testid={testIds.totalValue} className="figures whitespace-nowrap text-xl leading-tight text-accent">
            {show(total)}
          </span>
        </Figure>
        <Figure label="Cash">
          <span data-testid={testIds.cashBalance} className="figures whitespace-nowrap text-text">
            {show(portfolio?.cash_balance)}
          </span>
        </Figure>
        <ConnectionDot />
      </div>
    </header>
  );
}
