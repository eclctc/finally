import { formatPercent, signClass } from "@/lib/format";
import { sessionChangePercent } from "@/lib/portfolio";
import type { PricePoint, PriceUpdate, WatchlistEntry } from "@/lib/types";
import { FlashingPrice } from "./FlashingPrice";
import { Sparkline } from "./Sparkline";

interface WatchlistRowProps {
  entry: WatchlistEntry;
  update: PriceUpdate | undefined;
  points: PricePoint[];
  selected: boolean;
  onSelect: (ticker: string) => void;
  onRemove: (ticker: string) => void;
}

/** One watched ticker: symbol, live price, session change and sparkline. */
export function WatchlistRow({ entry, update, points, selected, onSelect, onRemove }: WatchlistRowProps) {
  const { ticker } = entry;
  const price = update?.price ?? entry.price;
  const openPrice = update?.open_price ?? entry.open_price;
  const change = price != null && openPrice != null ? sessionChangePercent(price, openPrice) : 0;

  return (
    <li
      data-testid={`watchlist-row-${ticker}`}
      onClick={() => onSelect(ticker)}
      className={`group grid cursor-pointer grid-cols-[3.5rem_1fr_4rem_72px_1rem] items-center gap-2 border-l-2 px-3 py-1.5 hover:bg-raised ${
        selected ? "border-primary bg-raised" : "border-transparent"
      }`}
    >
      <span className="font-medium text-text">{ticker}</span>
      <span className="text-right">
        <FlashingPrice update={update} fallbackPrice={entry.price} testId={`watchlist-price-${ticker}`} />
      </span>
      <span className={`figures text-right text-[12px] ${signClass(change)}`}>{formatPercent(change)}</span>
      <Sparkline points={points} rising={change >= 0} />
      <button
        type="button"
        data-testid={`watchlist-remove-${ticker}`}
        aria-label={`Remove ${ticker} from watchlist`}
        onClick={(event) => {
          event.stopPropagation();
          onRemove(ticker);
        }}
        className="text-muted opacity-0 group-hover:opacity-100 hover:text-down focus-visible:opacity-100"
      >
        ×
      </button>
    </li>
  );
}
