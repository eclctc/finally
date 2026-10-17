import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatDock } from "@/components/ChatDock";
import { testIds } from "@/lib/testIds";
import { jsonResponse, makeChatReply, makeOkTrade } from "@/test/fixtures";

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

/** A fetch whose response the test settles by hand. */
const deferredFetch = () => {
  let resolve!: (response: Response) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { stub: vi.fn(() => promise), resolve, reject };
};

const sentBody = (fetchStub: ReturnType<typeof vi.fn>, call = 0) => JSON.parse(fetchStub.mock.calls[call][1].body);

describe("ChatDock while the AI is thinking", () => {
  it("shows the user bubble, Thinking... and a locked composer", async () => {
    const user = userEvent.setup();
    const deferred = deferredFetch();
    renderDock(deferred.stub);
    await user.type(input(), "Analyze AAPL");
    await user.click(sendButton());

    const loading = await screen.findByTestId(testIds.chatLoading);
    expect(loading).toHaveTextContent("Thinking...");
    expect(loading).toHaveAttribute("role", "status");
    expect(loading).toHaveClass("text-muted");
    expect(bubbles("user")).toHaveLength(1);
    expect(sendButton()).toBeDisabled();
    expect(sendButton()).toHaveTextContent("Send");
    expect(input()).toHaveAttribute("readonly");
    expect(input()).not.toBeDisabled();
    expect(input()).toHaveClass("opacity-60");
    expect(input()).toHaveValue("Analyze AAPL");
  });

  it("sends one request for two synchronous submits and for Enter while pending", async () => {
    const user = userEvent.setup();
    const deferred = deferredFetch();
    renderDock(deferred.stub);
    await user.type(input(), "buy AAPL");
    const form = input().closest("form") as HTMLFormElement;
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    fireEvent.keyDown(input(), { key: "Enter" });
    await screen.findByTestId(testIds.chatLoading);
    expect(deferred.stub).toHaveBeenCalledTimes(1);
  });

  it("a reply removes the loading line, unlocks and clears the composer, and adds one pair of bubbles", async () => {
    const user = userEvent.setup();
    const deferred = deferredFetch();
    renderDock(deferred.stub);
    await user.type(input(), "hello");
    await user.click(sendButton());
    await screen.findByTestId(testIds.chatLoading);

    await act(async () => deferred.resolve(jsonResponse(makeChatReply("Hi there."))));

    expect(screen.queryByTestId(testIds.chatLoading)).not.toBeInTheDocument();
    expect(input()).not.toHaveAttribute("readonly");
    expect(input()).toHaveValue("");
    expect(bubbles("user")).toHaveLength(1);
    expect(bubbles("assistant")).toHaveLength(1);
  });

  it("a failure removes the loading line", async () => {
    const user = userEvent.setup();
    const deferred = deferredFetch();
    renderDock(deferred.stub);
    await user.type(input(), "hello");
    await user.click(sendButton());
    await screen.findByTestId(testIds.chatLoading);

    await act(async () => deferred.reject(new Error("socket hang up")));

    expect(screen.queryByTestId(testIds.chatLoading)).not.toBeInTheDocument();
    expect(screen.getByTestId(testIds.chatError)).toBeInTheDocument();
    expect(input()).not.toHaveAttribute("readonly");
  });
});

describe("ChatDock keyboard and input", () => {
  it("Enter sends the draft and adds no newline", async () => {
    const user = userEvent.setup();
    const deferred = deferredFetch();
    renderDock(deferred.stub);
    await user.type(input(), "hello{Enter}");

    await screen.findByTestId(testIds.chatLoading);
    expect(deferred.stub).toHaveBeenCalledTimes(1);
    expect(sentBody(deferred.stub)).toEqual({ message: "hello" });
    expect(input()).toHaveValue("hello");
  });

  it("Shift+Enter adds a newline and sends nothing", async () => {
    const user = userEvent.setup();
    const fetchStub = vi.fn();
    renderDock(fetchStub);
    await user.type(input(), "a{Shift>}{Enter}{/Shift}b");

    expect(input()).toHaveValue("a\nb");
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("Enter during an IME composition sends nothing", async () => {
    const user = userEvent.setup();
    const fetchStub = vi.fn();
    renderDock(fetchStub);
    await user.type(input(), "nihon");
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });

    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("an empty or whitespace-only draft cannot be sent", async () => {
    const user = userEvent.setup();
    const fetchStub = vi.fn();
    renderDock(fetchStub);
    expect(sendButton()).toBeDisabled();
    await user.type(input(), "   {Enter}");

    expect(sendButton()).toBeDisabled();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("sends text trimmed but otherwise exactly as typed", async () => {
    const user = userEvent.setup();
    const fetchStub = vi.fn(() => Promise.resolve(jsonResponse(makeChatReply("ok"))));
    renderDock(fetchStub);
    expect(input()).not.toHaveAttribute("maxlength");

    await user.type(input(), "  Wie geht's? 日本 € naïve  ");
    await user.click(sendButton());
    await waitFor(() => expect(bubbles("assistant")).toHaveLength(1));
    expect(sentBody(fetchStub)).toEqual({ message: "Wie geht's? 日本 € naïve" });
    expect(bubbles("user")[0]).toHaveTextContent(/Wie geht's\? 日本 € naïve/);

    await user.type(input(), "a{Shift>}{Enter}{/Shift}b");
    await user.click(sendButton());
    await waitFor(() => expect(bubbles("assistant")).toHaveLength(2));
    expect(sentBody(fetchStub, 1)).toEqual({ message: "a\nb" });
  });
});

const chips = () => screen.queryAllByTestId(testIds.chatChip);
const EMPTY_LINE = "Ask FinAlly about your portfolio.";

describe("ChatDock empty state and quick prompts", () => {
  it("a fresh dock shows the empty line, three chips in order and the composer", () => {
    renderDock(vi.fn());
    expect(screen.getByText(EMPTY_LINE)).toHaveClass("text-muted");
    expect(chips().map((chip) => chip.textContent)).toEqual([
      "Analyze my portfolio",
      "What is my biggest risk?",
      "Summarize my P&L",
    ]);
    for (const chip of chips()) expect(chip).toHaveAttribute("type", "button");
    expect(input()).toBeInTheDocument();
    expect(sendButton()).toBeInTheDocument();
  });

  it("clicking a chip sends its label at once and removes the chips", async () => {
    const user = userEvent.setup();
    const deferred = deferredFetch();
    renderDock(deferred.stub);
    await user.click(screen.getByRole("button", { name: "What is my biggest risk?" }));

    await screen.findByTestId(testIds.chatLoading);
    expect(deferred.stub).toHaveBeenCalledTimes(1);
    expect(sentBody(deferred.stub)).toEqual({ message: "What is my biggest risk?" });
    expect(input()).toHaveValue("What is my biggest risk?");
    expect(chips()).toHaveLength(0);
    expect(screen.queryByText(EMPTY_LINE)).not.toBeInTheDocument();
  });

  it("a failed chip send keeps the label in the composer and the chips gone", async () => {
    const user = userEvent.setup();
    renderDock(vi.fn(() => Promise.resolve(jsonResponse({ error: TIMEOUT_ERROR }, 502))));
    await user.click(screen.getByRole("button", { name: "Summarize my P&L" }));

    await screen.findByTestId(testIds.chatError);
    expect(input()).toHaveValue("Summarize my P&L");
    expect(chips()).toHaveLength(0);
    expect(screen.queryByText(EMPTY_LINE)).not.toBeInTheDocument();
  });

  it("chips never return, and two exchanges render four bubbles in send order", async () => {
    const user = userEvent.setup();
    const replies = ["first reply", "second reply"];
    const fetchStub = vi.fn(() => Promise.resolve(jsonResponse(makeChatReply(replies.shift() as string))));
    renderDock(fetchStub);
    await user.click(screen.getByRole("button", { name: "Analyze my portfolio" }));
    await waitFor(() => expect(bubbles("assistant")).toHaveLength(1));
    expect(chips()).toHaveLength(0);

    await user.type(input(), "and now?");
    await user.click(sendButton());
    await waitFor(() => expect(bubbles("assistant")).toHaveLength(2));

    expect(chips()).toHaveLength(0);
    const order = screen.getAllByTestId(testIds.chatMessage).map((node) => node.getAttribute("data-role"));
    expect(order).toEqual(["user", "assistant", "user", "assistant"]);
  });

  it("the chip source disables chips while a reply is pending", () => {
    const source = readFileSync(resolve(__dirname, "ChatChips.tsx"), "utf8");
    expect(source).toContain("disabled={chat.pending}");
    expect(source).toContain("disabled:opacity-50");
  });
});

describe("ChatDock scroll to newest", () => {
  it("scrolls the sentinel into view on send and again on the reply", async () => {
    const user = userEvent.setup();
    const deferred = deferredFetch();
    renderDock(deferred.stub);
    const scrollIntoView = vi.mocked(window.HTMLElement.prototype.scrollIntoView);
    scrollIntoView.mockClear();
    await user.type(input(), "hello");
    await user.click(sendButton());
    await screen.findByTestId(testIds.chatLoading);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });

    scrollIntoView.mockClear();
    await act(async () => deferred.resolve(jsonResponse(makeChatReply("Hi."))));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
  });
});

const toggles = () => screen.queryAllByTestId(testIds.chatToggle);

describe("ChatDock collapse", () => {
  it("collapsing and expanding keeps the conversation and the draft", async () => {
    const user = userEvent.setup();
    const fetchStub = vi.fn(() => Promise.resolve(jsonResponse(makeChatReply("Your portfolio is all cash."))));
    renderDock(fetchStub);
    await user.type(input(), "Analyze my portfolio");
    await user.click(sendButton());
    await waitFor(() => expect(bubbles("assistant")).toHaveLength(1));
    await user.type(input(), "next question");

    expect(toggles()).toHaveLength(1);
    expect(toggles()[0]).toHaveAttribute("aria-expanded", "true");
    expect(toggles()[0]).toHaveAttribute("aria-label", "Collapse AI Chat");
    expect(toggles()[0]).toHaveTextContent("›");
    expect(screen.getByRole("complementary")).toHaveClass("w-[320px]");

    await user.click(toggles()[0]);
    expect(screen.getByRole("complementary")).toHaveClass("w-10");
    expect(screen.getByTestId(testIds.chatPanel)).toHaveAttribute("aria-label", "AI Chat");
    expect(toggles()).toHaveLength(1);
    expect(toggles()[0]).toHaveAttribute("aria-expanded", "false");
    expect(toggles()[0]).toHaveAttribute("aria-label", "Expand AI Chat");
    expect(screen.queryAllByTestId(testIds.chatMessage)).toHaveLength(0);
    expect(screen.queryByTestId(testIds.chatInput)).not.toBeInTheDocument();

    await user.click(toggles()[0]);
    expect(bubbles("user")).toHaveLength(1);
    expect(bubbles("assistant")).toHaveLength(1);
    expect(input()).toHaveValue("next question");
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the rail on collapse and to the composer on expand, never on load", async () => {
    const user = userEvent.setup();
    const fetchStub = vi.fn();
    renderDock(fetchStub);
    expect(document.activeElement).toBe(document.body);

    await user.click(toggles()[0]);
    expect(toggles()[0]).toHaveFocus();

    await user.click(toggles()[0]);
    expect(input()).toHaveFocus();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("keeps a pending request across a collapse and delivers a reply that arrives while collapsed", async () => {
    const user = userEvent.setup();
    const deferred = deferredFetch();
    const onActionsApplied = renderDock(deferred.stub);
    await user.type(input(), "buy AAPL");
    await user.click(sendButton());
    await screen.findByTestId(testIds.chatLoading);

    await user.click(toggles()[0]);
    await user.click(toggles()[0]);
    expect(screen.getByTestId(testIds.chatLoading)).toHaveTextContent("Thinking...");

    await user.click(toggles()[0]);
    const actions = [makeOkTrade("AAPL", "buy", 1, 190)];
    await act(async () => deferred.resolve(jsonResponse(makeChatReply("Bought 1 AAPL.", actions))));
    expect(onActionsApplied).toHaveBeenCalledTimes(1);
    expect(onActionsApplied).toHaveBeenCalledWith(actions);

    await user.click(toggles()[0]);
    expect(bubbles("user")).toHaveLength(1);
    expect(bubbles("assistant")).toHaveLength(1);
    expect(screen.queryByTestId(testIds.chatLoading)).not.toBeInTheDocument();
    expect(onActionsApplied).toHaveBeenCalledTimes(1);
    expect(deferred.stub).toHaveBeenCalledTimes(1);
  });

  it("keeps an error and the draft across a collapse", async () => {
    const user = userEvent.setup();
    const fetchStub = vi.fn(() => Promise.resolve(jsonResponse({ error: TIMEOUT_ERROR }, 502)));
    renderDock(fetchStub);
    await user.type(input(), "Analyze AAPL");
    await user.click(sendButton());
    await screen.findByTestId(testIds.chatError);

    await user.click(toggles()[0]);
    await user.click(toggles()[0]);

    const error = screen.getByTestId(testIds.chatError);
    expect(error).toHaveTextContent(TIMEOUT_ERROR);
    expect(error).toHaveTextContent(FOLLOW_UP);
    expect(input()).toHaveValue("Analyze AAPL");
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
});
