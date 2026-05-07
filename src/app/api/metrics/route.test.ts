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

describe("GET /api/metrics", () => {
  it("returns all four metric collections shaped correctly at round 0", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      practiceAdoption: unknown[];
      expertReach: unknown[];
      expertEarnings: unknown[];
      deepestChain: { length: number };
      round: number;
    };
    expect(Array.isArray(body.practiceAdoption)).toBe(true);
    expect(Array.isArray(body.expertReach)).toBe(true);
    expect(Array.isArray(body.expertEarnings)).toBe(true);
    expect(body.deepestChain.length).toBe(0);
    expect(body.round).toBe(0);
  });
});
