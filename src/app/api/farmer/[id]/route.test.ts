/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("MASUMI_MOCK", "true");
  const KEY = Symbol.for("agridiffuse.graphStore.v2");
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

describe("PATCH /api/farmer/:id", () => {
  it("updates a farmer's adoptionRate", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request(`http://localhost/api/farmer/f_wanjiru`, {
        method: "PATCH",
        body: JSON.stringify({ adoptionRate: 0.1 }),
      }),
      { params: Promise.resolve({ id: "f_wanjiru" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      nodes: Array<{ id: string; type: string; adoptionRate?: number }>;
    };
    const farmer = body.nodes.find((n) => n.id === "f_wanjiru");
    expect(farmer?.adoptionRate).toBe(0.1);
  });

  it("clamps adoptionRate to [0, 1]", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request(`http://localhost/api/farmer/f_wanjiru`, {
        method: "PATCH",
        body: JSON.stringify({ adoptionRate: -5 }),
      }),
      { params: Promise.resolve({ id: "f_wanjiru" }) },
    );
    const body = (await res.json()) as {
      nodes: Array<{ id: string; type: string; adoptionRate?: number }>;
    };
    const farmer = body.nodes.find((n) => n.id === "f_wanjiru");
    expect(farmer?.adoptionRate).toBe(0);
  });
});
