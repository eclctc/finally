import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { clearTicker, mergeFrame } from "@/lib/priceStore";
import { useTickerHistory } from "@/lib/usePrice";
import { makeFrame, makeFrameEntry } from "@/test/fixtures";
import { Sparkline } from "./Sparkline";

const lineOf = (container: HTMLElement) => container.querySelector("path.recharts-line-curve");

function Probe() {
  return <Sparkline history={useTickerHistory("AAPL")} />;
}

const tick = (price: number, timestamp: number) =>
  act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", price, timestamp))));

describe("Sparkline", () => {
  it.each([[[]], [[190]]])("renders only the empty 64x20 box for %j", (history) => {
    const { container } = render(<Sparkline history={history} />);
    const box = container.firstElementChild as HTMLElement;
    expect(box).toHaveClass("h-5", "w-16", "shrink-0");
    expect(box).toHaveAttribute("aria-hidden", "true");
    expect(box).toHaveAttribute("title", "Since page load");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("draws one line in the up color when the last point is above the first", () => {
    const { container } = render(<Sparkline history={[1, 2]} />);
    expect(container.querySelectorAll("path.recharts-line-curve")).toHaveLength(1);
    expect(lineOf(container)).toHaveAttribute("stroke", "var(--color-up)");
  });

  it("uses the down color when the last point is below the first", () => {
    const { container } = render(<Sparkline history={[2, 1]} />);
    expect(lineOf(container)).toHaveAttribute("stroke", "var(--color-down)");
  });

  it("uses the muted color when the last point equals the first", () => {
    const { container } = render(<Sparkline history={[1, 2, 1]} />);
    expect(lineOf(container)).toHaveAttribute("stroke", "var(--color-muted)");
  });

  it("adds no keyboard focus stop", () => {
    const { container } = render(<Sparkline history={[1, 2, 3]} />);
    expect(container.querySelector("[tabindex]")).toBeNull();
  });

  it("fills in tick by tick and empties again after clearTicker", () => {
    const { container } = render(<Probe />);
    tick(190, 1);
    expect(lineOf(container)).toBeNull();
    tick(191, 2);
    expect(lineOf(container)).not.toBeNull();
    act(() => clearTicker("AAPL"));
    expect(lineOf(container)).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });
});
