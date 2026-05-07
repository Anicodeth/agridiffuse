/**
 * Fixture builders for graph-shaped tests.
 *
 * Goal: tests should read like a story, not like a database setup. Each builder
 * takes a partial override and fills the rest with sensible defaults.
 */

import type {
  AdoptedEdge,
  AdvisesEdge,
  ExpertNode,
  FarmerNode,
  GraphSnapshot,
  KnowsEdge,
  PracticeNode,
  RecommendsEdge,
} from "@/lib/graph/types";

const ISO = "2026-01-01T00:00:00.000Z";

export function expert(overrides: Partial<ExpertNode> = {}): ExpertNode {
  return {
    id: overrides.id ?? "e_test",
    type: "expert",
    name: "Test Expert",
    domain: "Soil",
    institution: "Test Institute",
    credibilityScore: 0.9,
    agentId: "agent_test_0001",
    mood: "happy",
    ...overrides,
  };
}

export function farmer(overrides: Partial<FarmerNode> = {}): FarmerNode {
  return {
    id: overrides.id ?? "f_test",
    type: "farmer",
    name: "Test Farmer",
    region: "Test Region",
    farmSize: 2,
    adoptionRate: 0.6,
    adoptedPractices: [],
    mood: "happy",
    ...overrides,
  };
}

export function practice(overrides: Partial<PracticeNode> = {}): PracticeNode {
  return {
    id: overrides.id ?? "p_test",
    type: "practice",
    name: "Test Practice",
    category: "soil",
    complexity: 2,
    evidenceLevel: "medium",
    ...overrides,
  };
}

export function recommends(overrides: Partial<RecommendsEdge> = {}): RecommendsEdge {
  return {
    id: overrides.id ?? "r_test",
    type: "RECOMMENDS",
    source: "e_test",
    target: "p_test",
    confidence: 0.9,
    date: ISO,
    ...overrides,
  };
}

export function advises(overrides: Partial<AdvisesEdge> = {}): AdvisesEdge {
  return {
    id: overrides.id ?? "a_test",
    type: "ADVISES",
    source: "e_test",
    target: "f_test",
    channel: "field-day",
    date: ISO,
    ...overrides,
  };
}

export function knows(overrides: Partial<KnowsEdge> = {}): KnowsEdge {
  return {
    id: overrides.id ?? "k_test",
    type: "KNOWS",
    source: "f_test",
    target: "f_other",
    trustWeight: 0.7,
    ...overrides,
  };
}

export function adopted(overrides: Partial<AdoptedEdge> = {}): AdoptedEdge {
  return {
    id: overrides.id ?? "ad_test",
    type: "ADOPTED",
    source: "f_test",
    target: "p_test",
    date: ISO,
    outcome: "pending",
    rewardTx: null,
    rewardAmount: null,
    rewardExpertId: null,
    hopsFromExpert: null,
    round: 1,
    ...overrides,
  };
}

/**
 * A minimal but realistic snapshot:
 *  - 1 expert recommending 1 practice
 *  - 1 expert advising 1 farmer
 *  - that farmer is connected to a high-trust peer and a low-trust peer
 */
export function snapshot(overrides: Partial<GraphSnapshot> = {}): GraphSnapshot {
  return {
    round: 0,
    nodes: [
      expert({ id: "e_a", agentId: "agent_a" }),
      expert({ id: "e_b", agentId: "agent_b", credibilityScore: 0.5 }),
      farmer({ id: "f_seed", adoptionRate: 0.9 }),
      farmer({ id: "f_high", adoptionRate: 0.8 }),
      farmer({ id: "f_low", adoptionRate: 0.2 }),
      practice({ id: "p_one" }),
    ],
    edges: [
      recommends({ id: "r_a_one", source: "e_a", target: "p_one" }),
      advises({ id: "ad_a_seed", source: "e_a", target: "f_seed" }),
      knows({ id: "k_seed_high", source: "f_seed", target: "f_high", trustWeight: 0.9 }),
      knows({ id: "k_seed_low", source: "f_seed", target: "f_low", trustWeight: 0.1 }),
    ],
    ...overrides,
  };
}

/** Tiny snapshot with a pre-existing adoption — useful for relay tests. */
export function snapshotWithPriorAdoption(): GraphSnapshot {
  const base = snapshot();
  base.edges.push(
    adopted({
      id: "ad_seed_one",
      source: "f_seed",
      target: "p_one",
      rewardTx: "0xseed",
      rewardAmount: 1,
      rewardExpertId: "e_a",
      hopsFromExpert: 0,
      round: 1,
    }),
  );
  base.round = 1;
  return base;
}
