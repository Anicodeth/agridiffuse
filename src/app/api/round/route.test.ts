/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("MASUMI_MOCK", "true");
  vi.stubEnv("MASUMI_API_KEY", "");
  vi.stubEnv("FEATHERLESS_API_KEY", "");
  const KEY = Symbol.for("agridiffuse.graphStore.v2");
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

describe("POST /api/round", () => {
  it("advances the round and returns a result with a narrative", async () => {
    const { POST } = await import("./route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      snapshot: { round: number };
      result: { round: number; narrative: string };
    };
    expect(body.snapshot.round).toBe(1);
    expect(body.result.round).toBe(1);
    expect(typeof body.result.narrative).toBe("string");
    expect(body.result.narrative.length).toBeGreaterThan(0);
  });

  it("persists the new round so a follow-up GET reflects it", async () => {
    const round = await import("./route");
    await round.POST();
    const graph = await import("../graph/route");
    const graphRes = await graph.GET();
    const body = (await graphRes.json()) as { round: number };
    expect(body.round).toBe(1);
  });
});
