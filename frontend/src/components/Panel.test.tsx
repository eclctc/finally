import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Panel } from "@/components/Panel";

describe("Panel actions slot", () => {
  it("renders actions after the heading in an ml-auto wrapper", () => {
    render(<Panel title="Demo" actions={<button type="button">Act</button>} />);
    const header = screen.getByRole("heading", { name: "Demo" }).parentElement as HTMLElement;
    expect(header.tagName).toBe("HEADER");
    expect(header.children).toHaveLength(2);
    const wrapper = header.children[1];
    expect(wrapper).toHaveClass("ml-auto");
    expect(wrapper).toContainElement(screen.getByRole("button", { name: "Act" }));
  });

  it("renders only the heading without actions", () => {
    render(<Panel title="Demo" />);
    const header = screen.getByRole("heading", { name: "Demo" }).parentElement as HTMLElement;
    expect(header.children).toHaveLength(1);
  });
});
