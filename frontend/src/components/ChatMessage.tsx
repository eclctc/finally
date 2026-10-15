import type { ChatEntry } from "@/lib/types";
import { ChatActionItem } from "./ChatActionItem";

/** One chat bubble with any executed actions listed beneath it. */
export function ChatMessage({ entry }: { entry: ChatEntry }) {
  const isUser = entry.role === "user";
  return (
    <div data-testid="chat-message" data-role={entry.role} className={`flex flex-col gap-1 ${isUser ? "items-end" : ""}`}>
      <p
        className={`max-w-[90%] whitespace-pre-wrap px-3 py-2 leading-relaxed ${
          isUser ? "bg-secondary/40 text-text" : "border border-line bg-raised text-text"
        }`}
      >
        {entry.content}
      </p>
      {entry.actions.length > 0 && (
        <ul className="flex w-[90%] flex-col gap-1">
          {entry.actions.map((action, index) => (
            <ChatActionItem key={index} action={action} />
          ))}
        </ul>
      )}
    </div>
  );
}
