import { describeAction } from "@/lib/chat";
import type { ChatAction } from "@/lib/chat";
import { testIds } from "@/lib/testIds";
import type { ChatMessage } from "@/lib/useChat";

const BUBBLE_CLASS = {
  user: "ml-auto max-w-[85%] whitespace-pre-wrap break-words border border-line bg-surface px-2 py-1 text-text",
  assistant: "max-w-[85%] whitespace-pre-wrap break-words border border-line bg-panel px-2 py-1 text-text",
} as const;

const SENDER_NAME = { user: "You ", assistant: "FinAlly " } as const;

const CHIP_TONE = {
  ok: "border-line text-text",
  failed: "border-down/50 text-down",
} as const;

function ChatActionList({ actions }: { actions: ChatAction[] }) {
  if (actions.length === 0) return null;
  return (
    <ul aria-label="Actions" className="mt-1 flex max-w-[85%] flex-col gap-1">
      {actions.map((action, index) => (
        <li
          key={index}
          data-testid={testIds.chatAction}
          data-status={action.status}
          className={`figures break-words border bg-surface px-2 py-1 text-[11px] ${CHIP_TONE[action.status]}`}
        >
          {describeAction(action)}
        </li>
      ))}
    </ul>
  );
}

/** One message bubble with its inline action chips; all text renders as plain text nodes. */
export function ChatBubble({ role, content, actions }: ChatMessage) {
  return (
    <div className="flex flex-col">
      <div data-testid={testIds.chatMessage} data-role={role} className={BUBBLE_CLASS[role]}>
        <span className="sr-only">{SENDER_NAME[role]}</span>
        {content}
      </div>
      <ChatActionList actions={actions} />
    </div>
  );
}
