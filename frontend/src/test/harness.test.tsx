import { act, render, screen } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { FakeEventSource } from "../../vitest.setup";

const Fake = globalThis.EventSource as unknown as typeof FakeEventSource;

const points = [{ v: 1 }, { v: 3 }, { v: 2 }];

function HarnessProbe() {
  const wrapper = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const source = new EventSource("/api/stream/prices");
    source.onmessage = (event) => setMessage(event.data);
    const observer = new ResizeObserver(() => {});
    if (wrapper.current) observer.observe(wrapper.current);
    wrapper.current?.scrollIntoView();
    return () => {
      source.close();
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={wrapper}>
      <p>{message}</p>
      <div style={{ height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={points}>
            <Line dataKey="v" isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

describe("jsdom harness", () => {
  it("renders a Recharts svg inside ResponsiveContainer", () => {
    const { container } = render(<HarnessProbe />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("delivers emitted EventSource payloads to onmessage", () => {
    render(<HarnessProbe />);
    expect(Fake.instances).toHaveLength(1);
    expect(Fake.instances[0].url).toBe("/api/stream/prices");
    act(() => Fake.instances[0].emit({ AAPL: 1 }));
    expect(screen.getByText('{"AAPL":1}')).toBeInTheDocument();
  });

  it("moves readyState with open, fail and fail(true)", () => {
    render(<HarnessProbe />);
    const source = Fake.instances[0];
    source.open();
    expect(source.readyState).toBe(1);
    source.fail();
    expect(source.readyState).toBe(0);
    source.fail(true);
    expect(source.readyState).toBe(2);
  });

  it("stubs scrollIntoView", () => {
    render(<HarnessProbe />);
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
