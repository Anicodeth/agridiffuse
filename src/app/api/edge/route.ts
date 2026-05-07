import { NextResponse } from "next/server";
import { addEdge, getSnapshot } from "@/lib/graph/store";
import type { GraphEdge, GraphNode } from "@/lib/graph/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/edge — Build-mode connect.
 *
 * Body: { source: string, target: string, type?: <inferred> }
 *
 * Edge type is inferred from the labels of the endpoints when not provided:
 *   Expert → Practice  → RECOMMENDS
 *   Expert → Farmer    → ADVISES
 *   Farmer → Farmer    → KNOWS
 *
 * Invalid combinations (Practice → anything, Farmer → Expert, etc.) return
 * 400 — keeps the demo's edge model honest without surfacing UI errors that
 * would distract during a live walkthrough.
 */

interface CreateBody {
  source: string;
  target: string;
  // Optional explicit type. If omitted, server infers from labels.
  type?: "RECOMMENDS" | "ADVISES" | "KNOWS";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.source || !body.target) {
    return NextResponse.json({ error: "Missing source or target" }, { status: 400 });
  }
  if (body.source === body.target) {
    return NextResponse.json({ error: "Cannot connect a node to itself" }, { status: 400 });
  }

  const snapshot = await getSnapshot();
  const src = snapshot.nodes.find((n) => n.id === body.source);
  const tgt = snapshot.nodes.find((n) => n.id === body.target);
  if (!src || !tgt) {
    return NextResponse.json({ error: "Source or target node not found" }, { status: 404 });
  }

  // Try the user's direction first; if the schema doesn't allow it, try the
  // reverse. This makes Build-mode drag direction-agnostic — dragging from a
  // farmer to an expert produces ADVISES (expert → farmer) just like dragging
  // the other way.
  let directedSrc = src;
  let directedTgt = tgt;
  let inferred = inferEdgeType(directedSrc, directedTgt);
  if (!inferred) {
    const reverse = inferEdgeType(tgt, src);
    if (reverse) {
      directedSrc = tgt;
      directedTgt = src;
      inferred = reverse;
    }
  }

  const type = body.type ?? inferred;
  if (!type) {
    return NextResponse.json(
      { error: `Cannot connect ${src.type} ↔ ${tgt.type}` },
      { status: 400 },
    );
  }
  if (body.type && body.type !== inferred) {
    return NextResponse.json(
      { error: `Type mismatch: ${src.type} ↔ ${tgt.type} cannot be ${body.type}` },
      { status: 400 },
    );
  }

  // Reject duplicates in EITHER direction so the toast is consistent — the
  // user thinks of the edge as connecting two nodes, not as A→B vs B→A.
  const dup = snapshot.edges.find(
    (e) =>
      e.type === type &&
      ((e.source === directedSrc.id && e.target === directedTgt.id) ||
        (e.source === directedTgt.id && e.target === directedSrc.id)),
  );
  if (dup) {
    return NextResponse.json(
      { error: `${type} edge already exists between these nodes`, edgeId: dup.id },
      { status: 409 },
    );
  }

  const id = generateEdgeId(type);
  const date = new Date().toISOString();
  let edge: GraphEdge;

  if (type === "RECOMMENDS") {
    edge = { id, type, source: directedSrc.id, target: directedTgt.id, confidence: 0.8, date };
  } else if (type === "ADVISES") {
    edge = { id, type, source: directedSrc.id, target: directedTgt.id, channel: "field-day", date };
  } else {
    edge = { id, type, source: directedSrc.id, target: directedTgt.id, trustWeight: 0.6 };
  }

  try {
    const next = await addEdge(edge);
    return NextResponse.json({ edge, snapshot: next });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

function inferEdgeType(
  src: GraphNode,
  tgt: GraphNode,
): "RECOMMENDS" | "ADVISES" | "KNOWS" | null {
  if (src.type === "expert" && tgt.type === "practice") return "RECOMMENDS";
  if (src.type === "expert" && tgt.type === "farmer") return "ADVISES";
  if (src.type === "farmer" && tgt.type === "farmer") return "KNOWS";
  return null;
}

function generateEdgeId(type: string): string {
  const stamp = Date.now().toString(36).slice(-5);
  const rand = Math.random().toString(36).slice(2, 5);
  return `${type.toLowerCase()}_user_${stamp}${rand}`;
}
