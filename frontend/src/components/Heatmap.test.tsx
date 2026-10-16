import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Heatmap, tileFill } from "@/components/Heatmap";
import { mergeFrame } from "@/lib/priceStore";
import { makeFrame, makeFrameEntry, makePortfolio, makePosition } from "@/test/fixtures";

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

const tileTitle = (container: HTMLElement, ticker: string) =>
  tileRect(container, ticker).parentElement?.querySelector("title")?.textContent;

describe("Heatmap states", () => {
  it("shows the loading line and no svg before the first load", () => {
    const { container } = render(<Heatmap portfolio={null} failed={false} />);
    expect(screen.getByText("Loading positions...")).toHaveClass("text-muted");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("shows an alert when the first load failed", () => {
    render(<Heatmap portfolio={null} failed />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Positions unavailable. Reload the page to try again.");
    expect(alert).toHaveClass("text-down");
  });

  it("shows the empty state with no svg for zero positions", () => {
    const { container } = render(<Heatmap portfolio={makePortfolio(10000)} failed={false} />);
    expect(screen.getByText("No positions to chart yet.")).toHaveClass("py-12", "text-center", "text-muted");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("fills the whole well with one tile for one position", () => {
    const { container } = render(
      <Heatmap portfolio={makePortfolio(5000, [makePosition("JPM", 10, 200, 210)])} failed={false} />,
    );
    const rects = container.querySelectorAll("svg rect");
    expect(rects).toHaveLength(1);
    expect(rects[0]).toHaveAttribute("width", "800");
    expect(rects[0]).toHaveAttribute("height", "400");
  });

  it("names the well as an image with the position count", () => {
    render(<Heatmap portfolio={twoPositions()} failed={false} />);
    expect(
      screen.getByRole("img", {
        name: "Portfolio heatmap, 2 positions, sized by market value, colored by profit or loss",
      }),
    ).toBeInTheDocument();
  });
});

describe("Heatmap tiles", () => {
  it("prints the percent label only on tiles of at least 64 x 40", () => {
    const portfolio = makePortfolio(0, [makePosition("AAPL", 50, 200, 200), makePosition("JPM", 0.05, 200, 200)]);
    const { container } = render(<Heatmap portfolio={portfolio} failed={false} />);
    const textsIn = (ticker: string) => tileRect(container, ticker).parentElement?.querySelectorAll("text");
    expect(textsIn("JPM")).toHaveLength(1);
    expect(textsIn("AAPL")).toHaveLength(2);
  });

  it("reads ticker, market value and percent in the native tooltip", () => {
    const { container } = render(<Heatmap portfolio={twoPositions()} failed={false} />);
    expect(tileTitle(container, "JPM")).toBe("JPM  $2,100.00  +5.00%");
  });

  it("has no click or hover handlers on a tile", () => {
    const { container } = render(<Heatmap portfolio={twoPositions()} failed={false} />);
    const tile = tileRect(container, "JPM").parentElement!;
    expect(tile.onclick).toBeNull();
    expect(tile.onmouseenter).toBeNull();
  });

  it("re-values a tile from the live store price", () => {
    const { container } = render(<Heatmap portfolio={twoPositions()} failed={false} />);
    act(() => mergeFrame(makeFrame(makeFrameEntry("JPM", 220, 2))));
    expect(tileTitle(container, "JPM")).toBe("JPM  $2,200.00  +10.00%");
  });

  it("orders tiles by ticker ascending", () => {
    const { container } = render(<Heatmap portfolio={twoPositions()} failed={false} />);
    const titles = Array.from(container.querySelectorAll("title")).map((t) => t.textContent?.split(" ")[0]);
    expect(titles.filter((t) => t === "AAPL" || t === "JPM")).toEqual(["AAPL", "JPM"]);
  });
});

describe("tileFill", () => {
  it("is the line color at zero P&L", () => {
    expect(tileFill(0)).toBe("var(--color-line)");
  });

  it("caps a gain at 40% from +5%", () => {
    const capped = "color-mix(in srgb, var(--color-up) 40%, var(--color-line))";
    expect(tileFill(0.05)).toBe(capped);
    expect(tileFill(0.1)).toBe(capped);
  });

  it("scales a loss linearly below the cap", () => {
    expect(tileFill(-0.025)).toBe("color-mix(in srgb, var(--color-down) 20%, var(--color-line))");
  });
});
