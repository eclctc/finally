"use client";

import { testIds } from "@/lib/testIds";
import type { ChatState } from "@/lib/useChat";
import { ChatBubble } from "./ChatBubble";

/** Scrolling conversation: committed bubbles, the in-flight or failed attempt, and its error. */
export function ChatTranscript({ chat }: { chat: ChatState }) {
  const { messages, attempt } = chat;
  return (
    <div
      role="log"
      aria-label="Conversation"
      tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto bg-surface p-2 focus-visible:outline-2 outline-primary"
    >
      <div className="flex flex-col gap-2">
        {messages.map((message, index) => (
          <ChatBubble key={index} {...message} />
        ))}
        {attempt && <ChatBubble key="attempt" role="user" content={attempt.text} actions={[]} />}
        {attempt?.error != null && (
          <div role="alert" data-testid={testIds.chatError} className="max-w-[85%] border border-down/50 bg-panel px-2 py-1">
            <p className="break-words text-down">{attempt.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
