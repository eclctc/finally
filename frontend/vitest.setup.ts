import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { resetPriceStore } from "./src/lib/priceStore";

class FixedSizeResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    const contentRect = { width: 800, height: 400 } as DOMRectReadOnly;
    this.callback([{ target, contentRect } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

/** Controllable EventSource double: tests call emit()/fail() on the latest instance. */
export class FakeEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  open() {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
  fail(closed = false) {
    this.readyState = closed ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING;
    this.onerror?.();
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
}

globalThis.ResizeObserver = FixedSizeResizeObserver;
globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;
window.HTMLElement.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  FakeEventSource.instances = [];
  resetPriceStore();
});
