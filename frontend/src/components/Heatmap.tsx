"use client";

import { ResponsiveContainer, Treemap, type TreemapNode } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/format";
import { livePosition, type Portfolio } from "@/lib/portfolioValue";
import { getEntry } from "@/lib/priceStore";
import { usePriceVersion } from "@/lib/usePrice";

const FULL_COLOR_PNL = 0.05;
const MAX_MIX_PERCENT = 40;
const PERCENT_LABEL_MIN_WIDTH = 64;
const PERCENT_LABEL_MIN_HEIGHT = 40;

/** Tile color: the line color at zero P&L, mixing toward up or down to 40% at +-5%. */
export function tileFill(pnlFraction: number) {
  const mix = MAX_MIX_PERCENT * Math.min(Math.abs(pnlFraction) / FULL_COLOR_PNL, 1);
  if (mix === 0) return "var(--color-line)";
  const direction = pnlFraction > 0 ? "up" : "down";
  return `color-mix(in srgb, var(--color-${direction}) ${mix}%, var(--color-line))`;
}

/** Treemap content renderer: nothing for the root, a titled rect with clipped labels per leaf. */
function renderTile(props: TreemapNode) {
  if (props.depth === 0) return <g />;
  const { x, y, width, height, name } = props;
  const pnlFraction = props.pnlFraction as number;
  const marketValue = props.marketValue as number;
  const showPercent = width >= PERCENT_LABEL_MIN_WIDTH && height >= PERCENT_LABEL_MIN_HEIGHT;
  return (
    <g>
      <title>{`${name}  ${formatCurrency(marketValue)}  ${formatPercent(pnlFraction)}`}</title>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: tileFill(pnlFraction) }}
        stroke="var(--color-surface)"
        strokeWidth={1}
      />
      <svg x={x} y={y} width={width} height={height}>
        <text x={8} y={20} fontSize={13} fontWeight={600} fill="var(--color-text)">
          {name}
        </text>
        {showPercent && (
          <text x={8} y={36} fontSize={11} fill="var(--color-text)">
            {formatPercent(pnlFraction)}
          </text>
        )}
      </svg>
    </g>
  );
}

/** Portfolio treemap: one tile per position, sized by live market value, colored by P&L. */
export function Heatmap({ portfolio, failed }: { portfolio: Portfolio | null; failed: boolean }) {
  usePriceVersion();
  if (portfolio === null && !failed) {
    return <p className="px-2 py-2 text-muted">Loading positions...</p>;
  }
  const data = [...(portfolio?.positions ?? [])]
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
    .map((position) => {
      const { marketValue, pnlFraction } = livePosition(position, getEntry(position.ticker)?.price);
      return { name: position.ticker, value: marketValue, pnlFraction, marketValue };
    });

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={data} dataKey="value" nameKey="name" isAnimationActive={false} content={renderTile} />
      </ResponsiveContainer>
    </div>
  );
}
