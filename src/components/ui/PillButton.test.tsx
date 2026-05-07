/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PillButton } from "./PillButton";

describe("PillButton — rendering", () => {
  it("renders as a <button> when no href is given", () => {
    render(<PillButton>Click</PillButton>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.tagName).toBe("BUTTON");
  });

  it("renders as a Next <Link> (anchor) when href is given", () => {
    render(<PillButton href="/foo">Go</PillButton>);
    const link = screen.getByRole("link", { name: "Go" });
    expect(link).toHaveAttribute("href", "/foo");
  });

  it("opens external links in a new tab with safe rel attributes", () => {
    render(
      <PillButton href="https://example.com" external>
        External
      </PillButton>,
    );
    const link = screen.getByRole("link", { name: "External" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("forwards leading and trailing icons", () => {
    render(
      <PillButton
        leadingIcon={<span data-testid="leading">L</span>}
        trailingIcon={<span data-testid="trailing">T</span>}
      >
        Action
      </PillButton>,
    );
    expect(screen.getByTestId("leading")).toBeInTheDocument();
    expect(screen.getByTestId("trailing")).toBeInTheDocument();
  });
});

describe("PillButton — variants and sizes", () => {
  it("applies the dark variant by default", () => {
    render(<PillButton>Default</PillButton>);
    expect(screen.getByRole("button")).toHaveClass("bg-midnight");
  });

  it("applies the light variant when requested", () => {
    render(<PillButton variant="light">Light</PillButton>);
    expect(screen.getByRole("button")).toHaveClass("bg-stone-surface");
  });

  it("applies the ghost variant when requested", () => {
    render(<PillButton variant="ghost">Ghost</PillButton>);
    expect(screen.getByRole("button")).toHaveClass("text-ember");
  });

  it("applies size classes", () => {
    const { rerender } = render(<PillButton size="sm">S</PillButton>);
    expect(screen.getByRole("button")).toHaveClass("h-9");
    rerender(<PillButton size="lg">L</PillButton>);
    expect(screen.getByRole("button")).toHaveClass("h-12");
  });

  it("merges user className with variant defaults (last wins on conflicts)", () => {
    render(
      <PillButton className="bg-coral" variant="dark">
        Override
      </PillButton>,
    );
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-coral");
    expect(btn.className).not.toContain("bg-midnight");
  });
});

describe("PillButton — interaction", () => {
  it("invokes onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<PillButton onClick={onClick}>Click</PillButton>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("respects the disabled prop", async () => {
    const onClick = vi.fn();
    render(
      <PillButton onClick={onClick} disabled>
        Disabled
      </PillButton>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
