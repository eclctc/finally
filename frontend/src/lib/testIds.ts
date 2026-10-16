/** Skeleton so the RED run fails on assertions, not on a missing module. */
export const testIds = {
  tradeBuy: "",
  tradeSell: "",
  chatError: "",
  watchlistRow: (_ticker: string) => "",
  watchlistPrice: (_ticker: string) => "",
  watchlistRemove: (_ticker: string) => "",
  positionRow: (_ticker: string) => "",
} as const;
