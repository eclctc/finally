"use client";

import type { Portfolio } from "@/lib/portfolioValue";
import { PositionRow } from "./PositionRow";

const HEAD_CELL = "sticky top-0 h-7 border-b border-line bg-panel px-2 text-[11px] font-normal text-muted";

function PositionsEmpty() {
  return (
    <div className="py-12 text-center">
      <p className="font-semibold text-text">No positions</p>
      <p className="text-muted">Buy shares from the Trade panel to see them here.</p>
    </div>
  );
}

interface PositionsTableProps {
  portfolio: Portfolio | null;
  failed: boolean;
}

/** Positions table: rows sorted by ticker, each revalued at its live price. */
export function PositionsTable({ portfolio, failed }: PositionsTableProps) {
  if (failed) {
    return (
      <p role="alert" className="break-words px-2 py-2 text-down">
        Positions unavailable. Reload the page to try again.
      </p>
    );
  }
  if (portfolio === null) return <p className="px-2 py-2 text-muted">Loading positions...</p>;
  if (portfolio.positions.length === 0) return <PositionsEmpty />;
  const positions = [...portfolio.positions].sort((a, b) => a.ticker.localeCompare(b.ticker));
  return (
    <table className="w-full table-fixed border-separate border-spacing-0">
      <colgroup>
        <col className="w-24" />
        <col className="w-[104px]" />
        <col className="w-[104px]" />
        <col className="w-[104px]" />
        <col />
        <col className="w-24" />
      </colgroup>
      <thead>
        <tr>
          <th className={`${HEAD_CELL} text-left`}>Ticker</th>
          <th className={`${HEAD_CELL} text-right`}>Qty</th>
          <th className={`${HEAD_CELL} text-right`}>Avg cost</th>
          <th className={`${HEAD_CELL} text-right`}>Price</th>
          <th className={`${HEAD_CELL} text-right`} title="Unrealized P&L">
            P&L
          </th>
          <th className={`${HEAD_CELL} text-right`} title="Unrealized P&L vs average cost">
            P&L %
          </th>
        </tr>
      </thead>
      <tbody>
        {positions.map((position) => (
          <PositionRow key={position.ticker} position={position} />
        ))}
      </tbody>
    </table>
  );
}
