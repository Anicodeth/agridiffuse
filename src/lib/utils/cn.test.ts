import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins simple class strings with a single space", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters falsy values (false, undefined, null, 0, empty string)", () => {
    expect(cn("foo", false, undefined, null, 0 as unknown as string, "", "bar")).toBe("foo bar");
  });

  it("handles object form for conditional classes", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("flattens arrays", () => {
    expect(cn(["foo", ["bar", "baz"]])).toBe("foo bar baz");
  });

  it("merges conflicting Tailwind classes — last write wins", () => {
    expect(cn("p-4 p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("bg-midnight bg-charcoal")).toBe("bg-charcoal");
  });

  it("preserves arbitrary modifiers like hover: prefixes", () => {
    expect(cn("hover:bg-red-500", "hover:bg-blue-500")).toBe("hover:bg-blue-500");
  });

  it("returns empty string when given nothing", () => {
    expect(cn()).toBe("");
  });
});
