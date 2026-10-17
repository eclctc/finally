"use client";

import { QUICK_PROMPTS } from "@/lib/chat";
import { testIds } from "@/lib/testIds";
import type { ChatState } from "@/lib/useChat";

/** Empty-state line and the starter-question chips; a chip click asks its question at once. */
export function ChatChips({ chat }: { chat: ChatState }) {
  return (
    <div className="py-12 text-center">
      <p className="text-muted">Ask FinAlly about your portfolio.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2 px-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            data-testid={testIds.chatChip}
            disabled={chat.pending}
            onClick={() => {
              chat.setDraft(prompt);
              chat.send(prompt);
            }}
            className="h-7 border border-line bg-panel px-2 text-text hover:border-primary disabled:opacity-50 focus-visible:outline-2 outline-primary"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
