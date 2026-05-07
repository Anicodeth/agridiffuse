/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("MASUMI_MOCK", "true");
  vi.stubEnv("FEATHERLESS_API_KEY", "");
  const KEY = Symbol.for("agridiffuse.graphStore.v2");
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

describe("GET /api/node/:id", () => {
  it("returns 404 when the node does not exist", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/node/no-such"), {
      params: Promise.resolve({ id: "no-such" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns node + neighbors + edges + history for an expert", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/node/e_meera"), {
      params: Promise.resolve({ id: "e_meera" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      node: { id: string; type: string };
      neighbors: unknown[];
      edges: unknown[];
      history: string[];
    };
    expect(body.node.id).toBe("e_meera");
    expect(body.node.type).toBe("expert");
    expect(Array.isArray(body.neighbors)).toBe(true);
    expect(body.neighbors.length).toBeGreaterThan(0);
  });
});

describe("POST /api/node/:id (action: explain)", () => {
  it("returns 400 for an unknown action", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/node/e_meera", {
        method: "POST",
        body: JSON.stringify({ action: "bogus" }),
      }),
      { params: Promise.resolve({ id: "e_meera" }) },
    );
    expect(res.status).toBe(400);
  });

  it("returns an explanation string for action: explain", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/node/e_meera", {
        method: "POST",
        body: JSON.stringify({ action: "explain" }),
      }),
      { params: Promise.resolve({ id: "e_meera" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { explanation: string };
    expect(typeof body.explanation).toBe("string");
    expect(body.explanation.length).toBeGreaterThan(0);
  });

  it("returns 404 when explaining a missing node", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/node/nope", {
        method: "POST",
        body: JSON.stringify({ action: "explain" }),
      }),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(res.status).toBe(404);
  });
});
