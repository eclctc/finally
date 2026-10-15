import type { ConnectionStatus } from "@/lib/types";

const DOT_COLORS: Record<ConnectionStatus, string> = {
  connected: "bg-up",
  reconnecting: "bg-accent",
  disconnected: "bg-down",
};

const LABELS: Record<ConnectionStatus, string> = {
  connected: "Live",
  reconnecting: "Reconnecting",
  disconnected: "Offline",
};

/** Colored dot showing the price stream connection state. */
export function ConnectionDot({ status }: { status: ConnectionStatus }) {
  return (
    <div className="flex items-center gap-2 text-muted" title={`Price stream: ${LABELS[status]}`}>
      <span
        data-testid="connection-status"
        data-status={status}
        className={`inline-block h-2 w-2 rounded-full ${DOT_COLORS[status]}`}
      />
      <span>{LABELS[status]}</span>
    </div>
  );
}
