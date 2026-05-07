import { describe, expect, it, vi, beforeEach } from "vitest";

// We re-import the module fresh in every test so the global state is reset.
async function freshStore() {
  vi.resetModules();
  // Force MOCK mode so registerAgent is deterministic.
  vi.stubEnv("MASUMI_MOCK", "true");
  vi.stubEnv("MASUMI_API_KEY", "");
  return await import("./store");
}

describe("graph store — bootstrapping", () => {
  beforeEach(() => {
    // Wipe the symbol-keyed slot used by the store.
    const KEY = Symbol.for("agridiffuse.graphStore.v2");
    delete (globalThis as Record<symbol, unknown>)[KEY];
  });

  it("getSnapshot returns a snapshot with all seed nodes on first call", async () => {
    const store = await freshStore();
    const snap = await store.getSnapshot();
    expect(snap.nodes.length).toBeGreaterThan(0);
    expect(snap.round).toBe(0);
  });

  it("getSnapshot assigns Masumi agent IDs to all experts on first call", async () => {
    const store = await freshStore();
    const snap = await store.getSnapshot();
    const experts = snap.nodes.filter((n) => n.type === "expert");
    for (const e of experts) {
      expect(e.type === "expert" && e.agentId).toBeTruthy();
      expect(typeof (e.type === "expert" ? e.agentId : null)).toBe("string");
    }
  });

  it("getSnapshot is idempotent — second call returns the same snapshot reference state", async () => {
    const store = await freshStore();
    const a = await store.getSnapshot();
    const b = await store.getSnapshot();
    expect(b.round).toBe(a.round);
    expect(b.nodes.length).toBe(a.nodes.length);
    expect(b.edges.length).toBe(a.edges.length);
  });
});

describe("graph store — mutations", () => {
  beforeEach(() => {
    const KEY = Symbol.for("agridiffuse.graphStore.v2");
    delete (globalThis as Record<symbol, unknown>)[KEY];
  });

  it("replaceSnapshot swaps in the provided snapshot", async () => {
    const store = await freshStore();
    const initial = await store.getSnapshot();
    const next = { ...initial, round: 42 };
    await store.replaceSnapshot(next);
    const after = await store.getSnapshot();
    expect(after.round).toBe(42);
  });

  it("resetSnapshot wipes round and clears all ADOPTED edges", async () => {
    const store = await freshStore();
    const initial = await store.getSnapshot();
    const adoptedSnap = {
      ...initial,
      round: 5,
      edges: [
        ...initial.edges,
        {
          id: "ad_test",
          type: "ADOPTED" as const,
          source: "f_wanjiru",
          target: "p_drip",
          date: "2026-01-01T00:00:00.000Z",
          outcome: "pending" as const,
          rewardTx: "0xtest",
          rewardAmount: 1,
          rewardExpertId: "e_meera",
          hopsFromExpert: 0,
          round: 5,
        },
      ],
    };
    await store.replaceSnapshot(adoptedSnap);
    const reset = await store.resetSnapshot();
    expect(reset.round).toBe(0);
    expect(reset.edges.filter((e) => e.type === "ADOPTED")).toHaveLength(0);
  });

  it("patchEdge updates a KNOWS edge's trustWeight and clamps to [0,1]", async () => {
    const store = await freshStore();
    const initial = await store.getSnapshot();
    const knowsEdge = initial.edges.find((e) => e.type === "KNOWS");
    expect(knowsEdge).toBeDefined();

    const patched = await store.patchEdge(knowsEdge!.id, { trustWeight: 1.5 });
    const updated = patched.edges.find((e) => e.id === knowsEdge!.id);
    expect(updated && updated.type === "KNOWS" && updated.trustWeight).toBe(1);

    const patched2 = await store.patchEdge(knowsEdge!.id, { trustWeight: -0.5 });
    const updated2 = patched2.edges.find((e) => e.id === knowsEdge!.id);
    expect(updated2 && updated2.type === "KNOWS" && updated2.trustWeight).toBe(0);
  });

  it("patchFarmer updates adoptionRate and clamps it", async () => {
    const store = await freshStore();
    const initial = await store.getSnapshot();
    const farmer = initial.nodes.find((n) => n.type === "farmer");
    expect(farmer).toBeDefined();

    const after = await store.patchFarmer(farmer!.id, { adoptionRate: 2.0 });
    const updated = after.nodes.find((n) => n.id === farmer!.id);
    expect(updated && updated.type === "farmer" && updated.adoptionRate).toBe(1);
  });

  it("patchEdge on an unknown edge id is a no-op (does not reject)", async () => {
    const store = await freshStore();
    await expect(store.patchEdge("does-not-exist", { trustWeight: 0.5 })).resolves.not.toThrow();
  });
});
