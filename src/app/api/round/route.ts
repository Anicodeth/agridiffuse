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
  await replaceSnapshot(nextSnapshot);

  return NextResponse.json({ snapshot: nextSnapshot, result });
}
