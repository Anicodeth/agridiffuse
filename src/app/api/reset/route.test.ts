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

describe("POST /api/reset", () => {
  it("returns a fresh snapshot at round 0 with no ADOPTED edges", async () => {
    const round = await import("../round/route");
    await round.POST();
    await round.POST();

    const reset = await import("./route");
    const res = await reset.POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { round: number; edges: Array<{ type: string }> };
    expect(body.round).toBe(0);
    expect(body.edges.filter((e) => e.type === "ADOPTED")).toHaveLength(0);
  });
});
