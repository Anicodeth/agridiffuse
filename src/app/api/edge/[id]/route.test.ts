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

describe("PATCH /api/edge/:id", () => {
  it("updates a KNOWS edge's trustWeight", async () => {
    const graph = await import("../../graph/route");
    const initial = (await (await graph.GET()).json()) as {
      edges: Array<{ id: string; type: string }>;
    };
    const knows = initial.edges.find((e) => e.type === "KNOWS")!;
    expect(knows).toBeDefined();

    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request(`http://localhost/api/edge/${knows.id}`, {
        method: "PATCH",
        body: JSON.stringify({ trustWeight: 0.33 }),
      }),
      { params: Promise.resolve({ id: knows.id }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      edges: Array<{ id: string; type: string; trustWeight?: number }>;
    };
    const updated = body.edges.find((e) => e.id === knows.id);
    expect(updated?.trustWeight).toBe(0.33);
  });

  it("clamps trustWeight to [0, 1]", async () => {
    const graph = await import("../../graph/route");
    const initial = (await (await graph.GET()).json()) as {
      edges: Array<{ id: string; type: string }>;
    };
    const knows = initial.edges.find((e) => e.type === "KNOWS")!;
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request(`http://localhost/api/edge/${knows.id}`, {
        method: "PATCH",
        body: JSON.stringify({ trustWeight: 99 }),
      }),
      { params: Promise.resolve({ id: knows.id }) },
    );
    const body = (await res.json()) as {
      edges: Array<{ id: string; type: string; trustWeight?: number }>;
    };
    const updated = body.edges.find((e) => e.id === knows.id);
    expect(updated?.trustWeight).toBe(1);
  });
});
