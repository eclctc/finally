import { mergeFrame, setStatus, type ConnectionStatus } from "./priceStore";

export const STREAM_URL = "/api/stream/prices";
/** Matches the server's `retry: 1000` hint. */
export const RECREATE_DELAY_MS = 1000;

/** Map an EventSource readyState to the connection status shown in the header. */
export function statusFromReadyState(readyState: number): ConnectionStatus {
  if (readyState === EventSource.OPEN) return "connected";
  if (readyState === EventSource.CLOSED) return "disconnected";
  return "reconnecting";
}

/** Open the one price stream, recreate it after a CLOSED error, and return the cleanup. */
export function connectPriceStream(): () => void {
  let source: EventSource | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function open() {
    const stream = new EventSource(STREAM_URL);
    source = stream;
    stream.onopen = () => setStatus("connected");
    stream.onmessage = (event) => mergeFrame(JSON.parse(event.data));
    stream.onerror = () => {
      setStatus(statusFromReadyState(stream.readyState));
      if (stream.readyState === EventSource.CLOSED) timer = setTimeout(open, RECREATE_DELAY_MS);
    };
  }

  open();
  return () => {
    clearTimeout(timer);
    source?.close();
  };
}
