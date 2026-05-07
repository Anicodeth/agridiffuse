import { describe, expect, it } from "vitest";
import { snapshotToFlow } from "./layout";
import * as fx from "../../../../tests/fixtures/graph";
import type { GraphSnapshot } from "@/lib/graph/types";

describe("snapshotToFlow — node mapping", () => {
  it("returns one React Flow node per snapshot node", () => {
    const snap = fx.snapshot();
    const flow = snapshotToFlow(snap);
    expect(flow.nodes).toHaveLength(snap.nodes.length);
  });

  it("assigns the agriExpert type to expert nodes", () => {
    const flow = snapshotToFlow(fx.snapshot());
    const expertNode = flow.nodes.find((n) => n.id === "e_a");
    expect(expertNode?.type).toBe("agriExpert");
    expect(expertNode?.data.domainKind).toBe("expert");
  });

  it("assigns the agriFarmer type to farmer nodes and surfaces resistant flag", () => {
    const flow = snapshotToFlow(fx.snapshot());
    const resistant = flow.nodes.find((n) => n.id === "f_low");
    expect(resistant?.type).toBe("agriFarmer");
    expect(resistant?.data.isResistant).toBe(true);
  });

  it("assigns the agriPractice type and forwards the category", () => {
    const flow = snapshotToFlow(fx.snapshot());
    const practice = flow.nodes.find((n) => n.id === "p_one");
    expect(practice?.type).toBe("agriPractice");
    expect(practice?.data.category).toBe("soil");
  });

  it("flags farmers as adopted when at least one ADOPTED edge originates from them", () => {
    const snap = fx.snapshotWithPriorAdoption();
    const flow = snapshotToFlow(snap);
    const seed = flow.nodes.find((n) => n.id === "f_seed");
    expect(seed?.data.hasAdopted).toBe(true);
    const high = flow.nodes.find((n) => n.id === "f_high");
    expect(high?.data.hasAdopted).toBe(false);
  });

  it("includes a shortened agentId on expert nodes", () => {
    const snap: GraphSnapshot = {
      ...fx.snapshot(),
      nodes: fx.snapshot().nodes.map((n) =>
        n.type === "expert" ? { ...n, agentId: "agent_0001_long_string" } : n,
      ),
    };
    const flow = snapshotToFlow(snap);
    const e = flow.nodes.find((n) => n.data.domainKind === "expert");
    expect(e?.data.agentIdShort).toMatch(/…/);
  });
});

describe("snapshotToFlow — edge mapping", () => {
  it("returns one React Flow edge per snapshot edge", () => {
    const snap = fx.snapshot();
    const flow = snapshotToFlow(snap);
    expect(flow.edges).toHaveLength(snap.edges.length);
  });

  it("RECOMMENDS edges use the violet brand color", () => {
    const flow = snapshotToFlow(fx.snapshot());
    const recommends = flow.edges.find((e) => e.id === "r_a_one");
    expect(recommends?.style?.stroke).toBe("#9f4fff");
  });

  it("ADVISES edges are dashed", () => {
    const flow = snapshotToFlow(fx.snapshot());
    const advises = flow.edges.find((e) => e.id === "ad_a_seed");
    expect(advises?.style?.strokeDasharray).toBe("4 4");
  });

  it("KNOWS edge stroke width scales with trustWeight", () => {
    const flow = snapshotToFlow(fx.snapshot());
    const high = flow.edges.find((e) => e.id === "k_seed_high");
    const low = flow.edges.find((e) => e.id === "k_seed_low");
    expect(Number(high?.style?.strokeWidth)).toBeGreaterThan(Number(low?.style?.strokeWidth));
  });

  it("ADOPTED edges with a reward are colored ember; peer-only adoptions are meadow", () => {
    const snap = fx.snapshotWithPriorAdoption();
    snap.edges.push(
      fx.adopted({
        id: "ad_peer",
        source: "f_high",
        target: "p_one",
        rewardTx: null,
        rewardAmount: null,
        rewardExpertId: null,
      }),
    );
    const flow = snapshotToFlow(snap);
    const rewarded = flow.edges.find((e) => e.id === "ad_seed_one");
    const peer = flow.edges.find((e) => e.id === "ad_peer");
    expect(rewarded?.style?.stroke).toBe("#ff3e00");
    expect(peer?.style?.stroke).toBe("#00ca48");
  });
});
