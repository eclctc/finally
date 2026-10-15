"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatEntry } from "@/lib/types";
import { ChatMessage } from "./ChatMessage";

interface ChatPanelProps {
  entries: ChatEntry[];
  loading: boolean;
  error: string | null;
  onSend: (message: string) => void;
}

const SUGGESTIONS = ["How is my portfolio doing?", "Buy 5 shares of NVDA", "Add PYPL to my watchlist"];

/** Collapsible assistant sidebar: conversation, loading state and message input. */
export function ChatPanel({ entries, loading, error, onSend }: ChatPanelProps) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [entries, loading]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || loading) return;
    onSend(message);
    setDraft("");
  }

  if (!open) {
    return (
      <aside data-testid="chat-panel" className="flex w-10 flex-col items-center border-l border-line bg-panel pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="text-[12px] text-primary [writing-mode:vertical-rl]"
        >
          Assistant
        </button>
      </aside>
    );
  }

  return (
    <aside data-testid="chat-panel" className="flex w-[360px] shrink-0 flex-col border-l border-line bg-panel">
      <header className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
        <h2 className="text-[12px] font-medium text-muted">Assistant</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Collapse assistant" className="text-muted hover:text-text">
          Hide
        </button>
      </header>
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {entries.length === 0 && (
          <div className="flex flex-col gap-2 text-muted">
            <p>Ask about your positions, or tell me what to trade.</p>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setDraft(suggestion)}
                className="border border-line px-2 py-1 text-left hover:border-primary hover:text-text"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {entries.map((entry) => (
          <ChatMessage key={entry.id} entry={entry} />
        ))}
        {loading && (
          <div data-testid="chat-loading" className="flex items-center gap-1 text-muted" aria-live="polite">
            <span className="loading-dot h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="loading-dot h-1.5 w-1.5 rounded-full bg-primary [animation-delay:150ms]" />
            <span className="loading-dot h-1.5 w-1.5 rounded-full bg-primary [animation-delay:300ms]" />
            <span className="ml-2">Thinking</span>
          </div>
        )}
        {error && (
          <p data-testid="chat-error" role="alert" className="border-l-2 border-down px-2 py-1 text-down">
            {error}
          </p>
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input
          data-testid="chat-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message the assistant"
          aria-label="Message the assistant"
          className="min-w-0 flex-1 border border-line bg-ink px-2 py-1.5 placeholder:text-muted"
        />
        <button
          type="submit"
          data-testid="chat-send"
          disabled={loading}
          className="bg-secondary px-4 font-medium text-text hover:brightness-125 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  );
}
