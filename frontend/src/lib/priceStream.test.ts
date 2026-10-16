import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFrame, makeFrameEntry } from "@/test/fixtures";
import type { FakeEventSource } from "../../vitest.setup";
import { getEntry, getStatus, subscribeStatus, type ConnectionStatus } from "./priceStore";
import { RECREATE_DELAY_MS, STREAM_URL, connectPriceStream, statusFromReadyState } from "./priceStream";

const Fake = globalThis.EventSource as unknown as typeof FakeEventSource;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("connectPriceStream", () => {
  it("creates one stream at the relative price URL", () => {
    connectPriceStream();
    expect(Fake.instances).toHaveLength(1);
    expect(Fake.instances[0].url).toBe("/api/stream/prices");
    expect(STREAM_URL).toBe("/api/stream/prices");
  });

  it("keeps reconnecting when a message arrives before open", () => {
    connectPriceStream();
    Fake.instances[0].emit(makeFrame(makeFrameEntry("AAPL", 100, 1)));
    expect(getStatus()).toBe("reconnecting");
  });

  it("becomes connected on open and merges emitted frames", () => {
    connectPriceStream();
    Fake.instances[0].open();
    Fake.instances[0].emit(makeFrame(makeFrameEntry("AAPL", 100, 1)));
    expect(getStatus()).toBe("connected");
    expect(getEntry("AAPL")?.price).toBe(100);
  });

  it("reports reconnecting on an error while CONNECTING, without a new instance", () => {
    connectPriceStream();
    Fake.instances[0].open();
    Fake.instances[0].fail();
    expect(getStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(5000);
    expect(Fake.instances).toHaveLength(1);
  });

  it("reports disconnected on CLOSED and recreates the stream after exactly 1000 ms", () => {
    connectPriceStream();
    Fake.instances[0].fail(true);
    expect(getStatus()).toBe("disconnected");
    vi.advanceTimersByTime(RECREATE_DELAY_MS - 1);
    expect(Fake.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(Fake.instances).toHaveLength(2);
    Fake.instances[1].open();
    expect(getStatus()).toBe("connected");
  });

  it("stays disconnected without passing through reconnecting while the server keeps failing", () => {
    const seen: ConnectionStatus[] = [];
    subscribeStatus(() => seen.push(getStatus()));
    connectPriceStream();
    Fake.instances[0].fail(true);
    vi.advanceTimersByTime(RECREATE_DELAY_MS);
    Fake.instances[1].fail(true);
    expect(getStatus()).toBe("disconnected");
    vi.advanceTimersByTime(RECREATE_DELAY_MS);
    expect(Fake.instances).toHaveLength(3);
    expect(seen).toEqual(["disconnected"]);
  });

  it("closes the current stream on cleanup", () => {
    const cleanup = connectPriceStream();
    cleanup();
    expect(Fake.instances[0].readyState).toBe(2);
  });

  it("creates no stream after cleanup with a recreate timer pending", () => {
    const cleanup = connectPriceStream();
    Fake.instances[0].fail(true);
    cleanup();
    vi.advanceTimersByTime(5000);
    expect(Fake.instances).toHaveLength(1);
  });

  it("leaves exactly one open stream after connect, cleanup, connect", () => {
    connectPriceStream()();
    connectPriceStream();
    const open = Fake.instances.filter((instance) => instance.readyState !== 2);
    expect(open).toHaveLength(1);
  });
});

describe("statusFromReadyState", () => {
  it("maps 0, 1 and 2 to reconnecting, connected and disconnected", () => {
    expect(statusFromReadyState(0)).toBe("reconnecting");
    expect(statusFromReadyState(1)).toBe("connected");
    expect(statusFromReadyState(2)).toBe("disconnected");
  });
});
