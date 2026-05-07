/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("MASUMI_MOCK", "true");
  vi.stubEnv("MASUMI_API_KEY", "");
  const KEY = Symbol.for("agridiffuse.graphStore.v2");
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

describe("GET /api/graph", () => {
  it("returns the seed snapshot with experts having agent IDs", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { nodes: Array<{ type: string; agentId?: string | null }>; round: number };
    expect(body.round).toBe(0);
    const experts = body.nodes.filter((n) => n.type === "expert");
    for (const e of experts) {
      expect(typeof e.agentId).toBe("string");
    }
  });
});
