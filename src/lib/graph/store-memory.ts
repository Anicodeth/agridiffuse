import type { GraphEdge, GraphNode, GraphSnapshot, NodeId } from "./types";
import { buildSeedSnapshot } from "./seed";
import { registerAgent } from "@/lib/integrations/masumi";

/**
 * In-memory graph store.
 *
 * Process-local state pinned to globalThis so Next.js hot-reload doesn't
 * blow it away between requests. Every operation is synchronous over a
 * single JS object — perfect for a hackathon demo, hostile to scale.
 *
 * The Neo4j-backed store ([store-neo4j.ts](store-neo4j.ts)) implements the
 * same surface but persists to a real graph database; [store.ts](store.ts)
 * routes between them based on NEO4J_URI.
 */

interface StoreState {
  snapshot: GraphSnapshot;
  initialized: boolean;
}

const KEY = Symbol.for("agridiffuse.graphStore.v2");

type GlobalWithStore = typeof globalThis & { [KEY]?: StoreState };
const g = globalThis as GlobalWithStore;

function ensureState(): StoreState {
  if (!g[KEY]) {
    g[KEY] = { snapshot: buildSeedSnapshot(), initialized: false };
  }
  return g[KEY]!;
}

export async function getSnapshot(): Promise<GraphSnapshot> {
  const state = ensureState();
  if (!state.initialized) {
    // First-touch: assign Masumi agent IDs to experts.
    for (const node of state.snapshot.nodes) {
      if (node.type === "expert" && !node.agentId) {
        const agent = await registerAgent(node.name);
        node.agentId = agent.agentId;
      }
    }
    state.initialized = true;
  }
  return state.snapshot;
}

export function replaceSnapshot(next: GraphSnapshot): void {
  const state = ensureState();
  state.snapshot = next;
}

export async function resetSnapshot(): Promise<GraphSnapshot> {
  g[KEY] = { snapshot: buildSeedSnapshot(), initialized: false };
  return getSnapshot();
}

export function patchEdge(
  edgeId: string,
  patch: Partial<{ trustWeight: number; confidence: number }>,
): GraphSnapshot {
  const state = ensureState();
  const edges = state.snapshot.edges.map((e) => {
    if (e.id !== edgeId) return e;
    if (e.type === "KNOWS" && patch.trustWeight !== undefined) {
      return { ...e, trustWeight: clamp(patch.trustWeight, 0, 1) };
    }
    if (e.type === "RECOMMENDS" && patch.confidence !== undefined) {
      return { ...e, confidence: clamp(patch.confidence, 0, 1) };
    }
    return e;
  });
  state.snapshot = { ...state.snapshot, edges };
  return state.snapshot;
}

export async function addNode(node: GraphNode): Promise<GraphSnapshot> {
  const state = ensureState();
  // For experts, auto-register a Masumi agent so the node is paymentable.
  let resolved: GraphNode = node;
  if (node.type === "expert" && !node.agentId) {
    const agent = await registerAgent(node.name);
    resolved = { ...node, agentId: agent.agentId };
  }
  state.snapshot = { ...state.snapshot, nodes: [...state.snapshot.nodes, resolved] };
  return state.snapshot;
}

export function addEdge(edge: GraphEdge): GraphSnapshot {
  const state = ensureState();
  state.snapshot = { ...state.snapshot, edges: [...state.snapshot.edges, edge] };
  return state.snapshot;
}

export function patchFarmer(farmerId: NodeId, patch: { adoptionRate?: number }): GraphSnapshot {
  const state = ensureState();
  const nodes = state.snapshot.nodes.map((n) => {
    if (n.id !== farmerId || n.type !== "farmer") return n;
    return {
      ...n,
      adoptionRate:
        patch.adoptionRate !== undefined ? clamp(patch.adoptionRate, 0, 1) : n.adoptionRate,
    };
  });
  state.snapshot = { ...state.snapshot, nodes };
  return state.snapshot;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
