import { NextResponse } from "next/server";
import neo4j, { type Record as Neo4jRecord, type Node, type Relationship } from "neo4j-driver";

/**
 * Whitelisted Cypher endpoint for the /neo4j explorer.
 *
 * The client picks a preset by id; the server runs ONLY the matching preset
 * query. Never echo arbitrary Cypher from the browser — it's the same risk
 * surface as eval()ing arbitrary SQL, with the bonus that DETACH DELETE on
 * the wrong node can wipe the graph.
 */

export const dynamic = "force-dynamic";

interface PresetGraph {
  id: string;
  title: string;
  description: string;
  cypher: string;
  kind: "graph";
}

interface PresetTable {
  id: string;
  title: string;
  description: string;
  cypher: string;
  kind: "table";
  columns: string[];
}

type Preset = PresetGraph | PresetTable;

const PRESETS: Preset[] = [
  {
    id: "full-graph",
    title: "Full graph",
    description:
      "Pulls every node and relationship in one read. Same shape the main /graph canvas renders.",
    cypher: `MATCH (n) WHERE NOT n:Meta
OPTIONAL MATCH (n)-[r]->(m) WHERE NOT m:Meta
RETURN n, r, m`,
    kind: "graph",
  },
  {
    id: "adoption-leaderboard",
    title: "Adoption leaderboard",
    description:
      "Counts how many farmers have adopted each practice. The classic 'reach' metric — straight from PRD §7.",
    cypher: `MATCH (f:Farmer)-[:ADOPTED]->(p:Practice)
RETURN p.name AS practice, count(f) AS adopters
ORDER BY adopters DESC`,
    kind: "table",
    columns: ["practice", "adopters"],
  },
  {
    id: "expert-earnings",
    title: "Expert earnings",
    description:
      "Sums every Masumi reward written onto ADOPTED edges, grouped by the expert that earned it. Direct adoptions pay 1×; each peer hop halves the share.",
    cypher: `MATCH (e:Expert)
OPTIONAL MATCH (:Farmer)-[a:ADOPTED]->(:Practice)
  WHERE a.rewardExpertId = e.id
RETURN e.name AS expert,
       count(a) AS rewardedAdoptions,
       coalesce(sum(a.rewardAmount), 0) AS totalReward
ORDER BY totalReward DESC`,
    kind: "table",
    columns: ["expert", "rewardedAdoptions", "totalReward"],
  },
];

export async function GET(req: Request) {
  if (!process.env.NEO4J_URI) {
    return NextResponse.json(
      { error: "NEO4J_URI is not set. The Cypher explorer needs a live database." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const presetId = url.searchParams.get("preset");
  if (!presetId) {
    return NextResponse.json({
      presets: PRESETS.map((p) => ({ id: p.id, title: p.title, description: p.description, kind: p.kind })),
    });
  }

  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    return NextResponse.json({ error: `Unknown preset: ${presetId}` }, { status: 400 });
  }

  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER ?? "neo4j", process.env.NEO4J_PASSWORD ?? ""),
    { connectionAcquisitionTimeout: 8000 },
  );
  const session = driver.session({ database: process.env.NEO4J_DATABASE ?? "neo4j" });

  const t0 = Date.now();
  try {
    const result = await session.run(preset.cypher);
    const latencyMs = Date.now() - t0;

    if (preset.kind === "graph") {
      return NextResponse.json({
        preset: { id: preset.id, title: preset.title, description: preset.description, cypher: preset.cypher, kind: preset.kind },
        latencyMs,
        data: shapeGraph(result.records),
      });
    }
    const rows = result.records.map((rec) => {
      const out: Record<string, unknown> = {};
      for (const col of preset.columns) out[col] = jsValue(rec.get(col));
      return out;
    });
    return NextResponse.json({
      preset: { id: preset.id, title: preset.title, description: preset.description, cypher: preset.cypher, kind: preset.kind, columns: preset.columns },
      latencyMs,
      data: rows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    await session.close();
    await driver.close();
  }
}

interface ShapedNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}
interface ShapedEdge {
  id: string;
  type: string;
  source: string;
  target: string;
  properties: Record<string, unknown>;
}

/**
 * Walk every column of every record, classify each value as a Node or
 * Relationship via the driver's type guards, and dedupe by internal id. We
 * resolve relationship endpoints in a second pass so order of records
 * doesn't matter.
 */
function shapeGraph(records: Neo4jRecord[]): { nodes: ShapedNode[]; edges: ShapedEdge[] } {
  // Internal numeric id (toString) → ShapedNode (also tracks the domain id for edge linking).
  const nodesByInternalId = new Map<string, ShapedNode & { _internalId: string }>();
  const pendingRels: Relationship[] = [];

  for (const rec of records) {
    for (const key of rec.keys) {
      const v = rec.get(key);
      if (v == null) continue;
      if (neo4j.isNode(v)) ingestNode(v);
      else if (neo4j.isRelationship(v)) pendingRels.push(v);
      // Paths are sequences of node-rel-node-rel-... — we don't use them yet,
      // but ignoring them lets path-shaped queries fall back gracefully.
    }
  }

  function ingestNode(n: Node) {
    const internalId = n.identity.toString();
    if (nodesByInternalId.has(internalId)) return;
    const props = jsObject(n.properties);
    const id = String(props.id ?? internalId);
    nodesByInternalId.set(internalId, {
      _internalId: internalId,
      id,
      labels: [...n.labels],
      properties: props,
    });
  }

  const edgesById = new Map<string, ShapedEdge>();
  for (const rel of pendingRels) {
    const src = nodesByInternalId.get(rel.start.toString());
    const tgt = nodesByInternalId.get(rel.end.toString());
    if (!src || !tgt) continue; // endpoints didn't come back in the result — skip silently
    const props = jsObject(rel.properties);
    const id = String(props.id ?? rel.identity.toString());
    if (edgesById.has(id)) continue;
    edgesById.set(id, {
      id,
      type: rel.type,
      source: src.id,
      target: tgt.id,
      properties: props,
    });
  }

  const nodes: ShapedNode[] = [...nodesByInternalId.values()].map(({ _internalId: _, ...rest }) => rest);
  return { nodes, edges: [...edgesById.values()] };
}

function jsValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (neo4j.isInt(v as object)) return (v as { toNumber(): number }).toNumber();
  if (Array.isArray(v)) return v.map(jsValue);
  if (typeof v === "object") return jsObject(v as Record<string, unknown>);
  return String(v);
}

function jsObject(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) out[k] = jsValue(v);
  return out;
}
