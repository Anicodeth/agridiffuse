import type {
  AdoptedEdge,
  AdvisesEdge,
  GraphEdge,
  GraphSnapshot,
  KnowsEdge,
  NodeId,
  PracticeNode,
  RecommendsEdge,
} from "./types";

const isAdopted = (e: GraphEdge): e is AdoptedEdge => e.type === "ADOPTED";
const isAdvises = (e: GraphEdge): e is AdvisesEdge => e.type === "ADVISES";
const isKnows = (e: GraphEdge): e is KnowsEdge => e.type === "KNOWS";
const isRecommends = (e: GraphEdge): e is RecommendsEdge => e.type === "RECOMMENDS";

export interface PracticeAdoption {
  practiceId: NodeId;
  practiceName: string;
  category: PracticeNode["category"];
  adopters: number;
}

export interface ExpertReach {
  expertId: NodeId;
  name: string;
  reach: number;
}

export interface ExpertEarnings {
  expertId: NodeId;
  name: string;
  earnings: number;
  rewardCount: number;
  lastTxHash: string | null;
}

export interface DeepestChain {
  expertId: NodeId | null;
  expertName: string | null;
  practiceId: NodeId | null;
  practiceName: string | null;
  length: number;
  pathIds: NodeId[];
}

export function practiceAdoption(snapshot: GraphSnapshot): PracticeAdoption[] {
  const adoptions = snapshot.edges.filter(isAdopted);
  const counts = new Map<NodeId, number>();
  for (const a of adoptions) counts.set(a.target, (counts.get(a.target) ?? 0) + 1);

  return snapshot.nodes
    .filter((n): n is PracticeNode => n.type === "practice")
    .map((p) => ({
      practiceId: p.id,
      practiceName: p.name,
      category: p.category,
      adopters: counts.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.adopters - a.adopters);
}

export function expertReach(snapshot: GraphSnapshot): ExpertReach[] {
  const advises = snapshot.edges.filter(isAdvises);
  const knows = snapshot.edges.filter(isKnows);
  const expertNodes = snapshot.nodes.filter((n) => n.type === "expert");

  return expertNodes
    .map((e) => {
      const directAdvisees = new Set(advises.filter((a) => a.source === e.id).map((a) => a.target));
      const reached = new Set<NodeId>([...directAdvisees]);
      // 1-hop expansion through KNOWS
      for (const fid of directAdvisees) {
        for (const k of knows) {
          if (k.source === fid) reached.add(k.target);
          if (k.target === fid) reached.add(k.source);
        }
      }
      return { expertId: e.id, name: e.name, reach: reached.size };
    })
    .sort((a, b) => b.reach - a.reach);
}

export function expertEarnings(snapshot: GraphSnapshot): ExpertEarnings[] {
  const adoptions = snapshot.edges.filter(isAdopted);
  const expertNodes = snapshot.nodes.filter((n) => n.type === "expert");
  const earnings = new Map<NodeId, { total: number; count: number; lastTx: string | null }>();

  for (const a of adoptions) {
    if (!a.rewardExpertId || !a.rewardAmount) continue;
    const existing = earnings.get(a.rewardExpertId) ?? { total: 0, count: 0, lastTx: null };
    earnings.set(a.rewardExpertId, {
      total: existing.total + a.rewardAmount,
      count: existing.count + 1,
      lastTx: a.rewardTx ?? existing.lastTx,
    });
  }

  return expertNodes
    .map((e) => {
      const stats = earnings.get(e.id) ?? { total: 0, count: 0, lastTx: null };
      return {
        expertId: e.id,
        name: e.name,
        earnings: stats.total,
        rewardCount: stats.count,
        lastTxHash: stats.lastTx,
      };
    })
    .sort((a, b) => b.earnings - a.earnings);
}

/**
 * Deepest chain — longest documented Expert → Practice ← Farmer → KNOWS* → Farmer → Practice path.
 * Implemented as: max(hopsFromExpert + 1) across all rewarded adoptions, plus path reconstruction.
 */
export function deepestChain(snapshot: GraphSnapshot): DeepestChain {
  const adoptions = snapshot.edges.filter(isAdopted);
  const recommends = snapshot.edges.filter(isRecommends);

  let best: DeepestChain = {
    expertId: null,
    expertName: null,
    practiceId: null,
    practiceName: null,
    length: 0,
    pathIds: [],
  };

  for (const a of adoptions) {
    const hops = a.hopsFromExpert ?? 0;
    const length = hops + 1;
    if (length > best.length) {
      const expert = snapshot.nodes.find((n) => n.id === a.rewardExpertId);
      const practice = snapshot.nodes.find((n) => n.id === a.target);
      if (!expert || !practice) continue;
      const rec = recommends.find((r) => r.source === expert.id && r.target === practice.id);
      best = {
        expertId: expert.id,
        expertName: "name" in expert ? expert.name : null,
        practiceId: practice.id,
        practiceName: "name" in practice ? practice.name : null,
        length,
        pathIds: [expert.id, ...(rec ? [rec.id] : []), practice.id, a.source],
      };
    }
  }

  return best;
}
