import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/Dashboard";
import { testIds } from "@/lib/testIds";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
});
afterEach(() => vi.unstubAllGlobals());

describe("Dashboard", () => {
  it("renders every panel heading", () => {
    render(<Dashboard />);
    for (const title of ["Watchlist", "Chart", "Trade", "Heatmap", "P&L", "Positions", "AI Chat"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
  });

  it("attaches the wrapper testids", () => {
    render(<Dashboard />);
    for (const id of [testIds.watchlist, testIds.heatmap, testIds.pnlChart, testIds.positionsTable, testIds.chatPanel]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it("attaches no watchlist row testids and no main chart testid yet", () => {
    const { container } = render(<Dashboard />);
    expect(container.querySelectorAll('[data-testid^="watchlist-row-"]')).toHaveLength(0);
    expect(screen.queryByTestId(testIds.mainChart)).toBeNull();
  });

  it("still renders the header figures", () => {
    render(<Dashboard />);
    expect(screen.getByTestId(testIds.cashBalance)).toBeInTheDocument();
    expect(screen.getByTestId(testIds.totalValue)).toBeInTheDocument();
  });
});
