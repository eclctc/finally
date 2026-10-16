import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makeFrame, makeFrameEntry } from "@/test/fixtures";
import { EMPTY_HISTORY, mergeFrame, setStatus } from "./priceStore";
import { useConnectionStatus, usePriceVersion, useTickerHistory, useTickerPrice } from "./usePrice";

const renders: Record<string, number> = {};

function PriceProbe({ ticker }: { ticker: string }) {
  const entry = useTickerPrice(ticker);
  renders[ticker] = (renders[ticker] ?? 0) + 1;
  return <p data-testid={`probe-${ticker}`}>{entry?.price ?? "none"}</p>;
}

function HistoryProbe({ ticker }: { ticker: string }) {
  const history = useTickerHistory(ticker);
  return <p data-testid={`history-${ticker}`}>{history === EMPTY_HISTORY ? "empty" : history.length}</p>;
}

function StatusProbe() {
  return <p data-testid="status">{useConnectionStatus()}</p>;
}

function VersionProbe() {
  return <p data-testid="version">{usePriceVersion()}</p>;
}

describe("price hooks", () => {
  it("re-renders only the probe whose ticker is in the frame", () => {
    renders.AAPL = 0;
    renders.MSFT = 0;
    render(
      <>
        <PriceProbe ticker="AAPL" />
        <PriceProbe ticker="MSFT" />
      </>,
    );
    const msftBefore = renders.MSFT;
    const aaplBefore = renders.AAPL;
    act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", 190.5, 1))));
    expect(screen.getByTestId("probe-AAPL")).toHaveTextContent("190.5");
    expect(renders.AAPL).toBeGreaterThan(aaplBefore);
    expect(renders.MSFT).toBe(msftBefore);
  });

  it("returns the shared empty history for an unknown ticker and grows after merges", () => {
    render(<HistoryProbe ticker="AAPL" />);
    expect(screen.getByTestId("history-AAPL")).toHaveTextContent("empty");
    act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", 100, 1))));
    act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", 101, 2))));
    expect(screen.getByTestId("history-AAPL")).toHaveTextContent("2");
  });

  it("follows the connection status", () => {
    render(<StatusProbe />);
    expect(screen.getByTestId("status")).toHaveTextContent("reconnecting");
    act(() => setStatus("connected"));
    expect(screen.getByTestId("status")).toHaveTextContent("connected");
  });

  it("follows the price version", () => {
    render(<VersionProbe />);
    act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", 100, 1))));
    expect(screen.getByTestId("version")).toHaveTextContent("1");
  });

  it("server-renders every hook through its server snapshot", () => {
    const markup = renderToString(
      <>
        <PriceProbe ticker="AAPL" />
        <HistoryProbe ticker="AAPL" />
        <StatusProbe />
        <VersionProbe />
      </>,
    );
    expect(markup).toContain("none");
    expect(markup).toContain("empty");
    expect(markup).toContain("reconnecting");
  });
});
