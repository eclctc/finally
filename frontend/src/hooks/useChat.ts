"use client";

import { useRef, useState } from "react";
import { sendChat } from "@/lib/api";
import type { ChatAction, ChatEntry } from "@/lib/types";

/** Chat conversation state; calls onActions after the assistant executes anything. */
export function useChat(onActions: (actions: ChatAction[]) => void) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(0);

  function append(entry: Omit<ChatEntry, "id">) {
    const id = nextId.current++;
    setEntries((current) => [...current, { ...entry, id }]);
  }

  async function send(message: string) {
    append({ role: "user", content: message, actions: [] });
    setLoading(true);
    setError(null);
    try {
      const reply = await sendChat(message);
      append({ role: "assistant", content: reply.message, actions: reply.actions });
      if (reply.actions.length > 0) onActions(reply.actions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return { entries, loading, error, send };
}
