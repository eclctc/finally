/**
 * Figures are bare en-US numbers the E2E `parseNumber` rule reads back exactly.
 * Never add labels, units or abbreviations. A fixed locale avoids prerender hydration mismatches.
 * Intl does the only rounding; the guard below just keeps a tiny negative from showing as "-0.00".
 */
const noNegativeZero = (n: number) => (Math.abs(n) < 0.005 ? 0 : n);

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const signedCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  signDisplay: "exceptZero",
});
const decimal2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export const formatCurrency = (n: number) => currency.format(noNegativeZero(n));
/** Dollar P&L with an explicit "+" on gains: "+$12.34", "-$12.34", "$0.00". */
export const formatSignedCurrency = (n: number) => signedCurrency.format(noNegativeZero(n));
export const formatPrice = (n: number) => decimal2.format(noNegativeZero(n));
export const formatQuantity = (n: number) => quantity.format(n);
/** Input is a fraction: 0.0123 means 1.23%. */
export const formatPercent = (fraction: number) => percent.format(fraction);
/** Color class for a signed value by its displayed text: muted when it shows as zero. */
export const signClass = (value: number, displayed: string) => {
  if (!/[1-9]/.test(displayed)) return "text-muted";
  return value > 0 ? "text-up" : "text-down";
};
