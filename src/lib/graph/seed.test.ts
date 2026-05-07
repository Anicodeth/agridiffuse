import { describe, expect, it } from "vitest";
import { ADVISES, EXPERTS, FARMERS, KNOWS, PRACTICES, RECOMMENDS, buildSeedSnapshot } from "./seed";

describe("seed data — structural integrity", () => {
  it("contains exactly 3 experts, 15 farmers, and 5 practices", () => {
    expect(EXPERTS).toHaveLength(3);
    expect(FARMERS).toHaveLength(15);
    expect(PRACTICES).toHaveLength(5);
  });

  it("every node has a unique id", () => {
    const ids = [...EXPERTS, ...FARMERS, ...PRACTICES].map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every edge endpoint references an existing node", () => {
    const ids = new Set([...EXPERTS, ...FARMERS, ...PRACTICES].map((n) => n.id));
    const allEdges = [...RECOMMENDS, ...ADVISES, ...KNOWS];
    for (const e of allEdges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });

  it("every RECOMMENDS edge connects an expert to a practice", () => {
    const expertIds = new Set(EXPERTS.map((e) => e.id));
    const practiceIds = new Set(PRACTICES.map((p) => p.id));
    for (const r of RECOMMENDS) {
      expect(expertIds.has(r.source)).toBe(true);
      expect(practiceIds.has(r.target)).toBe(true);
    }
  });

  it("every ADVISES edge connects an expert to a farmer", () => {
    const expertIds = new Set(EXPERTS.map((e) => e.id));
    const farmerIds = new Set(FARMERS.map((f) => f.id));
    for (const a of ADVISES) {
      expect(expertIds.has(a.source)).toBe(true);
      expect(farmerIds.has(a.target)).toBe(true);
    }
  });

  it("every KNOWS edge connects two farmers", () => {
    const farmerIds = new Set(FARMERS.map((f) => f.id));
    for (const k of KNOWS) {
      expect(farmerIds.has(k.source)).toBe(true);
      expect(farmerIds.has(k.target)).toBe(true);
    }
  });

  it("contains a resistant cluster (at least 2 farmers with adoption_rate ≤ 0.25)", () => {
    const resistant = FARMERS.filter((f) => f.adoptionRate <= 0.25);
    expect(resistant.length).toBeGreaterThanOrEqual(2);
  });

  it("all credibility/adoption/trust scores are in [0, 1]", () => {
    for (const e of EXPERTS) {
      expect(e.credibilityScore).toBeGreaterThanOrEqual(0);
      expect(e.credibilityScore).toBeLessThanOrEqual(1);
    }
    for (const f of FARMERS) {
      expect(f.adoptionRate).toBeGreaterThanOrEqual(0);
      expect(f.adoptionRate).toBeLessThanOrEqual(1);
    }
    for (const k of KNOWS) {
      expect(k.trustWeight).toBeGreaterThanOrEqual(0);
      expect(k.trustWeight).toBeLessThanOrEqual(1);
    }
  });

  it("buildSeedSnapshot produces round 0 with all nodes and non-adoption edges", () => {
    const snap = buildSeedSnapshot();
    expect(snap.round).toBe(0);
    expect(snap.nodes).toHaveLength(EXPERTS.length + FARMERS.length + PRACTICES.length);
    expect(snap.edges.filter((e) => e.type === "ADOPTED")).toHaveLength(0);
  });

  it("buildSeedSnapshot returns a fresh object on each call (no shared mutation)", () => {
    const a = buildSeedSnapshot();
    const b = buildSeedSnapshot();
    expect(a).not.toBe(b);
    a.round = 99;
    expect(b.round).toBe(0);
  });
});
