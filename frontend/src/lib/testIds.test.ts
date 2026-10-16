import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { testIds } from "@/lib/testIds";

const specDir = resolve(__dirname, "../../../test/tests");

const perTickerHelpers = [
  testIds.watchlistRow,
  testIds.watchlistPrice,
  testIds.watchlistRemove,
  testIds.positionRow,
];

const staticIds = Object.values(testIds).filter((value): value is string => typeof value === "string");
const helperPrefixes = perTickerHelpers.map((helper) => helper(""));
const knownIds = new Set([...staticIds, ...helperPrefixes]);

const getByTestIdPattern = /getByTestId\(\s*(["'`])(.*?)\1/g;
const selectorPattern = /data-testid\^?=(["'])(.*?)\1/g;

interface ExtractedId {
  id: string;
  fromTemplate: boolean;
}

function extractIds(source: string): ExtractedId[] {
  const found: ExtractedId[] = [];
  for (const match of source.matchAll(getByTestIdPattern)) {
    const quote = match[1];
    const raw = match[2];
    const fromTemplate = quote === "`" && raw.includes("${");
    found.push({ id: fromTemplate ? raw.slice(0, raw.indexOf("${")) : raw, fromTemplate });
  }
  for (const match of source.matchAll(selectorPattern)) {
    found.push({ id: match[2], fromTemplate: false });
  }
  return found;
}

function isCovered({ id, fromTemplate }: ExtractedId): boolean {
  if (knownIds.has(id)) return true;
  if (helperPrefixes.some((prefix) => id.startsWith(prefix))) return true;
  return fromTemplate && [...knownIds].some((known) => known.startsWith(id));
}

const specFiles = readdirSync(specDir).filter((name) => name.endsWith(".spec.ts"));
const extracted = specFiles.flatMap((name) => extractIds(readFileSync(`${specDir}/${name}`, "utf8")));

describe("testIds parity with the Playwright specs", () => {
  it("reads at least 6 spec files and 25 distinct ids", () => {
    expect(specFiles.length).toBeGreaterThanOrEqual(6);
    expect(new Set(extracted.map((entry) => entry.id)).size).toBeGreaterThanOrEqual(25);
  });

  it("covers every id the specs reference", () => {
    const uncovered = [...new Set(extracted.filter((entry) => !isCovered(entry)).map((entry) => entry.id))];
    expect(uncovered).toEqual([]);
  });
});

describe("testIds values", () => {
  it("builds the trade button ids that trading.spec derives from the side", () => {
    expect(testIds.tradeBuy).toBe("trade-buy");
    expect(testIds.tradeSell).toBe("trade-sell");
  });

  it("includes the chat error id from the team contract", () => {
    expect(testIds.chatError).toBe("chat-error");
  });

  it("builds per-ticker ids", () => {
    expect(testIds.watchlistRow("AAPL")).toBe("watchlist-row-AAPL");
    expect(testIds.positionRow("MSFT")).toBe("position-row-MSFT");
  });

  it("returns the bare prefix for an empty ticker", () => {
    expect(testIds.watchlistRow("")).toBe("watchlist-row-");
    expect(testIds.watchlistPrice("")).toBe("watchlist-price-");
    expect(testIds.watchlistRemove("")).toBe("watchlist-remove-");
    expect(testIds.positionRow("")).toBe("position-row-");
  });

  it("keeps the watchlist-row- prefix exclusive to watchlistRow", () => {
    const others = [
      ...staticIds,
      testIds.watchlistPrice("AAPL"),
      testIds.watchlistRemove("AAPL"),
      testIds.positionRow("AAPL"),
    ];
    expect(others.filter((id) => id.startsWith("watchlist-row-"))).toEqual([]);
  });
});
