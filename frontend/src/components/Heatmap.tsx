"use client";

import { ResponsiveContainer, Treemap } from "recharts";
import { formatPercent } from "@/lib/format";
import { pnlColor } from "@/lib/heatmap";
import type { Position } from "@/lib/types";
import { Panel } from "./Panel";

interface HeatmapProps {
  positions: Position[];
}

interface TileProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  pnl?: number;
}

function HeatmapTile({ x = 0, y = 0, width = 0, height = 0, name, pnl = 0 }: TileProps) {
  const showLabel = width > 44 && height > 30;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={pnlColor(pnl)} stroke="var(--color-ink)" strokeWidth={2} />
      {showLabel && (
        <>
          <text x={x + 8} y={y + 18} fill="#fff" fontSize={13} fontWeight={600}>
            {name}
          </text>
          <text x={x + 8} y={y + 34} fill="#fff" fillOpacity={0.85} fontSize={11} fontFamily="var(--font-mono)">
            {formatPercent(pnl)}
          </text>
        </>
      )}
    </g>
  );
}

/** Treemap of positions sized by market value and colored by unrealized P&L %. */
export function Heatmap({ positions }: HeatmapProps) {
  const data = positions.map((position) => ({
    name: position.ticker,
    size: position.market_value,
    pnl: position.pnl_percent,
  }));

  return (
    <Panel title="Positions heatmap" testId="heatmap" className="h-full">
      {data.length === 0 ? (
        <p className="p-4 text-muted">Holdings appear here, sized by value and colored by P&L.</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 200 }}>
          <Treemap data={data} dataKey="size" isAnimationActive={false} content={<HeatmapTile />} />
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
