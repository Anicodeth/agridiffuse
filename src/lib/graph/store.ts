import type { GraphEdge, GraphNode, GraphSnapshot, NodeId } from "./types";
import * as memoryStore from "./store-memory";
import * as neo4jStore from "./store-neo4j";

/**
 * Server-side graph store — router.
 *
 * Two implementations live behind this single API:
 *
 *   • [store-memory.ts](store-memory.ts)  — process-local JS object. Default.
 *   • [store-neo4j.ts](store-neo4j.ts)    — Cypher round-trips to a real DB.
 *
 * Setting NEO4J_URI flips every call to the Neo4j path; otherwise we stay in
 * memory. This is the only place the choice is made — every API route, the
 * spread engine, and the React components are agnostic.
 *
 * Implementation note: we resolve the backend per-call rather than at module
 * load, so a test or dev session can stub the env var mid-flight.
 */

const usingNeo4j = (): boolean => Boolean(process.env.NEO4J_URI);

export async function getSnapshot(): Promise<GraphSnapshot> {
  return usingNeo4j() ? neo4jStore.getSnapshot() : memoryStore.getSnapshot();
}

export async function replaceSnapshot(next: GraphSnapshot): Promise<void> {
  if (usingNeo4j()) await neo4jStore.replaceSnapshot(next);
  else memoryStore.replaceSnapshot(next);
}

export async function resetSnapshot(): Promise<GraphSnapshot> {
  return usingNeo4j() ? neo4jStore.resetSnapshot() : memoryStore.resetSnapshot();
}

export async function patchEdge(
  edgeId: string,
  patch: Partial<{ trustWeight: number; confidence: number }>,
): Promise<GraphSnapshot> {
  return usingNeo4j()
    ? neo4jStore.patchEdge(edgeId, patch)
    : Promise.resolve(memoryStore.patchEdge(edgeId, patch));
}

export async function patchFarmer(
  farmerId: NodeId,
  patch: { adoptionRate?: number },
): Promise<GraphSnapshot> {
  return usingNeo4j()
    ? neo4jStore.patchFarmer(farmerId, patch)
    : Promise.resolve(memoryStore.patchFarmer(farmerId, patch));
}

export async function addNode(node: GraphNode): Promise<GraphSnapshot> {
  return usingNeo4j() ? neo4jStore.addNode(node) : memoryStore.addNode(node);
}

export async function addEdge(edge: GraphEdge): Promise<GraphSnapshot> {
  return usingNeo4j()
    ? neo4jStore.addEdge(edge)
    : Promise.resolve(memoryStore.addEdge(edge));
}
