/**
 * Figures are bare en-US numbers the E2E `parseNumber` rule reads back exactly.
 * Never add labels, units or abbreviations. A fixed locale avoids prerender hydration mismatches.
 */
const cents = (n: number) => Math.round(n * 100) / 100 + 0; // "+ 0" turns -0 into 0

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const decimal2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

export const formatCurrency = (n: number) => currency.format(cents(n));
export const formatPrice = (n: number) => decimal2.format(cents(n));
export const formatQuantity = (n: number) => quantity.format(n);
/** Input is a fraction: 0.0123 means 1.23%. */
export const formatPercent = (fraction: number) => percent.format(fraction);
