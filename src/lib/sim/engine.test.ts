import { describe, expect, it, vi } from "vitest";
import { runRound } from "./engine";
import * as fixtures from "../../../tests/fixtures/graph";
import type { AdoptedEdge, GraphSnapshot } from "@/lib/graph/types";

const isAdopted = (e: { type: string }): e is AdoptedEdge => e.type === "ADOPTED";

describe("runRound — round bookkeeping", () => {
  it("increments the round number by 1", async () => {
    const start = fixtures.snapshot({ round: 5 });
    const { snapshot } = await runRound(start, { seed: 1 });
    expect(snapshot.round).toBe(6);
  });

  it("never mutates the input snapshot", async () => {
    const start = fixtures.snapshot();
    const before = JSON.stringify(start);
    await runRound(start, { seed: 1 });
    expect(JSON.stringify(start)).toBe(before);
  });

  it("returns a result with all required fields", async () => {
    const { result } = await runRound(fixtures.snapshot(), { seed: 1 });
    expect(result).toMatchObject({
      round: expect.any(Number),
      events: expect.any(Array),
      newAdoptions: expect.any(Number),
      blockedAttempts: expect.any(Number),
      totalRewardDistributed: expect.any(Number),
      deepestChainLength: expect.any(Number),
      narrative: "", // populated by API route, not the engine
    });
  });

  it("is deterministic with a fixed seed — running twice yields identical results", async () => {
    const start = fixtures.snapshot();
    const a = await runRound(start, { seed: 999 });
    const b = await runRound(start, { seed: 999 });
    expect(b.snapshot.edges.filter(isAdopted)).toEqual(a.snapshot.edges.filter(isAdopted));
    expect(b.result.newAdoptions).toBe(a.result.newAdoptions);
  });
});

describe("runRound — direct ADVISES seeding (Pass 1)", () => {
  it("can produce direct adoptions when probabilities are favorable", async () => {
    // High credibility × high adoption rate → expected probability ~0.4 per attempt.
    // With many seeds, we should see at least one direct adoption land.
    const start = fixtures.snapshot();
    let foundDirect = false;
    for (let seed = 0; seed < 30; seed += 1) {
      const { result } = await runRound(start, { seed });
      const direct = result.events.filter(
        (e) => e.kind === "adopted" && e.via === "advises" && e.hopsFromExpert === 0,
      );
      if (direct.length > 0) {
        foundDirect = true;
        break;
      }
    }
    expect(foundDirect).toBe(true);
  });

  it("never adopts a practice the farmer already adopted", async () => {
    const start = fixtures.snapshotWithPriorAdoption();
    const { snapshot } = await runRound(start, { seed: 1 });
    const adoptions = snapshot.edges.filter(isAdopted);
    const seen = new Set<string>();
    for (const a of adoptions) {
      const key = `${a.source}|${a.target}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("emits an 'already-adopted' blocked event when revisiting an existing adoption", async () => {
    const start = fixtures.snapshotWithPriorAdoption();
    const { result } = await runRound(start, { seed: 1 });
    const alreadyAdopted = result.events.filter(
      (e) => e.kind === "blocked" && e.reason === "already-adopted",
    );
    // f_seed already adopted p_one; ADVISES from e_a → f_seed will produce one such block
    expect(alreadyAdopted.length).toBeGreaterThanOrEqual(1);
  });

  it("blocks adoption when the farmer's adoption rate is near zero", async () => {
    // Resistant farmer with 0.05 adoption rate
    const resistant = fixtures.snapshot({
      nodes: [
        fixtures.expert({ id: "e_a", credibilityScore: 0.99 }),
        fixtures.farmer({ id: "f_resist", adoptionRate: 0.05 }),
        fixtures.practice({ id: "p_one" }),
      ],
      edges: [
        fixtures.recommends({ id: "r1", source: "e_a", target: "p_one" }),
        fixtures.advises({ id: "a1", source: "e_a", target: "f_resist" }),
      ],
    });

    let directAdoptions = 0;
    for (let seed = 0; seed < 50; seed += 1) {
      const { result } = await runRound(resistant, { seed });
      directAdoptions += result.events.filter(
        (e) => e.kind === "adopted" && e.via === "advises",
      ).length;
    }
    // 0.99 × 0.05 × 0.45 = 0.022; over 50 seeds we expect ~1 adoption — should usually be 0–3.
    expect(directAdoptions).toBeLessThan(8);
  });
});

describe("runRound — trust-weighted relay (Pass 2)", () => {
  it("can relay an existing adoption to a high-trust peer", async () => {
    const start = fixtures.snapshotWithPriorAdoption();
    let observedRelay = false;
    for (let seed = 0; seed < 30; seed += 1) {
      const { result } = await runRound(start, { seed });
      const relays = result.events.filter(
        (e) => e.kind === "adopted" && e.via === "relay" && e.sourceId === "f_seed",
      );
      if (relays.some((r) => r.kind === "adopted" && r.farmerId === "f_high")) {
        observedRelay = true;
        break;
      }
    }
    expect(observedRelay).toBe(true);
  });

  it("blocks relays across very low-trust ties more often than high-trust ties", async () => {
    const start = fixtures.snapshotWithPriorAdoption();
    let highTrustAdoptions = 0;
    let lowTrustAdoptions = 0;
    for (let seed = 0; seed < 50; seed += 1) {
      const { result } = await runRound(start, { seed });
      for (const e of result.events) {
        if (e.kind !== "adopted" || e.via !== "relay") continue;
        if (e.farmerId === "f_high") highTrustAdoptions += 1;
        if (e.farmerId === "f_low") lowTrustAdoptions += 1;
      }
    }
    expect(highTrustAdoptions).toBeGreaterThan(lowTrustAdoptions);
  });

  it("relayed adoptions inherit a hopsFromExpert > 0", async () => {
    const start = fixtures.snapshotWithPriorAdoption();
    for (let seed = 0; seed < 30; seed += 1) {
      const { snapshot } = await runRound(start, { seed });
      const newAdoptions = snapshot.edges.filter(isAdopted).filter((e) => e.round === 2);
      const relays = newAdoptions.filter((e) => e.id !== "ad_seed_one");
      for (const r of relays) {
        if (r.hopsFromExpert !== null) {
          expect(r.hopsFromExpert).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("runRound — reward routing", () => {
  it("calls payReward for each new adoption with a traceable expert ancestor", async () => {
    const start = fixtures.snapshot();
    const payReward = vi.fn().mockResolvedValue({ txHash: "0xtest" });
    const { result } = await runRound(start, { seed: 3, payReward });

    const directAdoptions = result.events.filter(
      (e) => e.kind === "adopted" && e.expertAncestorId !== null,
    ).length;
    expect(payReward).toHaveBeenCalledTimes(directAdoptions);
  });

  it("computes reward = base × 0.5^hops for each adoption", async () => {
    const payReward = vi.fn().mockResolvedValue({ txHash: "0xtest" });
    await runRound(fixtures.snapshotWithPriorAdoption(), {
      seed: 3,
      baseReward: 4,
      payReward,
    });

    for (const call of payReward.mock.calls) {
      const [, amount, ctx] = call as [string, number, { hops: number }];
      expect(amount).toBeCloseTo(4 * Math.pow(0.5, ctx.hops));
    }
  });

  it("attaches rewardTx and rewardAmount to the persisted ADOPTED edge when payReward succeeds", async () => {
    const start = fixtures.snapshot();
    const payReward = vi.fn().mockResolvedValue({ txHash: "0xabc123" });
    const { snapshot } = await runRound(start, { seed: 3, payReward });

    const newAdoptions = snapshot.edges.filter(isAdopted);
    for (const a of newAdoptions) {
      if (a.rewardExpertId !== null) {
        expect(a.rewardTx).toBe("0xabc123");
        expect(a.rewardAmount).toBeGreaterThan(0);
      }
    }
  });

  it("totalRewardDistributed equals the sum of rewardAmount across new adoptions", async () => {
    const payReward = vi.fn().mockResolvedValue({ txHash: "0xtest" });
    const { snapshot, result } = await runRound(fixtures.snapshot(), {
      seed: 5,
      payReward,
    });
    const sum = snapshot.edges
      .filter(isAdopted)
      .reduce((acc, a) => acc + (a.rewardAmount ?? 0), 0);
    expect(result.totalRewardDistributed).toBeCloseTo(sum, 6);
  });

  it("does not call payReward when payReward is not provided", async () => {
    const { snapshot, result } = await runRound(fixtures.snapshot(), { seed: 3 });
    const newAdoptions = snapshot.edges.filter(isAdopted);
    expect(result.totalRewardDistributed).toBe(0);
    for (const a of newAdoptions) {
      expect(a.rewardTx).toBeNull();
      expect(a.rewardAmount).toBeNull();
    }
  });
});

describe("runRound — invariants", () => {
  it("[property] new adoption count is never negative", async () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const { result } = await runRound(fixtures.snapshot(), { seed });
      expect(result.newAdoptions).toBeGreaterThanOrEqual(0);
    }
  });

  it("[property] number of adopted edges only grows or stays the same", async () => {
    let snap: GraphSnapshot = fixtures.snapshot();
    let prevAdopted = snap.edges.filter(isAdopted).length;
    for (let i = 0; i < 6; i += 1) {
      const next = await runRound(snap, { seed: i });
      const nowAdopted = next.snapshot.edges.filter(isAdopted).length;
      expect(nowAdopted).toBeGreaterThanOrEqual(prevAdopted);
      prevAdopted = nowAdopted;
      snap = next.snapshot;
    }
  });

  it("[property] hopsFromExpert is non-negative when set", async () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const { snapshot } = await runRound(fixtures.snapshotWithPriorAdoption(), { seed });
      for (const a of snapshot.edges.filter(isAdopted)) {
        if (a.hopsFromExpert !== null) expect(a.hopsFromExpert).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("blockedAttempts equals the number of 'blocked' events", async () => {
    const { result } = await runRound(fixtures.snapshot(), { seed: 11 });
    const blocked = result.events.filter((e) => e.kind === "blocked").length;
    expect(result.blockedAttempts).toBe(blocked);
  });

  it("each candidate adoption emits exactly one 'adopted' event", async () => {
    const { snapshot, result } = await runRound(fixtures.snapshot(), { seed: 13 });
    const adoptedCount = result.events.filter((e) => e.kind === "adopted").length;
    const newAdoptionsOnGraph = snapshot.edges
      .filter(isAdopted)
      .filter((a) => a.round === snapshot.round).length;
    expect(adoptedCount).toBe(newAdoptionsOnGraph);
  });
});
