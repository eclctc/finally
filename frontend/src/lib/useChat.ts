"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError, errorMessage, request } from "./api";
import type { ChatAction, ChatReply } from "./chat";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  actions: ChatAction[];
}

export const UNCONFIRMED_ERROR = "Could not confirm the request.";

/**
 * The message currently being sent; `error` is null while the request is in flight.
 * `unconfirmed` marks a failure with no HTTP answer, so the server may already have applied the message.
 */
export interface ChatAttempt {
  text: string;
  error: string | null;
  unconfirmed: boolean;
}

/**
 * Session-only conversation: committed messages, one attempt slot and the composer draft.
 * A failure that is not an ApiError calls onUnconfirmed, because the AI's trades may have executed.
 */
export function useChat(onActionsApplied: (actions: ChatAction[]) => void, onUnconfirmed: () => void) {
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
      setAttempt({ text, error: null, unconfirmed: false });
      let reply: ChatReply;
      try {
        reply = await request<ChatReply>("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setAttempt({ text, error: errorMessage(err), unconfirmed: false });
        } else {
          setAttempt({ text, error: UNCONFIRMED_ERROR, unconfirmed: true });
          onUnconfirmed();
        }
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
    [onActionsApplied, onUnconfirmed],
  );

  return { messages, attempt, pending, draft, setDraft, send };
}

export type ChatState = ReturnType<typeof useChat>;
