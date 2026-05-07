import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/graph/store";
import { explainNode } from "@/lib/integrations/featherless";
import type { GraphEdge, GraphNode } from "@/lib/graph/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await getSnapshot();
  const node = snapshot.nodes.find((n) => n.id === id);
  if (!node) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const oneHopEdges = snapshot.edges.filter((e) => e.source === id || e.target === id);
  const neighborIds = new Set<string>();
  for (const e of oneHopEdges) {
    if (e.source !== id) neighborIds.add(e.source);
    if (e.target !== id) neighborIds.add(e.target);
  }
  const neighbors = snapshot.nodes.filter((n) => neighborIds.has(n.id));

  const history = buildHistory(node, oneHopEdges, snapshot.nodes);

  return NextResponse.json({ node, neighbors, edges: oneHopEdges, history });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "explain") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const snapshot = await getSnapshot();
  const node = snapshot.nodes.find((n) => n.id === id);
  if (!node) return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const oneHopEdges = snapshot.edges.filter((e) => e.source === id || e.target === id);
  const neighbors = snapshot.nodes
    .filter((n) => oneHopEdges.some((e) => e.source === n.id || e.target === n.id) && n.id !== id)
    .map((n) => {
      const edge = oneHopEdges.find((e) => e.source === n.id || e.target === n.id);
      return {
        relation: edge?.type ?? "RELATED",
        name: n.name,
      };
    });

  const explanation = await explainNode({
    nodeType: node.type,
    properties: node as unknown as Record<string, unknown>,
    neighbors,
  });

  return NextResponse.json({ explanation });
}

function buildHistory(node: GraphNode, edges: GraphEdge[], nodes: GraphNode[]): string[] {
  const labelOf = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return id;
    return "name" in n ? n.name : id;
  };
  const lines: string[] = [];
  for (const e of edges) {
    if (e.source !== node.id && e.target !== node.id) continue;
    if (e.type === "ADOPTED" && e.source === node.id) {
      const reward = e.rewardTx ? ` · reward ${e.rewardAmount?.toFixed(2) ?? "—"}` : "";
      lines.push(`Adopted ${labelOf(e.target)}${reward}`);
    }
    if (e.type === "RECOMMENDS" && e.source === node.id) {
      lines.push(`Recommends ${labelOf(e.target)}`);
    }
    if (e.type === "ADVISES" && e.source === node.id) {
      lines.push(`Advised ${labelOf(e.target)} via ${e.channel}`);
    }
  }
  return lines.slice(0, 8);
}
