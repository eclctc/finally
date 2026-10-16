import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Heatmap } from "@/components/Heatmap";
import { makePortfolio, makePosition } from "@/test/fixtures";

const twoPositions = () =>
  makePortfolio(5000, [makePosition("JPM", 10, 200, 210), makePosition("AAPL", 5, 200, 190)]);

const tileRect = (container: HTMLElement, ticker: string) =>
  Array.from(container.querySelectorAll("svg rect")).find((rect) =>
    rect.parentElement?.querySelector("title")?.textContent?.startsWith(ticker),
  ) as SVGRectElement;

describe("Heatmap Treemap spike", () => {
  it("makes a tile rect the first svg rect, with a positive width and a ticker title beside it", () => {
    const { container } = render(<Heatmap portfolio={twoPositions()} failed={false} />);
    const first = container.querySelector("svg rect");
    expect(Number(first?.getAttribute("width"))).toBeGreaterThan(0);
    expect(first?.parentElement?.querySelector("title")?.textContent).toMatch(/^(JPM|AAPL)/);
  });

  it("suppresses the root and draws one tile rect per position", () => {
    const { container } = render(<Heatmap portfolio={twoPositions()} failed={false} />);
    const rects = Array.from(container.querySelectorAll("svg rect"));
    expect(rects).toHaveLength(2);
    expect(rects.some((r) => r.getAttribute("width") === "800" && r.getAttribute("height") === "400")).toBe(false);
  });

  it("prints each ticker as text", () => {
    const { container } = render(<Heatmap portfolio={twoPositions()} failed={false} />);
    expect(container.textContent).toContain("JPM");
    expect(container.textContent).toContain("AAPL");
  });

  it("delivers the extra data fields to the renderer: gain and loss fills differ, title carries the value", () => {
    const { container } = render(<Heatmap portfolio={twoPositions()} failed={false} />);
    expect(tileRect(container, "JPM").style.fill).toContain("--color-up");
    expect(tileRect(container, "AAPL").style.fill).toContain("--color-down");
    expect(tileRect(container, "JPM").parentElement?.querySelector("title")?.textContent).toContain("$2,100.00");
  });

  it("emits no clip-path element", () => {
    const { container } = render(<Heatmap portfolio={twoPositions()} failed={false} />);
    expect(container.querySelector("clipPath, defs")).toBeNull();
  });
});
