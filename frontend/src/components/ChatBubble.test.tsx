import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatBubble } from "@/components/ChatBubble";
import { testIds } from "@/lib/testIds";
import {
  makeFailedTrade,
  makeFailedWatchlistChange,
  makeOkTrade,
  makeOkWatchlistChange,
} from "@/test/fixtures";

const HOSTILE = "<img src=x onerror=alert(1)>";

describe("ChatBubble", () => {
  it("renders a user bubble with its hidden sender name", () => {
    render(<ChatBubble role="user" content="hello" actions={[]} />);
    const bubble = screen.getByTestId(testIds.chatMessage);
    expect(bubble).toHaveAttribute("data-role", "user");
    expect(bubble).toHaveClass("ml-auto", "bg-surface", "whitespace-pre-wrap", "break-words", "max-w-[85%]");
    expect(within(bubble).getByText("You")).toHaveClass("sr-only");
    expect(bubble).toHaveTextContent("hello");
  });

  it("renders an assistant bubble with its hidden sender name", () => {
    render(<ChatBubble role="assistant" content="hi there" actions={[]} />);
    const bubble = screen.getByTestId(testIds.chatMessage);
    expect(bubble).toHaveAttribute("data-role", "assistant");
    expect(bubble).toHaveClass("bg-panel", "whitespace-pre-wrap", "break-words", "max-w-[85%]");
    expect(bubble).not.toHaveClass("ml-auto");
    expect(within(bubble).getByText("FinAlly")).toHaveClass("sr-only");
    expect(bubble).toHaveTextContent("hi there");
  });

  it("renders no action list for zero actions", () => {
    render(<ChatBubble role="assistant" content="all cash" actions={[]} />);
    expect(screen.queryByRole("list", { name: "Actions" })).not.toBeInTheDocument();
    expect(screen.queryByTestId(testIds.chatAction)).not.toBeInTheDocument();
  });

  it("renders every action in order with its own status and style", () => {
    render(
      <ChatBubble
        role="assistant"
        content="mixed"
        actions={[
          makeOkWatchlistChange("PYPL", "add"),
          makeFailedTrade("AAPL", "buy", 1, "Insufficient cash"),
          makeOkTrade("NVDA", "sell", 2, 120),
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Actions" });
    expect(list).toHaveClass("max-w-[85%]");
    const chips = within(list).getAllByTestId(testIds.chatAction);
    expect(chips.map((chip) => chip.getAttribute("data-status"))).toEqual(["ok", "failed", "ok"]);
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Added PYPL",
      "BUY 1 AAPL failed - Insufficient cash",
      "SELL 2 NVDA @ 120.00",
    ]);
    expect(chips[1]).toHaveClass("text-down", "border-down/50");
    for (const index of [0, 2]) expect(chips[index]).toHaveClass("text-text", "border-line");
    for (const chip of chips) {
      expect(chip).toHaveClass("figures", "break-words");
      expect(chip).not.toHaveAttribute("tabindex");
    }
  });

  it("keeps two identical actions as two chips", () => {
    const buy = makeOkTrade("AAPL", "buy", 1, 190);
    render(<ChatBubble role="assistant" content="twice" actions={[buy, buy]} />);
    expect(screen.getAllByTestId(testIds.chatAction)).toHaveLength(2);
  });

  it("keeps the returned order of a trade then a watchlist change", () => {
    render(
      <ChatBubble
        role="assistant"
        content="order"
        actions={[makeOkTrade("AAPL", "buy", 1, 190), makeOkWatchlistChange("PYPL", "add")]}
      />,
    );
    const chips = screen.getAllByTestId(testIds.chatAction);
    expect(chips[0]).toHaveTextContent("BUY 1 AAPL");
    expect(chips[1]).toHaveTextContent("Added PYPL");
  });

  it("still renders the bubble and chip for an empty message", () => {
    render(<ChatBubble role="assistant" content="" actions={[makeOkTrade("AAPL", "buy", 1, 190)]} />);
    expect(screen.getByTestId(testIds.chatMessage)).toBeInTheDocument();
    expect(screen.getAllByTestId(testIds.chatAction)).toHaveLength(1);
  });

  it("renders hostile text as literal text in the message, ticker and error", () => {
    const { container } = render(
      <ChatBubble
        role="assistant"
        content={HOSTILE}
        actions={[
          makeFailedWatchlistChange(HOSTILE, "add", "nope"),
          makeFailedTrade("AAPL", "buy", 1, HOSTILE),
        ]}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId(testIds.chatMessage)).toHaveTextContent(HOSTILE);
    const chips = screen.getAllByTestId(testIds.chatAction);
    expect(chips[0]).toHaveTextContent(`Add ${HOSTILE} failed - nope`);
    expect(chips[1]).toHaveTextContent(`BUY 1 AAPL failed - ${HOSTILE}`);
  });
});
