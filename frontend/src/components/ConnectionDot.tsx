"use client";

import { useConnectionStatus } from "@/lib/usePrice";
import { testIds } from "@/lib/testIds";

const STATUS_CLASS = { connected: "bg-up", reconnecting: "bg-accent", disconnected: "bg-down" };
const STATUS_LABEL = { connected: "Connected", reconnecting: "Reconnecting", disconnected: "Disconnected" };

/** Stream status dot; the hidden label is its accessible name and its live announcement. */
export function ConnectionDot() {
  const status = useConnectionStatus();
  const label = STATUS_LABEL[status];
  return (
    <span
      role="status"
      data-testid={testIds.connectionStatus}
      data-status={status}
      title={label}
      className={`relative size-2.5 shrink-0 rounded-full ${STATUS_CLASS[status]}`}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
