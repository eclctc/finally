import { describe, expect, it } from "vitest";
import { buildPnlSeries, downsample, PNL_POINTS, snapshotTime, type ValuePoint } from "@/lib/pnlSeries";

const indices = (n: number) => Array.from({ length: n }, (_, i) => i);
const points = (n: number): ValuePoint[] => indices(n).map((i) => ({ t: 1000 + i, value: 10000 + i }));

describe("downsample", () => {
  it("returns an equal but distinct array at exactly 300 items", () => {
    const items = indices(PNL_POINTS);
    const out = downsample(items);
    expect(out).toEqual(items);
    expect(out).not.toBe(items);
  });

  it.each([301, 1000, 20160])("reduces %i items to 300 with strictly increasing indices, first and last kept", (n) => {
    const out = downsample(indices(n));
    expect(out).toHaveLength(300);
    expect(out[0]).toBe(0);
    expect(out[299]).toBe(n - 1);
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThan(out[i - 1]);
  });

  it("returns an empty array for no items", () => {
    expect(downsample([])).toEqual([]);
  });
});

describe("buildPnlSeries", () => {
  const history: ValuePoint[] = [
    { t: 1000, value: 10000 },
    { t: 2000, value: 10100 },
  ];

  it("appends a tail at now when now is after the last point", () => {
    expect(buildPnlSeries(history, 10500, 3000)).toEqual([...history, { t: 3000, value: 10500 }]);
  });

  it("uses the last point's time when now is earlier, keeping both points", () => {
    expect(buildPnlSeries(history, 10500, 1500)).toEqual([...history, { t: 2000, value: 10500 }]);
  });

  it("uses the last point's time when now is equal, keeping both points", () => {
    expect(buildPnlSeries(history, 10500, 2000)).toEqual([...history, { t: 2000, value: 10500 }]);
  });

  it("is one point for an empty history with a tail", () => {
    expect(buildPnlSeries([], 10500, 3000)).toEqual([{ t: 3000, value: 10500 }]);
  });

  it("adds no tail when there is no total", () => {
    expect(buildPnlSeries(history, undefined, 3000)).toEqual(history);
  });

  it("downsamples a 20,160-point history to 300 and keeps the tail last", () => {
    const series = buildPnlSeries(points(20160), 10500, 99999);
    expect(series).toHaveLength(301);
    expect(series[300]).toEqual({ t: 99999, value: 10500 });
    expect(series[299]).toEqual({ t: 1000 + 20159, value: 10000 + 20159 });
  });

  it("keeps the backend order", () => {
    const series = buildPnlSeries(points(1000), 1, 5000);
    for (let i = 1; i < series.length; i++) expect(series[i].t).toBeGreaterThanOrEqual(series[i - 1].t);
  });
});

describe("snapshotTime", () => {
  it("trims six fraction digits to milliseconds", () => {
    expect(snapshotTime("2026-10-16T21:00:59.139123+00:00")).toBe(1792184459139);
  });

  it("parses a timestamp without a fraction", () => {
    expect(snapshotTime("2026-10-16T21:00:59+00:00")).toBe(1792184459000);
  });
});
