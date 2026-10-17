import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatDock } from "@/components/ChatDock";
import { testIds } from "@/lib/testIds";
import { jsonResponse, makeChatReply } from "@/test/fixtures";

const TIMEOUT_ERROR = "The AI assistant timed out, please try again";
const FOLLOW_UP = "Your message was kept. Press Send to try again.";

const renderDock = (fetchStub: ReturnType<typeof vi.fn>) => {
  vi.stubGlobal("fetch", fetchStub);
  const onActionsApplied = vi.fn();
  render(<ChatDock onActionsApplied={onActionsApplied} />);
  return onActionsApplied;
};

const input = () => screen.getByTestId(testIds.chatInput) as HTMLTextAreaElement;
const sendButton = () => screen.getByTestId(testIds.chatSend);
const bubbles = (role: "user" | "assistant") =>
  screen.queryAllByTestId(testIds.chatMessage).filter((node) => node.getAttribute("data-role") === role);

afterEach(() => vi.unstubAllGlobals());

describe("ChatDock failed send", () => {
  it("a 502 shows the error inline and keeps the text", async () => {
    const user = userEvent.setup();
    const onActionsApplied = renderDock(vi.fn(() => Promise.resolve(jsonResponse({ error: TIMEOUT_ERROR }, 502))));
    await user.type(input(), "Analyze AAPL");
    await user.click(sendButton());

    const error = await screen.findByTestId(testIds.chatError);
    expect(error).toHaveAttribute("role", "alert");
    expect(error).toHaveTextContent(TIMEOUT_ERROR);
    expect(within(error).getByText(TIMEOUT_ERROR)).toHaveClass("text-down");
    expect(within(error).getByText(FOLLOW_UP)).toHaveClass("text-muted");
    expect(input()).toHaveValue("Analyze AAPL");
    expect(sendButton()).toBeEnabled();
    expect(bubbles("user")).toHaveLength(1);
    expect(bubbles("assistant")).toHaveLength(0);
    expect(screen.queryByTestId(testIds.chatLoading)).not.toBeInTheDocument();
    expect(onActionsApplied).not.toHaveBeenCalled();
  });

  it("a resend replaces the failed attempt", async () => {
    const user = userEvent.setup();
    const fetchStub = vi.fn(() => Promise.resolve(jsonResponse({ error: TIMEOUT_ERROR }, 502)));
    const onActionsApplied = renderDock(fetchStub);
    await user.type(input(), "Analyze AAPL");
    await user.click(sendButton());
    await screen.findByTestId(testIds.chatError);

    fetchStub.mockImplementation(() => Promise.resolve(jsonResponse(makeChatReply("AAPL is flat today."))));
    await user.type(input(), " again");
    await user.click(sendButton());

    await waitFor(() => expect(bubbles("assistant")).toHaveLength(1));
    expect(screen.queryByTestId(testIds.chatError)).not.toBeInTheDocument();
    expect(bubbles("user")).toHaveLength(1);
    expect(bubbles("user")[0]).toHaveTextContent(/Analyze AAPL again/);
    expect(input()).toHaveValue("");
    expect(onActionsApplied).toHaveBeenCalledTimes(1);
    expect(onActionsApplied).toHaveBeenCalledWith([]);
  });

  it("a network failure shows the fixed copy", async () => {
    const user = userEvent.setup();
    renderDock(vi.fn(() => Promise.reject(new Error("socket hang up"))));
    await user.type(input(), "hello");
    await user.click(sendButton());

    const error = await screen.findByTestId(testIds.chatError);
    expect(error).toHaveTextContent("Request failed. Try again.");
    expect(error).toHaveTextContent(FOLLOW_UP);
  });

  it("an error without a JSON body shows the status", async () => {
    const user = userEvent.setup();
    const notJson = {
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    } as unknown as Response;
    renderDock(vi.fn(() => Promise.resolve(notJson)));
    await user.type(input(), "hello");
    await user.click(sendButton());

    const error = await screen.findByTestId(testIds.chatError);
    expect(error).toHaveTextContent("Request failed (500)");
    expect(error).toHaveTextContent(FOLLOW_UP);
  });

  it("the error stays until the next send starts", async () => {
    const user = userEvent.setup();
    const fetchStub = vi.fn(() => Promise.resolve(jsonResponse({ error: TIMEOUT_ERROR }, 502)));
    renderDock(fetchStub);
    await user.type(input(), "hello");
    await user.click(sendButton());
    await screen.findByTestId(testIds.chatError);

    await user.type(input(), " there");
    expect(input()).toHaveValue("hello there");
    expect(screen.getByTestId(testIds.chatError)).toBeInTheDocument();

    fetchStub.mockImplementation(() => new Promise(() => {}));
    await user.click(sendButton());
    await waitFor(() => expect(screen.queryByTestId(testIds.chatError)).not.toBeInTheDocument());
  });
});
