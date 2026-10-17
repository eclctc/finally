"use client";

import { testIds } from "@/lib/testIds";

/** Collapsed 40px chat rail: one full-height button that expands the panel. */
export function ChatRail({ onExpand }: { onExpand: () => void }) {
  return (
    <section data-testid={testIds.chatPanel} aria-label="AI Chat" className="flex h-full flex-col border border-line bg-panel">
      <button
        type="button"
        data-testid={testIds.chatToggle}
        aria-expanded="false"
        aria-label="Expand AI Chat"
        title="Expand AI Chat"
        autoFocus
        onClick={onExpand}
        className="flex h-full w-full flex-col items-center gap-2 pt-2 text-muted hover:text-text focus-visible:outline-2 outline-primary"
      >
        <span aria-hidden="true">‹</span>
        <span className="text-[11px] font-semibold [writing-mode:vertical-rl]">AI Chat</span>
      </button>
    </section>
  );
}
