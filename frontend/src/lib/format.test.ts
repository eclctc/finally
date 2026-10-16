import {
  formatCurrency,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatSignedCurrency,
  signClass,
} from "@/lib/format";

/** The E2E suite's own rule for reading a figure back out of the DOM (test/tests/helpers.ts). */
const parseNumber = (text: string) => Number(text.replace(/[^0-9.-]/g, ""));

describe("formatCurrency", () => {
  it("renders the starting cash balance and parses back exactly", () => {
    expect(formatCurrency(10000)).toBe("$10,000.00");
    expect(parseNumber(formatCurrency(10000))).toBe(10000);
  });

  it("rounds half away from zero, as Intl does", () => {
    expect(formatCurrency(0.004)).toBe("$0.00");
    expect(formatCurrency(0.005)).toBe("$0.01");
    expect(formatCurrency(1.005)).toBe("$1.01");
    expect(formatCurrency(-0.005)).toBe("-$0.01");
    expect(formatCurrency(1234.567)).toBe("$1,234.57");
  });

  it("never shows a signed zero", () => {
    expect(formatCurrency(-0.004)).toBe("$0.00");
    expect(Object.is(parseNumber(formatCurrency(-0.004)), 0)).toBe(true);
  });

  it("renders negatives with an ascii minus", () => {
    expect(formatCurrency(-0.006)).toBe("-$0.01");
    expect(formatCurrency(-5)).toBe("-$5.00");
    expect(parseNumber(formatCurrency(-5))).toBe(-5);
  });

  it("renders zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("never abbreviates or uses a unicode minus", () => {
    const text = formatCurrency(-1234567.891);
    expect(text).not.toMatch(/[KM]/);
    expect(text).not.toContain("−");
  });
});

describe("formatSignedCurrency", () => {
  it("puts an explicit sign on gains and losses", () => {
    expect(formatSignedCurrency(12.34)).toBe("+$12.34");
    expect(formatSignedCurrency(-12.34)).toBe("-$12.34");
    expect(formatSignedCurrency(1234.5)).toBe("+$1,234.50");
  });

  it("shows zero and tiny values as an unsigned $0.00", () => {
    expect(formatSignedCurrency(0)).toBe("$0.00");
    expect(formatSignedCurrency(0.001)).toBe("$0.00");
    expect(formatSignedCurrency(-0.004)).toBe("$0.00");
  });

  it("rounds half away from zero", () => {
    expect(formatSignedCurrency(-0.005)).toBe("-$0.01");
  });
});

describe("formatPrice", () => {
  it("renders two decimals without a currency symbol", () => {
    expect(formatPrice(190.5)).toBe("190.50");
    expect(formatPrice(1234.567)).toBe("1,234.57");
  });

  it("rounds once, as Intl does, and never shows a signed zero", () => {
    expect(formatPrice(1.005)).toBe("1.01");
    expect(formatPrice(-0.004)).toBe("0.00");
  });
});

describe("formatQuantity", () => {
  it("shows at most four decimals and drops trailing zeros", () => {
    expect(formatQuantity(0.12345678)).toBe("0.1235");
    expect(formatQuantity(2)).toBe("2");
  });
});

describe("formatPercent", () => {
  it("takes a fraction and signs non-zero values", () => {
    expect(formatPercent(0.0123)).toBe("+1.23%");
    expect(formatPercent(-0.0004)).toBe("-0.04%");
  });

  it("renders zero and values that round to zero without a sign", () => {
    expect(formatPercent(0)).toBe("0.00%");
    expect(formatPercent(-0.00001)).toBe("0.00%");
  });
});

describe("signClass", () => {
  it("is muted when the displayed text rounds to zero", () => {
    expect(signClass(0.00004, formatPercent(0.00004))).toBe("text-muted");
    expect(signClass(-0.00004, formatPercent(-0.00004))).toBe("text-muted");
    expect(signClass(0, formatPercent(0))).toBe("text-muted");
  });

  it("colors a visible positive up and a visible negative down", () => {
    expect(signClass(0.0123, "+1.23%")).toBe("text-up");
    expect(signClass(-0.0001, formatPercent(-0.0001))).toBe("text-down");
  });
});
