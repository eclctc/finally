import { formatPrice } from "@/lib/format";
import type { PriceUpdate } from "@/lib/types";

const FLASH_CLASSES = { up: "flash-up", down: "flash-down", flat: "" };

interface FlashingPriceProps {
  update: PriceUpdate | undefined;
  fallbackPrice: number | null;
  testId: string;
}

/** Price cell that flashes green or red on each tick; keyed so the animation replays. */
export function FlashingPrice({ update, fallbackPrice, testId }: FlashingPriceProps) {
  return (
    <span
      key={update?.timestamp}
      data-testid={testId}
      className={`figures rounded-sm px-1 ${update ? FLASH_CLASSES[update.direction] : ""}`}
    >
      {formatPrice(update?.price ?? fallbackPrice)}
    </span>
  );
}
