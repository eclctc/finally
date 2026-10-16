import { describe, expect, it } from "vitest";
import { formatClock, formatDateClock, formatHourMinute, formatMonthDay } from "./formatTime";

describe("formatClock", () => {
  it.each([
    [new Date(2026, 9, 16, 0, 5, 3), "00:05:03"],
    [new Date(2026, 9, 16, 14, 32, 5), "14:32:05"],
  ])("renders 24-hour local time with seconds for %s", (date, expected) => {
    expect(formatClock(date.getTime())).toBe(expected);
  });
});

describe("P&L time labels", () => {
  it("formatDateClock renders the month, day and 24-hour time with seconds", () => {
    expect(formatDateClock(new Date(2026, 9, 16, 14, 32, 5).getTime())).toBe("Oct 16, 14:32:05");
  });

  it("formatHourMinute renders a zero-padded 24-hour HH:MM", () => {
    expect(formatHourMinute(new Date(2026, 9, 16, 0, 5).getTime())).toBe("00:05");
  });

  it("formatMonthDay renders the short month and day", () => {
    expect(formatMonthDay(new Date(2026, 9, 16).getTime())).toBe("Oct 16");
  });
});
