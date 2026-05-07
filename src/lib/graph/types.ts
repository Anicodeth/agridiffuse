/**
 * Domain model for AgriDiffuse v2.
 *
 * The graph has three node types and four edge types. v2 adds two fields:
 *   - Expert.agentId        (Masumi wallet/identity)
 *   - AdoptedEdge.rewardTx  (Masumi transaction hash, null for peer-only adoptions)
 */

export type NodeId = string;

// ── Node types ──────────────────────────────────────────────────

export type PracticeCategory = "soil" | "water" | "pest" | "yield";
export type EvidenceLevel = "low" | "medium" | "high";
export type Mood = "happy" | "wink" | "surprised";

export interface ExpertNode {
  id: NodeId;
  type: "expert";
  name: string;
  domain: string;
  institution: string;
  credibilityScore: number; // 0..1
  agentId: string | null; // Masumi agent_id, set at seed
  mood?: Mood;
}

export interface FarmerNode {
  id: NodeId;
  type: "farmer";
  name: string;
  region: string;
  farmSize: number; // hectares
  adoptionRate: number; // 0..1 baseline adoption likelihood
  adoptedPractices: NodeId[];
  mood?: Mood;
}

export interface PracticeNode {
  id: NodeId;
  type: "practice";
  name: string;
  category: PracticeCategory;
  complexity: number; // 1..5
  evidenceLevel: EvidenceLevel;
}

export type GraphNode = ExpertNode | FarmerNode | PracticeNode;

// ── Edge types ──────────────────────────────────────────────────

export interface RecommendsEdge {
  id: string;
  type: "RECOMMENDS";
  source: NodeId; // expert
  target: NodeId; // practice
  confidence: number;
  date: string;
}

export interface AdvisesEdge {
  id: string;
  type: "ADVISES";
  source: NodeId; // expert
  target: NodeId; // farmer
  channel: "field-day" | "radio" | "sms" | "training";
  date: string;
}

export interface KnowsEdge {
  id: string;
  type: "KNOWS";
  source: NodeId; // farmer
  target: NodeId; // farmer
  trustWeight: number; // 0..1
}

export interface AdoptedEdge {
  id: string;
  type: "ADOPTED";
  source: NodeId; // farmer
  target: NodeId; // practice
  date: string;
  outcome: "pending" | "improved" | "neutral" | "regressed";
  // v2 fields
  rewardTx: string | null;
  rewardAmount: number | null;
  rewardExpertId: NodeId | null;
  hopsFromExpert: number | null;
  round: number;
}

export type GraphEdge = RecommendsEdge | AdvisesEdge | KnowsEdge | AdoptedEdge;

// ── Graph aggregate ─────────────────────────────────────────────

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  round: number;
}

// ── Round events ────────────────────────────────────────────────

export type RoundEvent =
  | {
      kind: "adopted";
      farmerId: NodeId;
      practiceId: NodeId;
      via: "advises" | "relay";
      sourceId: NodeId; // expert (if advises) or farmer (if relay)
      hopsFromExpert: number | null;
      expertAncestorId: NodeId | null;
    }
  | {
      kind: "blocked";
      fromId: NodeId;
      toId: NodeId;
      practiceId: NodeId;
      reason: "low-trust" | "low-adoption" | "already-adopted";
    }
  | {
      kind: "rewarded";
      adoptionEdgeId: string;
      expertId: NodeId;
      farmerId: NodeId;
      amount: number;
      txHash: string;
      hops: number;
    };

export interface RoundResult {
  round: number;
  events: RoundEvent[];
  newAdoptions: number;
  blockedAttempts: number;
  totalRewardDistributed: number;
  topExpertId: NodeId | null;
  deepestChainLength: number;
  narrative: string;
}
