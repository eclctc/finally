/** Full SSE entry for one ticker; open price defaults to the price. */
export const makeFrameEntry = (ticker: string, price: number, timestamp: number, openPrice = price) => ({
  ticker,
  price,
  previous_price: price,
  open_price: openPrice,
  timestamp,
  change: 0,
  change_percent: 0,
  direction: "flat",
});

/** SSE frame keyed by ticker. */
export const makeFrame = (...entries: ReturnType<typeof makeFrameEntry>[]) =>
  Object.fromEntries(entries.map((entry) => [entry.ticker, entry]));

/** GET /api/watchlist entry: priced when a price is given, otherwise all price fields null. */
export const makeWatchlistEntry = (ticker: string, price?: number) =>
  price === undefined
    ? {
        ticker,
        price: null,
        previous_price: null,
        open_price: null,
        change: null,
        change_percent: null,
        direction: null,
        timestamp: null,
      }
    : makeFrameEntry(ticker, price, 1);

/** Minimal fetch Response carrying a JSON body. */
export const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;
