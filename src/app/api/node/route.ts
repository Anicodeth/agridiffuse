import { NextResponse } from "next/server";
import { addNode } from "@/lib/graph/store";
import type { ExpertNode, FarmerNode, GraphNode, PracticeNode } from "@/lib/graph/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/node — Build-mode create.
 *
 * Body:
 *   { type: "farmer" | "expert" | "practice", name?: string, ...optional fields }
 *
 * The server fills in any missing fields with sensible defaults so the UI
 * can do a one-click drop without forcing a property dialog. Properties can
 * be edited afterwards via the existing PATCH endpoints.
 */

interface CreateBody {
  type: "farmer" | "expert" | "practice";
  id?: string;
  name?: string;
  // farmer
  region?: string;
  farmSize?: number;
  adoptionRate?: number;
  // expert
  domain?: string;
  institution?: string;
  credibilityScore?: number;
  // practice
  category?: PracticeNode["category"];
  complexity?: number;
  evidenceLevel?: PracticeNode["evidenceLevel"];
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.type || !["farmer", "expert", "practice"].includes(body.type)) {
    return NextResponse.json({ error: "Missing or invalid 'type'" }, { status: 400 });
  }

  const id = body.id ?? generateId(body.type);
  let node: GraphNode;

  if (body.type === "farmer") {
    node = {
      id,
      type: "farmer",
      name: body.name ?? defaultName("Farmer"),
      region: body.region ?? "Unspecified",
      farmSize: clampNum(body.farmSize, 0.1, 50, 1.5),
      adoptionRate: clampNum(body.adoptionRate, 0, 1, 0.5),
      adoptedPractices: [],
      mood: "happy",
    } satisfies FarmerNode;
  } else if (body.type === "expert") {
    node = {
      id,
      type: "expert",
      name: body.name ?? defaultName("Expert"),
      domain: body.domain ?? "Generalist",
      institution: body.institution ?? "Independent",
      credibilityScore: clampNum(body.credibilityScore, 0, 1, 0.7),
      agentId: null, // store-side hook fills this in via Masumi register
      mood: "happy",
    } satisfies ExpertNode;
  } else {
    node = {
      id,
      type: "practice",
      name: body.name ?? defaultName("Practice"),
      category: body.category ?? "yield",
      complexity: clampInt(body.complexity, 1, 5, 2),
      evidenceLevel: body.evidenceLevel ?? "medium",
    } satisfies PracticeNode;
  }

  try {
    const snapshot = await addNode(node);
    // Return the saved node (which may have an extra agentId for experts) by
    // looking it up in the resulting snapshot — the input may have been a
    // partial copy if the store layer enriched it.
    const saved = snapshot.nodes.find((n) => n.id === node.id) ?? node;
    return NextResponse.json({ node: saved, snapshot });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

function generateId(type: string): string {
  // Short URL-safe id; collisions are vanishingly unlikely at demo scale.
  const stamp = Date.now().toString(36).slice(-5);
  const rand = Math.random().toString(36).slice(2, 5);
  const prefix = type[0]; // f / e / p
  return `${prefix}_user_${stamp}${rand}`;
}

function defaultName(kind: string): string {
  return `New ${kind.toLowerCase()} ${Date.now() % 1000}`;
}

function clampNum(v: number | undefined, lo: number, hi: number, fallback: number): number {
  if (v === undefined || Number.isNaN(v)) return fallback;
  return Math.max(lo, Math.min(hi, v));
}

function clampInt(v: number | undefined, lo: number, hi: number, fallback: number): number {
  return Math.round(clampNum(v, lo, hi, fallback));
}
