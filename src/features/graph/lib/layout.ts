import type { Edge, Node } from "@xyflow/react";
import type { GraphEdge, GraphSnapshot, NodeId } from "@/lib/graph/types";

/**
 * Snapshot → React Flow nodes/edges.
 *
 * Layout strategy: a deterministic ring layout per node type — practices in the
 * center, experts on a tight inner ring, farmers on an outer ring with a small
 * "resistant cluster" pulled to the edge. Cheap, readable, on-brand.
 */

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  domainKind: "expert" | "farmer" | "practice";
  hasAdopted?: boolean;
  agentIdShort?: string | null;
  isResistant?: boolean;
  category?: string;
  mood?: "happy" | "wink" | "surprised";
}

export interface SnapshotToFlow {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}

const CENTER = { x: 600, y: 380 };

export type PositionMap = Record<NodeId, { x: number; y: number }>;

/**
 * Deterministic ring layout used the first time a snapshot is loaded (or after
 * a reset). After that, positions live in the store so user drags persist across
 * rounds.
 */
export function computeInitialLayout(snapshot: GraphSnapshot): PositionMap {
  const practices = snapshot.nodes.filter((n) => n.type === "practice");
  const experts = snapshot.nodes.filter((n) => n.type === "expert");
  const farmers = snapshot.nodes.filter((n) => n.type === "farmer");

  const map: PositionMap = {};
  practices.forEach((p, i) => {
    map[p.id] = ringPosition(CENTER, 110, i, practices.length, -Math.PI / 2);
  });
  experts.forEach((e, i) => {
    map[e.id] = ringPosition(CENTER, 280, i, experts.length, Math.PI / 6);
  });
  farmers.forEach((f, i) => {
    const isResistant = f.type === "farmer" && f.adoptionRate <= 0.25;
    const radius = isResistant ? 520 : 440;
    map[f.id] = ringPosition(CENTER, radius, i, farmers.length);
  });
  return map;
}

export function snapshotToFlow(
  snapshot: GraphSnapshot,
  positions: PositionMap = {},
): SnapshotToFlow {
  const adoptedFarmers = new Set<NodeId>();
  for (const e of snapshot.edges) {
    if (e.type === "ADOPTED") adoptedFarmers.add(e.source);
  }

  const fallback = computeInitialLayout(snapshot);
  const positionFor = (id: NodeId) => positions[id] ?? fallback[id] ?? CENTER;

  const nodes: Node<FlowNodeData>[] = [];

  for (const p of snapshot.nodes.filter((n) => n.type === "practice")) {
    nodes.push({
      id: p.id,
      type: "agriPractice",
      position: positionFor(p.id),
      data: {
        label: p.name,
        domainKind: "practice",
        category: p.type === "practice" ? p.category : undefined,
      },
    });
  }

  for (const e of snapshot.nodes.filter((n) => n.type === "expert")) {
    nodes.push({
      id: e.id,
      type: "agriExpert",
      position: positionFor(e.id),
      data: {
        label: e.name,
        domainKind: "expert",
        agentIdShort:
          e.type === "expert" && e.agentId ? `${e.agentId.slice(0, 6)}…${e.agentId.slice(-4)}` : null,
        mood: e.type === "expert" ? e.mood : undefined,
      },
    });
  }

  for (const f of snapshot.nodes.filter((n) => n.type === "farmer")) {
    const isResistant = f.type === "farmer" && f.adoptionRate <= 0.25;
    nodes.push({
      id: f.id,
      type: "agriFarmer",
      position: positionFor(f.id),
      data: {
        label: f.name,
        domainKind: "farmer",
        hasAdopted: adoptedFarmers.has(f.id),
        isResistant,
        mood: f.type === "farmer" ? f.mood : undefined,
      },
    });
  }

  const edges: Edge[] = snapshot.edges.map((e) => snapshotEdge(e));

  return { nodes, edges };
}

function snapshotEdge(e: GraphEdge): Edge {
  switch (e.type) {
    case "RECOMMENDS":
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#9f4fff", strokeWidth: 1 + e.confidence * 1.5, opacity: 0.6 },
        data: { kind: "RECOMMENDS" },
      };
    case "ADVISES":
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        style: { stroke: "#0090ff", strokeWidth: 1.4, strokeDasharray: "4 4", opacity: 0.65 },
        data: { kind: "ADVISES" },
      };
    case "KNOWS":
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "straight",
        style: {
          stroke: "#848281",
          strokeWidth: 0.6 + e.trustWeight * 2.4,
          opacity: 0.4 + e.trustWeight * 0.4,
        },
        data: { kind: "KNOWS", trustWeight: e.trustWeight },
      };
    case "ADOPTED":
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        animated: true,
        style: {
          stroke: e.rewardTx ? "#ff3e00" : "#00ca48",
          strokeWidth: 1.6,
          opacity: 0.85,
        },
        data: {
          kind: "ADOPTED",
          hasReward: !!e.rewardTx,
          rewardAmount: e.rewardAmount,
          round: e.round,
        },
      };
  }
}

function ringPosition(
  center: { x: number; y: number },
  radius: number,
  index: number,
  total: number,
  offset = 0,
): { x: number; y: number } {
  const angle = offset + (index / total) * Math.PI * 2;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}
