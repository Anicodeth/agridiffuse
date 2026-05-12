import { NextResponse } from "next/server";
import { getSnapshot, replaceSnapshot } from "@/lib/graph/store";
import { runRound } from "@/lib/sim/engine";
import { pay } from "@/lib/integrations/masumi";
import { narrateRound } from "@/lib/integrations/featherless";
import type { GraphNode } from "@/lib/graph/types";

export const dynamic = "force-dynamic";

export async function POST() {
  const snapshot = await getSnapshot();

  const { snapshot: nextSnapshot, result } = await runRound(snapshot, {
    baseReward: 1,
    payReward: async (expertId, amount, ctx) => {
      const expert = snapshot.nodes.find((n) => n.id === expertId);
      if (!expert || expert.type !== "expert" || !expert.agentId) {
        return { txHash: `mock_no_agent_${ctx.farmerId}` };
      }
      const payment = await pay(expert.agentId, amount, {
        practiceId: String(ctx.practiceId),
        farmerId: String(ctx.farmerId),
        hops: ctx.hops,
      });
      return { txHash: payment.txHash };
    },
  });

  // Narrate via Featherless (or local mock).
  const lookup = (predicate: (n: GraphNode) => boolean) =>
    Object.fromEntries(nextSnapshot.nodes.filter(predicate).map((n) => [n.id, n.name]));

  const narrative = await narrateRound({
    result,
    expertNameById: lookup((n) => n.type === "expert"),
    farmerNameById: lookup((n) => n.type === "farmer"),
    practiceNameById: lookup((n) => n.type === "practice"),
  });

  result.narrative = narrative;

  // Merge concurrent user edits before persisting. The engine started from a
  // snapshot read at T0; between then and now, the user may have dragged in
  // an edge or dropped a new node. nextSnapshot doesn't know about those,
  // and a naive replaceSnapshot would erase them from the in-memory store
  // (the Neo4j path uses MERGE so the edge survives in Aura but the client's
  // copy of the snapshot still loses it). Refresh + take the union of new
  // entities, engine's version wins for anything it also touched.
  const refreshed = await getSnapshot();
  const mergedSnapshot = mergeConcurrentEdits(snapshot, nextSnapshot, refreshed);

  await replaceSnapshot(mergedSnapshot);
  return NextResponse.json({ snapshot: mergedSnapshot, result });
}

/**
 * Union of two snapshot derivations that diverged from a common ancestor:
 *   - `initial` is what the engine read at T0
 *   - `engineResult` is what the engine produced (a fork of `initial`)
 *   - `latest` is what the store currently looks like (may have user edits)
 *
 * Strategy: start with engineResult, then add any node/edge from `latest`
 * whose id didn't exist in `initial` AND isn't already in engineResult.
 * Those are precisely the user-created entities that happened during the
 * round; without this merge they vanish from the client's snapshot.
 */
function mergeConcurrentEdits(
  initial: import("@/lib/graph/types").GraphSnapshot,
  engineResult: import("@/lib/graph/types").GraphSnapshot,
  latest: import("@/lib/graph/types").GraphSnapshot,
): import("@/lib/graph/types").GraphSnapshot {
  const initialNodeIds = new Set(initial.nodes.map((n) => n.id));
  const initialEdgeIds = new Set(initial.edges.map((e) => e.id));
  const engineNodeIds = new Set(engineResult.nodes.map((n) => n.id));
  const engineEdgeIds = new Set(engineResult.edges.map((e) => e.id));

  const concurrentNodes = latest.nodes.filter(
    (n) => !initialNodeIds.has(n.id) && !engineNodeIds.has(n.id),
  );
  const concurrentEdges = latest.edges.filter(
    (e) => !initialEdgeIds.has(e.id) && !engineEdgeIds.has(e.id),
  );

  return {
    nodes: [...engineResult.nodes, ...concurrentNodes],
    edges: [...engineResult.edges, ...concurrentEdges],
    round: engineResult.round,
  };
}
