import { describe, expect, it } from "vitest";
import { formatClock } from "./formatTime";

describe("formatClock", () => {
  it.each([
    [new Date(2026, 9, 16, 0, 5, 3), "00:05:03"],
    [new Date(2026, 9, 16, 14, 32, 5), "14:32:05"],
  ])("renders 24-hour local time with seconds for %s", (date, expected) => {
    expect(formatClock(date.getTime())).toBe(expected);
  });
});
