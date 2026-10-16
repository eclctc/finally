"use client";

import { memo } from "react";
import { formatPercent, formatPrice, formatQuantity, formatSignedCurrency, signClass } from "@/lib/format";
import { livePosition, type PortfolioPosition } from "@/lib/portfolioValue";
import { testIds } from "@/lib/testIds";
import { useTickerPrice } from "@/lib/usePrice";

const CELL = "border-b border-line px-2";
const NUMBER_CELL = `${CELL} figures whitespace-nowrap text-right`;

/** One position row revalued at the live price; P&L is derived, never the fetch-time API figure. */
export const PositionRow = memo(function PositionRow({ position }: { position: PortfolioPosition }) {
  const entry = useTickerPrice(position.ticker);
  const { price, pnl, pnlFraction } = livePosition(position, entry?.price);
  const pnlText = formatSignedCurrency(pnl);
  const pnlPercentText = formatPercent(pnlFraction);
  return (
    <tr data-testid={testIds.positionRow(position.ticker)} className="h-7">
      <td className={`${CELL} truncate font-semibold text-text`}>{position.ticker}</td>
      <td className={`${NUMBER_CELL} text-text`}>{formatQuantity(position.quantity)}</td>
      <td className={`${NUMBER_CELL} text-text`}>{formatPrice(position.avg_cost)}</td>
      <td className={`${NUMBER_CELL} text-text`}>{formatPrice(price)}</td>
      <td className={`${NUMBER_CELL} ${signClass(pnl, pnlText)}`}>{pnlText}</td>
      <td className={`${NUMBER_CELL} ${signClass(pnlFraction, pnlPercentText)}`}>{pnlPercentText}</td>
    </tr>
  );
});
