"use client";

import { useCallback, useRef, useState } from "react";
import { errorMessage, request } from "./api";
import type { ChatAction, ChatReply } from "./chat";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions: ChatAction[];
}

/** The message currently being sent; `error` is null while the request is in flight. */
export interface ChatAttempt {
  text: string;
  error: string | null;
}

/** Session-only conversation: committed messages, one attempt slot and the composer draft. */
export function useChat(onActionsApplied: (actions: ChatAction[]) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attempt, setAttempt] = useState<ChatAttempt | null>(null);
  const [draft, setDraft] = useState("");
  const pending = attempt !== null && attempt.error === null;
  const inFlight = useRef(false);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (text === "" || inFlight.current) return;
      inFlight.current = true;
      setAttempt({ text, error: null });
      let reply: ChatReply;
      try {
        reply = await request<ChatReply>("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
      } catch (err) {
        setAttempt({ text, error: errorMessage(err) });
        return;
      } finally {
        inFlight.current = false;
      }
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, actions: [] },
        { role: "assistant", content: reply.message, actions: reply.actions },
      ]);
      setAttempt(null);
      setDraft("");
      onActionsApplied(reply.actions);
    },
    [onActionsApplied],
  );

  return { messages, attempt, pending, draft, setDraft, send };
}

export type ChatState = ReturnType<typeof useChat>;
