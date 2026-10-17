"use client";

import { useEffect, useRef } from "react";
import { testIds } from "@/lib/testIds";
import type { ChatState } from "@/lib/useChat";
import { ChatBubble } from "./ChatBubble";
import { ChatChips } from "./ChatChips";

/** Scrolling conversation: committed bubbles, the in-flight or failed attempt, and its error. */
export function ChatTranscript({ chat }: { chat: ChatState }) {
  const { messages, attempt } = chat;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, attempt]);

  return (
    <div
      role="log"
      aria-label="Conversation"
      tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto bg-surface p-2 focus-visible:outline-2 outline-primary"
    >
      <div className="flex flex-col gap-2">
        {messages.length === 0 && attempt === null && <ChatChips chat={chat} />}
        {messages.map((message, index) => (
          <ChatBubble key={index} {...message} />
        ))}
        {attempt && <ChatBubble key="attempt" role="user" content={attempt.text} actions={[]} />}
        {chat.pending && (
          <p role="status" data-testid={testIds.chatLoading} className="text-muted">
            Thinking...
          </p>
        )}
        {attempt?.error != null && (
          <div role="alert" data-testid={testIds.chatError} className="max-w-[85%] border border-down/50 bg-panel px-2 py-1">
            <p className="break-words text-down">{attempt.error}</p>
            <p className="text-muted">
              {attempt.unconfirmed
                ? "Data refreshed. Check your positions and watchlist before sending again."
                : "Your message was kept. Press Send to try again."}
            </p>
          </div>
        )}
      </div>
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
