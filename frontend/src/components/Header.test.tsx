import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { mergeFrame } from "@/lib/priceStore";
import { connectPriceStream, RECREATE_DELAY_MS } from "@/lib/priceStream";
import { testIds } from "@/lib/testIds";
import { makeFrame, makeFrameEntry, makePortfolio, makePosition } from "@/test/fixtures";
import type { FakeEventSource } from "../../vitest.setup";

const Fake = globalThis.EventSource as unknown as typeof FakeEventSource;

const parseNumber = (text: string) => Number(text.replace(/[^0-9.-]/g, ""));

const AAPL_POSITION = makePosition("AAPL", 10, 190, 984.5178);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Header", () => {
  it("shows -- in both figures while there is no portfolio", () => {
    render(<Header portfolio={null} failed={false} />);
    expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("--");
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("--");
  });

  it("shows the portfolio as bare currency figures", () => {
    render(<Header portfolio={makePortfolio(10000)} failed={false} />);
    expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$10,000.00");
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("$10,000.00");
    expect(parseNumber(screen.getByTestId(testIds.cashBalance).textContent!)).toBe(10000);
  });

  it("revalues the total at live prices while cash stays the same", () => {
    render(<Header portfolio={{ ...makePortfolio(2500.5, [AAPL_POSITION]), total_value: 12345.678 }} failed={false} />);
    expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$2,500.50");
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("$12,345.68");

    act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", 1000, 2))));
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("$12,500.50");
    expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$2,500.50");
  });

  it("ignores the API total_value", () => {
    render(<Header portfolio={{ ...makePortfolio(10000), total_value: 99999 }} failed={false} />);
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("$10,000.00");
  });

  it("never flashes the total or marks it as a live region", () => {
    render(<Header portfolio={makePortfolio(2500.5, [AAPL_POSITION])} failed={false} />);
    act(() => mergeFrame(makeFrame(makeFrameEntry("AAPL", 1000, 2))));
    const total = screen.getByTestId(testIds.totalValue);
    expect(total).not.toHaveAttribute("data-flash");
    expect(total).not.toHaveAttribute("aria-live");
  });

  it("starts reconnecting", () => {
    render(<Header portfolio={null} failed={false} />);
    const dot = screen.getByRole("status");
    expect(dot).toBe(screen.getByTestId(testIds.connectionStatus));
    expect(dot).toHaveAttribute("data-status", "reconnecting");
    expect(dot).toHaveAttribute("title", "Reconnecting");
    expect(dot).toHaveTextContent("Reconnecting");
    expect(dot).toHaveClass("bg-accent");
    expect(dot).not.toHaveAttribute("aria-label");
  });

  it("follows the stream lifecycle", () => {
    vi.useFakeTimers();
    render(<Header portfolio={null} failed={false} />);
    const stopStream = connectPriceStream();
    const dot = screen.getByTestId(testIds.connectionStatus);
    const expectDot = (status: string, label: string, color: string) => {
      expect(dot).toHaveAttribute("data-status", status);
      expect(dot).toHaveAttribute("title", label);
      expect(dot).toHaveTextContent(label);
      expect(dot).toHaveClass(color);
    };

    act(() => Fake.instances[0].open());
    expectDot("connected", "Connected", "bg-up");
    act(() => Fake.instances[0].fail());
    expectDot("reconnecting", "Reconnecting", "bg-accent");
    act(() => Fake.instances[0].fail(true));
    expectDot("disconnected", "Disconnected", "bg-down");
    act(() => vi.advanceTimersByTime(RECREATE_DELAY_MS));
    expect(Fake.instances).toHaveLength(2);
    act(() => Fake.instances[1].open());
    expectDot("connected", "Connected", "bg-up");

    stopStream();
    vi.useRealTimers();
  });

  it("renders the wordmark as the only h1", () => {
    render(<Header portfolio={null} failed={false} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("FinAlly");
    expect(screen.getByText("Ally")).toHaveClass("text-accent");
  });

  it("keeps the labels outside the figure elements", () => {
    render(<Header portfolio={null} failed={false} />);
    const total = screen.getByTestId(testIds.totalValue);
    const cash = screen.getByTestId(testIds.cashBalance);
    expect(screen.getByText("Portfolio value")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(total).not.toContainElement(screen.getByText("Portfolio value"));
    expect(cash).not.toContainElement(screen.getByText("Cash"));
  });

  it("keeps -- and shows a sibling alert when the portfolio failed to load", () => {
    render(<Header portfolio={null} failed={true} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Portfolio unavailable. Reload the page to try again.");
    expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("--");
    expect(screen.getByTestId(testIds.totalValue).textContent).toBe("--");
  });

  it("shows no alert while loading or after success", () => {
    const { rerender } = render(<Header portfolio={null} failed={false} />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<Header portfolio={makePortfolio(10000)} failed={false} />);
    expect(screen.getByTestId(testIds.cashBalance).textContent).toBe("$10,000.00");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
