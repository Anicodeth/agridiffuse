/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies the neutral tone by default", () => {
    const { container } = render(<Badge>n</Badge>);
    expect(container.firstChild).toHaveClass("bg-stone-surface");
  });

  it("applies the ember tone when requested", () => {
    const { container } = render(<Badge tone="ember">e</Badge>);
    const cls = (container.firstChild as HTMLElement).className;
    expect(cls).toContain("text-ember");
  });

  it("applies the meadow tone when requested", () => {
    const { container } = render(<Badge tone="meadow">m</Badge>);
    expect((container.firstChild as HTMLElement).className).toContain("text-meadow");
  });

  it("renders an icon slot when provided", () => {
    render(
      <Badge icon={<span data-testid="ic">★</span>}>Starred</Badge>,
    );
    expect(screen.getByTestId("ic")).toBeInTheDocument();
  });
});
