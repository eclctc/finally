/** Pure helpers that turn portfolio snapshots into the plotted P&L series. */

export const STARTING_CASH = 10_000;
export const PNL_POINTS = 300;

export interface ValuePoint {
  t: number;
  value: number;
}

/** One entry of GET /api/portfolio/history. */
export interface Snapshot {
  total_value: number;
  recorded_at: string;
}

/** Epoch ms of a backend timestamp; its six fraction digits are trimmed to the three ECMAScript defines. */
export const snapshotTime = (recordedAt: string) => Date.parse(recordedAt.replace(/(\.\d{3})\d+/, "$1"));

/** At most `target` evenly spaced items in order, always keeping the first and the last. */
export function downsample<T>(items: readonly T[], target = PNL_POINTS): T[] {
  if (items.length <= target) return [...items];
  return Array.from({ length: target }, (_, i) => items[Math.round((i * (items.length - 1)) / (target - 1))]);
}

/** Downsampled history plus a live tail at `totalNow`; the tail never runs earlier than the last point. */
export function buildPnlSeries(history: readonly ValuePoint[], totalNow: number | undefined, now: number): ValuePoint[] {
  const series = downsample(history);
  if (totalNow === undefined) return series;
  const lastT = series.length ? series[series.length - 1].t : now;
  return [...series, { t: Math.max(now, lastT), value: totalNow }];
}
