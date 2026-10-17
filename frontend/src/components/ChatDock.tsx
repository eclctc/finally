"use client";

import type { ChatAction } from "@/lib/chat";
import { testIds } from "@/lib/testIds";
import { useChat } from "@/lib/useChat";
import { ChatComposer } from "./ChatComposer";
import { ChatTranscript } from "./ChatTranscript";
import { Panel } from "./Panel";

/** The chat aside; owns the conversation state above the panel body. */
export function ChatDock({ onActionsApplied }: { onActionsApplied: (actions: ChatAction[]) => void }) {
  const chat = useChat(onActionsApplied);
  return (
    <aside className="w-[320px] shrink-0">
      <Panel title="AI Chat" testId={testIds.chatPanel} className="h-full">
        <div className="flex h-full min-h-0 flex-col">
          <ChatTranscript chat={chat} />
          <ChatComposer chat={chat} />
        </div>
      </Panel>
    </aside>
  );
}
