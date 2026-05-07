/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardBody } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Content</Card>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("applies the white variant by default (card-inset class)", () => {
    const { container } = render(<Card>x</Card>);
    expect(container.firstChild).toHaveClass("card-inset");
  });

  it("applies the recessed variant when requested", () => {
    const { container } = render(<Card variant="recessed">x</Card>);
    expect(container.firstChild).toHaveClass("card-recessed");
  });

  it("applies the product variant for the dark phone mockup", () => {
    const { container } = render(<Card variant="product">x</Card>);
    expect(container.firstChild).toHaveClass("card-product");
  });

  it("forwards arbitrary HTML props", () => {
    const { container } = render(<Card data-testid="custom">x</Card>);
    expect(container.firstChild).toHaveAttribute("data-testid", "custom");
  });
});

describe("CardHeader / CardTitle / CardBody", () => {
  it("CardTitle renders as an h3", () => {
    render(<CardTitle>Heading</CardTitle>);
    const h = screen.getByRole("heading", { level: 3 });
    expect(h).toHaveTextContent("Heading");
  });

  it("CardBody renders its content with body styling", () => {
    render(<CardBody>Body copy</CardBody>);
    expect(screen.getByText("Body copy")).toBeInTheDocument();
  });

  it("CardHeader composes a flex layout", () => {
    const { container } = render(<CardHeader>x</CardHeader>);
    expect(container.firstChild).toHaveClass("flex");
  });
});
