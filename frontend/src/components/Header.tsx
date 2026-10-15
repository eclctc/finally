import { formatCurrency, formatSignedCurrency, signClass } from "@/lib/format";
import type { ConnectionStatus } from "@/lib/types";
import { ConnectionDot } from "./ConnectionDot";

interface HeaderProps {
  totalValue: number | null;
  cashBalance: number | null;
  unrealizedPnl: number | null;
  status: ConnectionStatus;
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-[11px] text-muted">{label}</span>
      {children}
    </div>
  );
}

/** Top bar: brand, live portfolio value, cash, P&L and stream status. */
export function Header({ totalValue, cashBalance, unrealizedPnl, status }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-8 border-b border-line bg-panel px-4">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold tracking-tight text-text">
          Fin<span className="text-accent">Ally</span>
        </span>
        <span className="hidden text-muted sm:inline">Trading workstation</span>
      </div>
      <div className="ml-auto flex items-center gap-8">
        <Figure label="Portfolio value">
          <span data-testid="total-value" className="figures text-xl font-medium text-accent">
            {totalValue == null ? "--" : formatCurrency(totalValue)}
          </span>
        </Figure>
        <Figure label="Unrealized P&L">
          <span className={`figures text-sm ${signClass(unrealizedPnl ?? 0)}`}>
            {unrealizedPnl == null ? "--" : formatSignedCurrency(unrealizedPnl)}
          </span>
        </Figure>
        <Figure label="Cash">
          <span data-testid="cash-balance" className="figures text-sm text-text">
            {cashBalance == null ? "--" : formatCurrency(cashBalance)}
          </span>
        </Figure>
        <ConnectionDot status={status} />
      </div>
    </header>
  );
}
