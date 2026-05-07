import { describe, expect, it } from "vitest";
import {
  practiceAdoption,
  expertReach,
  expertEarnings,
  deepestChain,
} from "./metrics";
import * as fx from "../../../tests/fixtures/graph";
import type { GraphSnapshot } from "./types";

describe("practiceAdoption", () => {
  it("returns 0 adopters for a snapshot with no ADOPTED edges", () => {
    const result = practiceAdoption(fx.snapshot());
    expect(result).toHaveLength(1);
    expect(result[0]?.adopters).toBe(0);
  });

  it("counts unique farmers per practice", () => {
    const snap = fx.snapshot({
      nodes: [
        fx.expert({ id: "e1" }),
        fx.farmer({ id: "f1" }),
        fx.farmer({ id: "f2" }),
        fx.farmer({ id: "f3" }),
        fx.practice({ id: "p_drip", name: "Drip" }),
        fx.practice({ id: "p_compost", name: "Compost" }),
      ],
      edges: [
        fx.adopted({ id: "ad1", source: "f1", target: "p_drip" }),
        fx.adopted({ id: "ad2", source: "f2", target: "p_drip" }),
        fx.adopted({ id: "ad3", source: "f3", target: "p_compost" }),
      ],
    });
    const result = practiceAdoption(snap);
    const drip = result.find((r) => r.practiceId === "p_drip");
    const compost = result.find((r) => r.practiceId === "p_compost");
    expect(drip?.adopters).toBe(2);
    expect(compost?.adopters).toBe(1);
  });

  it("sorts results by adopter count descending", () => {
    const snap = fx.snapshot({
      nodes: [
        fx.farmer({ id: "f1" }),
        fx.farmer({ id: "f2" }),
        fx.practice({ id: "popular" }),
        fx.practice({ id: "niche" }),
      ],
      edges: [
        fx.adopted({ id: "ad1", source: "f1", target: "popular" }),
        fx.adopted({ id: "ad2", source: "f2", target: "popular" }),
        fx.adopted({ id: "ad3", source: "f1", target: "niche" }),
      ],
    });
    const result = practiceAdoption(snap);
    expect(result[0]?.practiceId).toBe("popular");
    expect(result[1]?.practiceId).toBe("niche");
  });
});

describe("expertReach", () => {
  it("counts direct advisees as reach 1", () => {
    const snap = fx.snapshot({
      nodes: [fx.expert({ id: "e1" }), fx.farmer({ id: "f1" })],
      edges: [fx.advises({ id: "a1", source: "e1", target: "f1" })],
    });
    const result = expertReach(snap);
    expect(result.find((r) => r.expertId === "e1")?.reach).toBe(1);
  });

  it("expands reach by 1 hop along KNOWS edges", () => {
    const snap = fx.snapshot({
      nodes: [
        fx.expert({ id: "e1" }),
        fx.farmer({ id: "f1" }),
        fx.farmer({ id: "f2" }),
        fx.farmer({ id: "f3" }),
      ],
      edges: [
        fx.advises({ id: "a1", source: "e1", target: "f1" }),
        fx.knows({ id: "k1", source: "f1", target: "f2" }),
        fx.knows({ id: "k2", source: "f2", target: "f3" }), // 2 hops out — should NOT count
      ],
    });
    const result = expertReach(snap);
    expect(result.find((r) => r.expertId === "e1")?.reach).toBe(2);
  });

  it("counts 0 for an expert with no advisees", () => {
    const snap = fx.snapshot({
      nodes: [fx.expert({ id: "isolated" })],
      edges: [],
    });
    const result = expertReach(snap);
    expect(result.find((r) => r.expertId === "isolated")?.reach).toBe(0);
  });
});

describe("expertEarnings", () => {
  it("returns zero earnings when no rewards have been distributed", () => {
    const result = expertEarnings(fx.snapshot());
    for (const e of result) expect(e.earnings).toBe(0);
  });

  it("sums rewardAmount per expert across all rewarded adoptions", () => {
    const snap: GraphSnapshot = {
      ...fx.snapshot(),
      edges: [
        fx.adopted({
          id: "ad1",
          source: "f_seed",
          target: "p_one",
          rewardTx: "0x1",
          rewardAmount: 1,
          rewardExpertId: "e_a",
        }),
        fx.adopted({
          id: "ad2",
          source: "f_high",
          target: "p_one",
          rewardTx: "0x2",
          rewardAmount: 0.5,
          rewardExpertId: "e_a",
        }),
        fx.adopted({
          id: "ad3",
          source: "f_low",
          target: "p_one",
          rewardTx: "0x3",
          rewardAmount: 0.25,
          rewardExpertId: "e_b",
        }),
      ],
    };
    const result = expertEarnings(snap);
    expect(result.find((r) => r.expertId === "e_a")?.earnings).toBeCloseTo(1.5);
    expect(result.find((r) => r.expertId === "e_b")?.earnings).toBeCloseTo(0.25);
  });

  it("sorts results by earnings descending", () => {
    const snap: GraphSnapshot = {
      ...fx.snapshot(),
      edges: [
        fx.adopted({
          id: "ad1",
          source: "f_seed",
          target: "p_one",
          rewardTx: "0x1",
          rewardAmount: 0.1,
          rewardExpertId: "e_b",
        }),
        fx.adopted({
          id: "ad2",
          source: "f_high",
          target: "p_one",
          rewardTx: "0x2",
          rewardAmount: 5,
          rewardExpertId: "e_a",
        }),
      ],
    };
    const result = expertEarnings(snap);
    expect(result[0]?.expertId).toBe("e_a");
    expect(result[1]?.expertId).toBe("e_b");
  });

  it("exposes the most recent tx hash on each expert", () => {
    const snap: GraphSnapshot = {
      ...fx.snapshot(),
      edges: [
        fx.adopted({
          id: "ad1",
          source: "f_seed",
          target: "p_one",
          rewardTx: "0x_first",
          rewardAmount: 1,
          rewardExpertId: "e_a",
        }),
        fx.adopted({
          id: "ad2",
          source: "f_high",
          target: "p_one",
          rewardTx: "0x_second",
          rewardAmount: 1,
          rewardExpertId: "e_a",
        }),
      ],
    };
    const result = expertEarnings(snap);
    expect(result.find((r) => r.expertId === "e_a")?.lastTxHash).toBe("0x_second");
  });

  it("ignores adoptions without a rewardExpertId or rewardAmount", () => {
    const snap: GraphSnapshot = {
      ...fx.snapshot(),
      edges: [
        fx.adopted({
          id: "ad_unrewarded",
          source: "f_seed",
          target: "p_one",
          rewardTx: null,
          rewardAmount: null,
          rewardExpertId: null,
        }),
      ],
    };
    const result = expertEarnings(snap);
    for (const e of result) expect(e.earnings).toBe(0);
  });
});

describe("deepestChain", () => {
  it("returns length 0 when no adoptions exist", () => {
    const result = deepestChain(fx.snapshot());
    expect(result.length).toBe(0);
    expect(result.expertId).toBeNull();
  });

  it("returns length 1 for a direct (0-hop) adoption", () => {
    const snap: GraphSnapshot = {
      ...fx.snapshot(),
      edges: [
        ...fx.snapshot().edges,
        fx.adopted({
          id: "ad1",
          source: "f_seed",
          target: "p_one",
          hopsFromExpert: 0,
          rewardExpertId: "e_a",
          rewardTx: "0x1",
          rewardAmount: 1,
        }),
      ],
    };
    const result = deepestChain(snap);
    expect(result.length).toBe(1);
    expect(result.expertId).toBe("e_a");
  });

  it("returns the maximum chain across all rewarded adoptions", () => {
    const snap: GraphSnapshot = {
      ...fx.snapshot(),
      edges: [
        ...fx.snapshot().edges,
        fx.adopted({
          id: "ad1",
          source: "f_seed",
          target: "p_one",
          hopsFromExpert: 0,
          rewardExpertId: "e_a",
          rewardTx: "0x1",
          rewardAmount: 1,
        }),
        fx.adopted({
          id: "ad2",
          source: "f_high",
          target: "p_one",
          hopsFromExpert: 3,
          rewardExpertId: "e_a",
          rewardTx: "0x2",
          rewardAmount: 0.125,
        }),
      ],
    };
    const result = deepestChain(snap);
    expect(result.length).toBe(4);
  });
});
