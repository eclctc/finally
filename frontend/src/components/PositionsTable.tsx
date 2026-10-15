import {
  formatCurrency,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatSignedCurrency,
  signClass,
} from "@/lib/format";
import type { Position } from "@/lib/types";

interface PositionsTableProps {
  positions: Position[];
  onSelect: (ticker: string) => void;
}

const HEADINGS = ["Ticker", "Qty", "Avg cost", "Price", "Value", "Unrealized P&L", "Change"];

/** Holdings with live price, market value and unrealized P&L. */
export function PositionsTable({ positions, onSelect }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div data-testid="positions-table" className="p-4 text-muted">
        No positions yet. Buy shares from the trade panel or ask the assistant.
      </div>
    );
  }

  return (
    <table data-testid="positions-table" className="w-full text-right">
      <thead className="sticky top-0 bg-panel text-[11px] text-muted">
        <tr>
          {HEADINGS.map((heading) => (
            <th key={heading} className="px-3 py-1.5 font-normal first:text-left">
              {heading}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="figures">
        {positions.map((position) => (
          <tr
            key={position.ticker}
            data-testid={`position-row-${position.ticker}`}
            onClick={() => onSelect(position.ticker)}
            className="cursor-pointer border-t border-line hover:bg-raised"
          >
            <td className="px-3 py-1.5 text-left font-sans font-medium">{position.ticker}</td>
            <td className="px-3">{formatQuantity(position.quantity)}</td>
            <td className="px-3">{formatPrice(position.avg_cost)}</td>
            <td className="px-3">{formatPrice(position.current_price)}</td>
            <td className="px-3">{formatCurrency(position.market_value)}</td>
            <td className={`px-3 ${signClass(position.unrealized_pnl)}`}>
              {formatSignedCurrency(position.unrealized_pnl)}
            </td>
            <td className={`px-3 ${signClass(position.pnl_percent)}`}>{formatPercent(position.pnl_percent)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
