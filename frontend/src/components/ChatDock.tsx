"use client";

import { useState } from "react";
import type { ChatAction } from "@/lib/chat";
import { testIds } from "@/lib/testIds";
import { useChat } from "@/lib/useChat";
import { ChatComposer } from "./ChatComposer";
import { ChatRail } from "./ChatRail";
import { ChatTranscript } from "./ChatTranscript";
import { Panel } from "./Panel";

/** The chat aside; owns the conversation state above the panel body so collapse keeps it. */
export function ChatDock({ onActionsApplied }: { onActionsApplied: (actions: ChatAction[]) => void }) {
  const chat = useChat(onActionsApplied);
  const [collapsed, setCollapsed] = useState(false);
  const [toggled, setToggled] = useState(false);
  const toggle = () => {
    setToggled(true);
    setCollapsed((current) => !current);
  };

  if (collapsed) {
    return (
      <aside className="w-10 shrink-0">
        <ChatRail onExpand={toggle} />
      </aside>
    );
  }

  const collapseButton = (
    <button
      type="button"
      data-testid={testIds.chatToggle}
      aria-expanded="true"
      aria-label="Collapse AI Chat"
      title="Collapse AI Chat"
      onClick={toggle}
      className="size-6 text-muted hover:text-text focus-visible:outline-2 outline-primary"
    >
      ›
    </button>
  );

  return (
    <aside className="w-[320px] shrink-0">
      <Panel title="AI Chat" testId={testIds.chatPanel} className="h-full" actions={collapseButton}>
        <div className="flex h-full min-h-0 flex-col">
          <ChatTranscript chat={chat} />
          <ChatComposer chat={chat} autoFocus={toggled} />
        </div>
      </Panel>
    </aside>
  );
}
