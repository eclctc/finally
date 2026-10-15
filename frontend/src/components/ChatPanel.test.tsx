import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChatEntry } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";

const conversation: ChatEntry[] = [
  { id: 0, role: "user", content: "Buy AAPL", actions: [] },
  {
    id: 1,
    role: "assistant",
    content: "Done.",
    actions: [
      { type: "trade", ticker: "AAPL", side: "buy", quantity: 1, status: "ok", price: 190.12 },
      { type: "trade", ticker: "TSLA", side: "sell", quantity: 5, status: "failed", error: "Insufficient shares" },
      { type: "watchlist", ticker: "PYPL", action: "add", status: "ok" },
    ],
  },
];

describe("ChatPanel", () => {
  it("renders messages with roles and inline actions", () => {
    render(<ChatPanel entries={conversation} loading={false} error={null} onSend={vi.fn()} />);
    const messages = screen.getAllByTestId("chat-message");
    expect(messages.map((m) => m.dataset.role)).toEqual(["user", "assistant"]);

    const actions = screen.getAllByTestId("chat-action");
    expect(actions.map((a) => a.dataset.status)).toEqual(["ok", "failed", "ok"]);
    expect(actions[0]).toHaveTextContent("Bought 1 AAPL at 190.12");
    expect(actions[1]).toHaveTextContent("Insufficient shares");
    expect(actions[2]).toHaveTextContent("Added PYPL to watchlist");
  });

  it("shows the loading indicator and disables send while waiting", () => {
    render(<ChatPanel entries={[]} loading={true} error={null} onSend={vi.fn()} />);
    expect(screen.getByTestId("chat-loading")).toBeInTheDocument();
    expect(screen.getByTestId("chat-send")).toBeDisabled();
  });

  it("shows an error", () => {
    render(<ChatPanel entries={[]} loading={false} error="LLM unavailable" onSend={vi.fn()} />);
    expect(screen.getByTestId("chat-error")).toHaveTextContent("LLM unavailable");
  });

  it("sends the trimmed message and clears the input", async () => {
    const onSend = vi.fn();
    render(<ChatPanel entries={[]} loading={false} error={null} onSend={onSend} />);
    await userEvent.type(screen.getByTestId("chat-input"), "  hello  ");
    await userEvent.click(screen.getByTestId("chat-send"));
    expect(onSend).toHaveBeenCalledWith("hello");
    expect(screen.getByTestId("chat-input")).toHaveValue("");
  });
});
