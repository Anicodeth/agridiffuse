import type {
  AdoptedEdge,
  AdvisesEdge,
  ExpertNode,
  FarmerNode,
  GraphEdge,
  GraphSnapshot,
  KnowsEdge,
  NodeId,
  RecommendsEdge,
  RoundEvent,
  RoundResult,
} from "@/lib/graph/types";
import { createRng, type Rng } from "./rng";

/**
 * Spread engine.
 *
 * Two passes per round:
 *   1. Direct seeding via ADVISES edges (expert → farmer recommendations).
 *   2. Trust-weighted relay along KNOWS edges from any farmer who already adopted.
 *
 * After persistence, each new adoption traces back to its closest expert
 * ancestor along the (RECOMMENDS · ADOPTED · KNOWS*) chain to determine
 * reward eligibility and hop distance.
 */

interface RunRoundOptions {
  baseReward?: number; // Masumi micro-payment for a direct (0-hop) adoption
  seed?: number;
  payReward?: (
    expertId: NodeId,
    amount: number,
    context: { practiceId: NodeId; farmerId: NodeId; hops: number },
  ) => Promise<{ txHash: string }> | { txHash: string };
}

interface AdoptionCandidate {
  farmerId: NodeId;
  practiceId: NodeId;
  via: "advises" | "relay";
  sourceId: NodeId;
}

const isExpert = (n: { type: string }): n is ExpertNode => n.type === "expert";
const isFarmer = (n: { type: string }): n is FarmerNode => n.type === "farmer";

const isRecommends = (e: GraphEdge): e is RecommendsEdge => e.type === "RECOMMENDS";
const isAdvises = (e: GraphEdge): e is AdvisesEdge => e.type === "ADVISES";
const isKnows = (e: GraphEdge): e is KnowsEdge => e.type === "KNOWS";
const isAdopted = (e: GraphEdge): e is AdoptedEdge => e.type === "ADOPTED";

export async function runRound(
  snapshot: GraphSnapshot,
  options: RunRoundOptions = {},
): Promise<{ snapshot: GraphSnapshot; result: RoundResult }> {
  const { baseReward = 1, seed, payReward } = options;
  const nextRound = snapshot.round + 1;
  const rng: Rng = createRng(seed ?? Date.now() ^ nextRound);

  const nodes = snapshot.nodes.map((n) => ({ ...n }));
  const edges: GraphEdge[] = snapshot.edges.map((e) => ({ ...e }));

  const farmers = nodes.filter(isFarmer);
  const experts = nodes.filter(isExpert);
  const farmerById = new Map(farmers.map((f) => [f.id, f] as const));
  const expertById = new Map(experts.map((e) => [e.id, e] as const));

  const recommends = edges.filter(isRecommends);
  const advises = edges.filter(isAdvises);
  const knows = edges.filter(isKnows);
  const adopted = edges.filter(isAdopted);

  const adoptedKey = (farmerId: NodeId, practiceId: NodeId) => `${farmerId}|${practiceId}`;
  const alreadyAdopted = new Set(adopted.map((a) => adoptedKey(a.source, a.target)));

  const candidates: AdoptionCandidate[] = [];
  const events: RoundEvent[] = [];

  // ── Pass 1 — Direct ADVISES seeding ──────────────────────────────
  for (const advice of advises) {
    const expert = expertById.get(advice.source);
    const farmer = farmerById.get(advice.target);
    if (!expert || !farmer) continue;

    const recommendedPractices = recommends
      .filter((r) => r.source === expert.id)
      .map((r) => r.target);

    for (const practiceId of recommendedPractices) {
      if (alreadyAdopted.has(adoptedKey(farmer.id, practiceId))) {
        events.push({
          kind: "blocked",
          fromId: expert.id,
          toId: farmer.id,
          practiceId,
          reason: "already-adopted",
        });
        continue;
      }
      const probability = expert.credibilityScore * farmer.adoptionRate * 0.45;
      if (rng() < probability) {
        candidates.push({
          farmerId: farmer.id,
          practiceId,
          via: "advises",
          sourceId: expert.id,
        });
        alreadyAdopted.add(adoptedKey(farmer.id, practiceId));
      } else {
        events.push({
          kind: "blocked",
          fromId: expert.id,
          toId: farmer.id,
          practiceId,
          reason: farmer.adoptionRate < 0.3 ? "low-adoption" : "low-trust",
        });
      }
    }
  }

  // ── Pass 2 — Trust-weighted relay along KNOWS edges ─────────────
  // A farmer who has adopted any practice can relay it to their KNOWS neighbors.
  for (const adoption of adopted) {
    const adopter = farmerById.get(adoption.source);
    if (!adopter) continue;
    const peers = knows.filter((k) => k.source === adopter.id || k.target === adopter.id);

    for (const tie of peers) {
      const neighborId = tie.source === adopter.id ? tie.target : tie.source;
      const neighbor = farmerById.get(neighborId);
      if (!neighbor) continue;
      if (alreadyAdopted.has(adoptedKey(neighbor.id, adoption.target))) continue;

      const probability = tie.trustWeight * neighbor.adoptionRate * adopter.adoptionRate;
      if (rng() < probability) {
        candidates.push({
          farmerId: neighbor.id,
          practiceId: adoption.target,
          via: "relay",
          sourceId: adopter.id,
        });
        alreadyAdopted.add(adoptedKey(neighbor.id, adoption.target));
      } else {
        events.push({
          kind: "blocked",
          fromId: adopter.id,
          toId: neighbor.id,
          practiceId: adoption.target,
          reason: tie.trustWeight < 0.4 ? "low-trust" : "low-adoption",
        });
      }
    }
  }

  // ── Persist new adoptions + trace expert ancestor + reward ──────
  let totalRewardDistributed = 0;
  const expertReachThisRound = new Map<NodeId, number>();

  for (const candidate of candidates) {
    const trace = traceExpertAncestor(candidate, edges, recommends);
    const adoptionEdge: AdoptedEdge = {
      id: `ad_${candidate.farmerId}_${candidate.practiceId}_${nextRound}`,
      type: "ADOPTED",
      source: candidate.farmerId,
      target: candidate.practiceId,
      date: new Date().toISOString(),
      outcome: "pending",
      rewardTx: null,
      rewardAmount: null,
      rewardExpertId: null,
      hopsFromExpert: trace?.hops ?? null,
      round: nextRound,
    };

    if (trace && payReward) {
      const amount = baseReward * Math.pow(0.5, trace.hops);
      const { txHash } = await Promise.resolve(
        payReward(trace.expertId, amount, {
          practiceId: candidate.practiceId,
          farmerId: candidate.farmerId,
          hops: trace.hops,
        }),
      );
      adoptionEdge.rewardTx = txHash;
      adoptionEdge.rewardAmount = amount;
      adoptionEdge.rewardExpertId = trace.expertId;
      totalRewardDistributed += amount;
      expertReachThisRound.set(
        trace.expertId,
        (expertReachThisRound.get(trace.expertId) ?? 0) + 1,
      );

      events.push({
        kind: "rewarded",
        adoptionEdgeId: adoptionEdge.id,
        expertId: trace.expertId,
        farmerId: candidate.farmerId,
        amount,
        txHash,
        hops: trace.hops,
      });
    }

    edges.push(adoptionEdge);
    const farmer = farmerById.get(candidate.farmerId);
    if (farmer) {
      farmer.adoptedPractices = [...farmer.adoptedPractices, candidate.practiceId];
    }

    events.push({
      kind: "adopted",
      farmerId: candidate.farmerId,
      practiceId: candidate.practiceId,
      via: candidate.via,
      sourceId: candidate.sourceId,
      hopsFromExpert: trace?.hops ?? null,
      expertAncestorId: trace?.expertId ?? null,
    });
  }

  // ── Round summary ──────────────────────────────────────────────
  const newAdoptions = candidates.length;
  const blockedAttempts = events.filter((e) => e.kind === "blocked").length;
  const topExpertId =
    [...expertReachThisRound.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const deepestChainLength = candidates.reduce((max, c) => {
    const trace = traceExpertAncestor(c, edges, recommends);
    return Math.max(max, trace ? trace.hops + 1 : 0);
  }, 0);

  return {
    snapshot: { nodes, edges, round: nextRound },
    result: {
      round: nextRound,
      events,
      newAdoptions,
      blockedAttempts,
      totalRewardDistributed,
      topExpertId,
      deepestChainLength,
      narrative: "", // populated by the API route from Featherless
    },
  };
}

/**
 * Walk back from a candidate adoption to the closest expert who recommended
 * the practice. Direct (advises-driven) adoptions are 0-hop; relays inherit
 * the source farmer's hop distance + 1.
 *
 * BFS over the existing adoption + KNOWS graph, stopping at any farmer
 * whose practice was directly recommended by an expert.
 */
function traceExpertAncestor(
  candidate: AdoptionCandidate,
  edges: GraphEdge[],
  recommends: RecommendsEdge[],
): { expertId: NodeId; hops: number } | null {
  if (candidate.via === "advises") {
    // Direct seeding — the candidate.sourceId is the expert.
    return { expertId: candidate.sourceId, hops: 0 };
  }

  // Relay — BFS backward through KNOWS to find a farmer who adopted the
  // same practice via an expert advice.
  const adopted = edges.filter(isAdopted).filter((a) => a.target === candidate.practiceId);
  const knows = edges.filter(isKnows);
  const adopterToHops = new Map<NodeId, number>();
  for (const a of adopted) {
    if (a.hopsFromExpert !== null && a.rewardExpertId) {
      adopterToHops.set(a.source, a.hopsFromExpert);
    }
  }

  const queue: Array<{ id: NodeId; depth: number }> = [{ id: candidate.sourceId, depth: 0 }];
  const visited = new Set<NodeId>();
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const knownHops = adopterToHops.get(id);
    if (knownHops !== undefined) {
      // Find the expert who recommended this practice via this farmer's adoption
      const hisAdoption = adopted.find((a) => a.source === id);
      if (hisAdoption?.rewardExpertId) {
        return { expertId: hisAdoption.rewardExpertId, hops: knownHops + depth + 1 };
      }
      // Otherwise look up the recommender chain directly
      const rec = recommends.find((r) => r.target === candidate.practiceId);
      if (rec) {
        return { expertId: rec.source, hops: knownHops + depth + 1 };
      }
    }

    if (depth > 5) continue;
    for (const tie of knows) {
      if (tie.source === id && !visited.has(tie.target)) {
        queue.push({ id: tie.target, depth: depth + 1 });
      } else if (tie.target === id && !visited.has(tie.source)) {
        queue.push({ id: tie.source, depth: depth + 1 });
      }
    }
  }

  // Last-resort fallback — find the recommender directly
  const directRec = recommends.find((r) => r.target === candidate.practiceId);
  if (directRec) {
    return { expertId: directRec.source, hops: 1 };
  }
  return null;
}
