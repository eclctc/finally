"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { testIds } from "@/lib/testIds";
import type { ChatState } from "@/lib/useChat";

const TEXTAREA_CLASS =
  "h-14 min-w-0 flex-1 resize-none border border-line bg-surface px-2 py-1 text-text placeholder:text-muted focus:border-primary focus-visible:outline-2 outline-primary";
const TEXTAREA_PENDING_CLASS =
  "h-14 min-w-0 flex-1 resize-none border border-line bg-surface px-2 py-1 text-text opacity-60 placeholder:text-muted focus:border-primary focus-visible:outline-2 outline-primary";

/** Composer form: message textarea and Send. */
export function ChatComposer({ chat, autoFocus = false }: { chat: ChatState; autoFocus?: boolean }) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    chat.send(chat.draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    chat.send(chat.draft);
  };

  return (
    <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t border-line bg-panel p-2">
      <textarea
        data-testid={testIds.chatInput}
        value={chat.draft}
        onChange={(event) => chat.setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        readOnly={chat.pending}
        placeholder="Message FinAlly"
        aria-label="Message to FinAlly"
        autoComplete="off"
        spellCheck={false}
        className={chat.pending ? TEXTAREA_PENDING_CLASS : TEXTAREA_CLASS}
      />
      <button
        type="submit"
        data-testid={testIds.chatSend}
        disabled={chat.pending || chat.draft.trim() === ""}
        className="h-7 self-end bg-submit px-4 font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 outline-primary"
      >
        Send
      </button>
    </form>
  );
}
