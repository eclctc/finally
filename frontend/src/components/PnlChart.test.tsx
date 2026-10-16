import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ValuePoint } from "@/lib/pnlSeries";
import { makePortfolio } from "@/test/fixtures";
import { PnlChart, PnlTooltip } from "./PnlChart";

const LOADING = "Loading portfolio history...";
const FAILED = "Portfolio history unavailable. Reload the page to try again.";
const WAITING = "Waiting for portfolio history.";
const HOUR_MS = 3_600_000;

/** History points `stepMs` apart ending a minute ago, all at the starting value. */
const spanning = (count: number, stepMs: number): ValuePoint[] => {
  const end = Date.now() - 60_000;
  return Array.from({ length: count }, (_, i) => ({ t: end - (count - 1 - i) * stepMs, value: 10000 }));
};

const tickLabels = (container: HTMLElement) =>
  [...container.querySelectorAll(".recharts-xAxis .recharts-cartesian-axis-tick-value")].map((el) => el.textContent);

describe("PnlChart states", () => {
  it("shows the loading line in text-muted while history is null", () => {
    render(<PnlChart history={null} failed={false} portfolio={null} />);
    expect(screen.getByText(LOADING)).toHaveClass("text-muted");
  });

  it("shows an alert in text-down when the first load failed", () => {
    render(<PnlChart history={null} failed={true} portfolio={null} />);
    expect(screen.queryByText(LOADING)).toBeNull();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(FAILED);
    expect(alert).toHaveClass("text-down");
  });

  it("waits for history with an empty history and a portfolio (one point)", () => {
    const { container } = render(<PnlChart history={[]} failed={false} portfolio={makePortfolio(10000)} />);
    expect(screen.getByText(WAITING)).toHaveClass("py-12", "text-center", "text-muted");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("waits for history with an empty history and no portfolio", () => {
    const { container } = render(<PnlChart history={[]} failed={false} portfolio={null} />);
    expect(screen.getByText(WAITING)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("PnlChart populated", () => {
  it("draws one curve, the baseline label and the live dot for one snapshot plus the tail", () => {
    const { container } = render(<PnlChart history={spanning(1, 0)} failed={false} portfolio={makePortfolio(10000)} />);
    expect(screen.queryByText(WAITING)).toBeNull();
    expect(container.querySelectorAll("path.recharts-curve")).toHaveLength(1);
    expect(screen.getByText("Start $10,000")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-reference-dot")).toHaveLength(1);
  });

  it("keeps the chart in the relative, clipped container", () => {
    const { container } = render(<PnlChart history={spanning(1, 0)} failed={false} portfolio={makePortfolio(10000)} />);
    expect(container.firstElementChild).toHaveClass("relative", "h-full", "min-h-0", "overflow-hidden");
  });

  it("draws no live dot without a portfolio", () => {
    const { container } = render(<PnlChart history={spanning(2, 1000)} failed={false} portfolio={null} />);
    expect(container.querySelectorAll("path.recharts-curve")).toHaveLength(1);
    expect(container.querySelectorAll(".recharts-reference-dot")).toHaveLength(0);
  });

  it("labels the X axis HH:MM for a 2-hour span", () => {
    const { container } = render(<PnlChart history={spanning(3, HOUR_MS)} failed={false} portfolio={null} />);
    const labels = tickLabels(container);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label).toMatch(/^\d{2}:\d{2}$/);
  });

  it("labels the X axis Mon D for a 3-day span", () => {
    const { container } = render(<PnlChart history={spanning(4, 24 * HOUR_MS)} failed={false} portfolio={null} />);
    const labels = tickLabels(container);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(label).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });
});

describe("PnlTooltip", () => {
  const T = new Date(2026, 9, 16, 14, 32, 5).getTime();
  const at = (value: number) => [{ payload: { t: T, value } }];

  it("shows the time, total value and a green vs-start gain", () => {
    render(<PnlTooltip active payload={at(10123.45)} />);
    expect(screen.getByText("Oct 16, 14:32:05")).toBeInTheDocument();
    expect(screen.getByText("Total value")).toBeInTheDocument();
    expect(screen.getByText("$10,123.45")).toHaveClass("figures", "text-text");
    expect(screen.getByText("vs start")).toBeInTheDocument();
    expect(screen.getByText("+$123.45")).toHaveClass("text-up");
  });

  it("shows a red vs-start loss", () => {
    render(<PnlTooltip active payload={at(9900)} />);
    expect(screen.getByText("-$100.00")).toHaveClass("text-down");
  });

  it("shows a muted zero vs-start at the starting value", () => {
    render(<PnlTooltip active payload={at(10000)} />);
    expect(screen.getByText("$0.00", { selector: ".text-muted" })).toBeInTheDocument();
  });

  it("renders nothing when inactive or without a payload", () => {
    const { container, rerender } = render(<PnlTooltip active={false} payload={at(10000)} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PnlTooltip active payload={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
