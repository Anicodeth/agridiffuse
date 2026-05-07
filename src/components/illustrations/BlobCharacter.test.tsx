/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BlobCharacter, Coin, StarShape, Sprout } from "./BlobCharacter";

describe("BlobCharacter", () => {
  it("renders an SVG of the requested size", () => {
    const { container } = render(<BlobCharacter size={88} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("88");
    expect(svg?.getAttribute("height")).toBe("88");
  });

  it("uses the ember palette by default", () => {
    const { container } = render(<BlobCharacter />);
    const path = container.querySelector("path[fill]");
    expect(path?.getAttribute("fill")).toBe("#ff3e00");
  });

  it("switches the body fill when a different color is requested", () => {
    const { container } = render(<BlobCharacter color="meadow" />);
    const path = container.querySelector("path[fill]");
    expect(path?.getAttribute("fill")).toBe("#00ca48");
  });

  it("renders a winking eye for the wink mood", () => {
    const { container } = render(<BlobCharacter mood="wink" />);
    // wink replaces the right circle eye with a path
    const eyePaths = container.querySelectorAll("path[d^='M68']");
    expect(eyePaths.length).toBeGreaterThan(0);
  });

  it("renders an oval mouth for the surprised mood", () => {
    const { container } = render(<BlobCharacter mood="surprised" />);
    const ellipses = container.querySelectorAll("ellipse");
    expect(ellipses.length).toBe(1);
  });

  it("is decoration only — aria-hidden is set", () => {
    const { container } = render(<BlobCharacter />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Coin / StarShape / Sprout", () => {
  it("Coin renders the ADA glyph", () => {
    const { container } = render(<Coin />);
    expect(container.textContent).toContain("₳");
  });

  it("StarShape renders an SVG path", () => {
    const { container } = render(<StarShape />);
    expect(container.querySelector("path")).not.toBeNull();
  });

  it("Sprout renders an SVG with the meadow stem color", () => {
    const { container } = render(<Sprout />);
    const stem = container.querySelector("path[stroke='#00963a']");
    expect(stem).not.toBeNull();
  });
});
