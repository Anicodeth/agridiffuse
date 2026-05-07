import neo4j, { type Driver, type Session, type Integer } from "neo4j-driver";
import type {
  AdoptedEdge,
  AdvisesEdge,
  ExpertNode,
  FarmerNode,
  GraphEdge,
  GraphNode,
  GraphSnapshot,
  KnowsEdge,
  NodeId,
  PracticeNode,
  RecommendsEdge,
} from "./types";
import { buildSeedSnapshot } from "./seed";
import { registerAgent } from "@/lib/integrations/masumi";

/**
 * Neo4j-backed graph store.
 *
 * Same public surface as [store-memory.ts](store-memory.ts); each call here
 * is a Cypher round-trip. We keep the driver process-wide via globalThis so
 * Next.js HMR doesn't open a fresh socket pool on every reload.
 *
 * Schema (created via the Cypher in `bootstrapSchema`):
 *
 *   (Expert {id, name, domain, institution, credibilityScore, agentId, mood})
 *   (Farmer {id, name, region, farmSize, adoptionRate, adoptedPractices, mood})
 *   (Practice {id, name, category, complexity, evidenceLevel})
 *   (Meta {key:'graph', round})
 *
 *   (e:Expert)-[:RECOMMENDS {id, confidence, date}]->(p:Practice)
 *   (e:Expert)-[:ADVISES    {id, channel, date}]->(f:Farmer)
 *   (a:Farmer)-[:KNOWS      {id, trustWeight}]->(b:Farmer)
 *   (f:Farmer)-[:ADOPTED    {id, date, outcome, round, hopsFromExpert,
 *                            rewardTx, rewardAmount, rewardExpertId}]->(p:Practice)
 *
 * Round number is stored on a singleton (Meta {key:'graph'}) so we don't
 * need to scan adopted edges to find the latest round.
 */

// ── Driver singleton ──────────────────────────────────────────────

const DRIVER_KEY = Symbol.for("agridiffuse.neo4j.driver.v1");
type GlobalWithDriver = typeof globalThis & { [DRIVER_KEY]?: Driver };
const g = globalThis as GlobalWithDriver;

function getDriver(): Driver {
  if (g[DRIVER_KEY]) return g[DRIVER_KEY]!;
  const uri = process.env.NEO4J_URI!;
  const user = process.env.NEO4J_USER ?? "neo4j";
  const password = process.env.NEO4J_PASSWORD ?? "";
  if (!uri) throw new Error("NEO4J_URI is required for the Neo4j-backed store");
  g[DRIVER_KEY] = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    // The driver retries connection establishment for ~30s by default; that's
    // longer than a Next route handler should hold. Cap it for snappier errors.
    connectionAcquisitionTimeout: 8000,
  });
  return g[DRIVER_KEY]!;
}

function withSession<T>(fn: (s: Session) => Promise<T>): Promise<T> {
  const session = getDriver().session({
    database: process.env.NEO4J_DATABASE ?? "neo4j",
  });
  return fn(session).finally(() => session.close());
}

// ── Number coercion ──────────────────────────────────────────────
// Neo4j returns 64-bit integers as { low, high } objects. Coerce to JS numbers
// at the boundary so domain code never sees driver-specific types.

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (neo4j.isInt(v as Integer)) return (v as Integer).toNumber();
  return Number(v);
}

// ── Schema bootstrap ─────────────────────────────────────────────

let schemaReady = false;

async function bootstrapSchema() {
  if (schemaReady) return;
  await withSession(async (s) => {
    // Uniqueness constraints double as indexes — every lookup is by id.
    await s.run("CREATE CONSTRAINT expert_id IF NOT EXISTS FOR (n:Expert) REQUIRE n.id IS UNIQUE");
    await s.run("CREATE CONSTRAINT farmer_id IF NOT EXISTS FOR (n:Farmer) REQUIRE n.id IS UNIQUE");
    await s.run("CREATE CONSTRAINT practice_id IF NOT EXISTS FOR (n:Practice) REQUIRE n.id IS UNIQUE");
  });
  schemaReady = true;
}

// ── First-load: seed if empty ────────────────────────────────────

async function isEmpty(): Promise<boolean> {
  return withSession(async (s) => {
    const result = await s.run("MATCH (n) RETURN count(n) AS c LIMIT 1");
    return toNum(result.records[0]?.get("c")) === 0;
  });
}

async function seedIfEmpty() {
  if (!(await isEmpty())) return;
  const seed = buildSeedSnapshot();

  // Assign Masumi agentIds to experts before we write — same lazy-register
  // pattern the in-memory store uses, just consolidated to seed time.
  for (const node of seed.nodes) {
    if (node.type === "expert" && !node.agentId) {
      const agent = await registerAgent(node.name);
      node.agentId = agent.agentId;
    }
  }
  await writeSnapshot(seed);
}

// ── Reads ────────────────────────────────────────────────────────

export async function getSnapshot(): Promise<GraphSnapshot> {
  await bootstrapSchema();
  await seedIfEmpty();
  // A single Session can only have one auto-transaction in flight at a time —
  // Promise.all-ing five reads against the same session is a protocol error.
  // Sequential awaits on one session is the cheapest correct option.
  return withSession(async (s) => {
    const experts = await readExperts(s);
    const farmers = await readFarmers(s);
    const practices = await readPractices(s);
    const edges = await readEdges(s);
    const round = await readRound(s);
    return {
      nodes: [...experts, ...farmers, ...practices],
      edges,
      round,
    };
  });
}

async function readExperts(s: Session): Promise<ExpertNode[]> {
  const r = await s.run("MATCH (n:Expert) RETURN n ORDER BY n.id");
  return r.records.map((rec) => {
    const p = rec.get("n").properties as Record<string, unknown>;
    return {
      id: String(p.id),
      type: "expert",
      name: String(p.name),
      domain: String(p.domain),
      institution: String(p.institution),
      credibilityScore: Number(p.credibilityScore),
      agentId: (p.agentId as string | null) ?? null,
      mood: p.mood as ExpertNode["mood"],
    };
  });
}

async function readFarmers(s: Session): Promise<FarmerNode[]> {
  const r = await s.run("MATCH (n:Farmer) RETURN n ORDER BY n.id");
  return r.records.map((rec) => {
    const p = rec.get("n").properties as Record<string, unknown>;
    const adopted = (p.adoptedPractices as string[] | undefined) ?? [];
    return {
      id: String(p.id),
      type: "farmer",
      name: String(p.name),
      region: String(p.region),
      farmSize: Number(p.farmSize),
      adoptionRate: Number(p.adoptionRate),
      adoptedPractices: adopted,
      mood: p.mood as FarmerNode["mood"],
    };
  });
}

async function readPractices(s: Session): Promise<PracticeNode[]> {
  const r = await s.run("MATCH (n:Practice) RETURN n ORDER BY n.id");
  return r.records.map((rec) => {
    const p = rec.get("n").properties as Record<string, unknown>;
    return {
      id: String(p.id),
      type: "practice",
      name: String(p.name),
      category: p.category as PracticeNode["category"],
      complexity: toNum(p.complexity),
      evidenceLevel: p.evidenceLevel as PracticeNode["evidenceLevel"],
    };
  });
}

async function readEdges(s: Session): Promise<GraphEdge[]> {
  // Single query that pulls every relationship we care about. Each row tells
  // us its label so the JS side can branch on edge type.
  const r = await s.run(`
    MATCH (a)-[r]->(b)
    WHERE type(r) IN ['RECOMMENDS','ADVISES','KNOWS','ADOPTED']
    RETURN type(r) AS kind, properties(r) AS props, a.id AS source, b.id AS target
    ORDER BY type(r), r.id
  `);
  const out: GraphEdge[] = [];
  for (const rec of r.records) {
    const kind = rec.get("kind") as string;
    const p = rec.get("props") as Record<string, unknown>;
    const source = String(rec.get("source"));
    const target = String(rec.get("target"));
    if (kind === "RECOMMENDS") {
      out.push({
        id: String(p.id),
        type: "RECOMMENDS",
        source,
        target,
        confidence: Number(p.confidence),
        date: String(p.date),
      } satisfies RecommendsEdge);
    } else if (kind === "ADVISES") {
      out.push({
        id: String(p.id),
        type: "ADVISES",
        source,
        target,
        channel: p.channel as AdvisesEdge["channel"],
        date: String(p.date),
      });
    } else if (kind === "KNOWS") {
      out.push({
        id: String(p.id),
        type: "KNOWS",
        source,
        target,
        trustWeight: Number(p.trustWeight),
      } satisfies KnowsEdge);
    } else if (kind === "ADOPTED") {
      out.push({
        id: String(p.id),
        type: "ADOPTED",
        source,
        target,
        date: String(p.date),
        outcome: (p.outcome as AdoptedEdge["outcome"]) ?? "pending",
        rewardTx: (p.rewardTx as string | null) ?? null,
        rewardAmount: p.rewardAmount === undefined || p.rewardAmount === null ? null : Number(p.rewardAmount),
        rewardExpertId: (p.rewardExpertId as string | null) ?? null,
        hopsFromExpert: p.hopsFromExpert === undefined || p.hopsFromExpert === null ? null : toNum(p.hopsFromExpert),
        round: toNum(p.round),
      });
    }
  }
  return out;
}

async function readRound(s: Session): Promise<number> {
  const r = await s.run("MATCH (m:Meta {key:'graph'}) RETURN m.round AS round");
  return toNum(r.records[0]?.get("round") ?? 0);
}

// ── Writes ───────────────────────────────────────────────────────

export async function replaceSnapshot(next: GraphSnapshot): Promise<void> {
  // Awaited so the next read sees this round's writes. The earlier
  // fire-and-forget version was fast but raced with subsequent rounds —
  // a fresh Step click could read stale state before commit landed.
  await writeSnapshot(next);
}

async function writeSnapshot(snapshot: GraphSnapshot): Promise<void> {
  await bootstrapSchema();
  // Group nodes and edges by type so we can MERGE each batch with one
  // UNWIND-driven query — Aura's per-round-trip latency (~50ms) dominates
  // otherwise, and a per-row write would mean ~50 trips per snapshot.
  const experts = snapshot.nodes.filter((n) => n.type === "expert");
  const farmers = snapshot.nodes.filter((n) => n.type === "farmer");
  const practices = snapshot.nodes.filter((n) => n.type === "practice");
  const recommends = snapshot.edges.filter((e) => e.type === "RECOMMENDS");
  const advises = snapshot.edges.filter((e) => e.type === "ADVISES");
  const knows = snapshot.edges.filter((e) => e.type === "KNOWS");
  const adopted = snapshot.edges.filter((e) => e.type === "ADOPTED");

  await withSession(async (s) => {
    // One transaction per snapshot write — keeps the round atomic so partial
    // writes can't leave the graph in a half-applied state.
    const tx = s.beginTransaction();
    try {
      await tx.run(
        "MERGE (m:Meta {key:'graph'}) SET m.round = $round",
        { round: snapshot.round },
      );

      if (experts.length) {
        await tx.run(
          `UNWIND $rows AS row
           MERGE (e:Expert {id: row.id})
           SET e.name=row.name, e.domain=row.domain, e.institution=row.institution,
               e.credibilityScore=row.cred, e.agentId=row.agentId, e.mood=row.mood`,
          {
            rows: experts.map((n) => ({
              id: n.id,
              name: (n as Extract<GraphNode, { type: "expert" }>).name,
              domain: (n as Extract<GraphNode, { type: "expert" }>).domain,
              institution: (n as Extract<GraphNode, { type: "expert" }>).institution,
              cred: (n as Extract<GraphNode, { type: "expert" }>).credibilityScore,
              agentId: (n as Extract<GraphNode, { type: "expert" }>).agentId,
              mood: n.mood ?? null,
            })),
          },
        );
      }

      if (farmers.length) {
        await tx.run(
          `UNWIND $rows AS row
           MERGE (f:Farmer {id: row.id})
           SET f.name=row.name, f.region=row.region, f.farmSize=row.farmSize,
               f.adoptionRate=row.adoptionRate, f.adoptedPractices=row.adopted, f.mood=row.mood`,
          {
            rows: farmers.map((n) => {
              const f = n as Extract<GraphNode, { type: "farmer" }>;
              return {
                id: f.id,
                name: f.name,
                region: f.region,
                farmSize: f.farmSize,
                adoptionRate: f.adoptionRate,
                adopted: f.adoptedPractices,
                mood: f.mood ?? null,
              };
            }),
          },
        );
      }

      if (practices.length) {
        await tx.run(
          `UNWIND $rows AS row
           MERGE (p:Practice {id: row.id})
           SET p.name=row.name, p.category=row.category, p.complexity=row.complexity,
               p.evidenceLevel=row.ev`,
          {
            rows: practices.map((n) => {
              const p = n as Extract<GraphNode, { type: "practice" }>;
              return {
                id: p.id,
                name: p.name,
                category: p.category,
                complexity: p.complexity,
                ev: p.evidenceLevel,
              };
            }),
          },
        );
      }

      if (recommends.length) {
        await tx.run(
          `UNWIND $rows AS row
           MATCH (a:Expert {id: row.src}), (b:Practice {id: row.tgt})
           MERGE (a)-[r:RECOMMENDS {id: row.id}]->(b)
           SET r.confidence=row.conf, r.date=row.date`,
          {
            rows: recommends.map((e) => {
              const r = e as Extract<GraphEdge, { type: "RECOMMENDS" }>;
              return { src: r.source, tgt: r.target, id: r.id, conf: r.confidence, date: r.date };
            }),
          },
        );
      }

      if (advises.length) {
        await tx.run(
          `UNWIND $rows AS row
           MATCH (a:Expert {id: row.src}), (b:Farmer {id: row.tgt})
           MERGE (a)-[r:ADVISES {id: row.id}]->(b)
           SET r.channel=row.channel, r.date=row.date`,
          {
            rows: advises.map((e) => {
              const a = e as Extract<GraphEdge, { type: "ADVISES" }>;
              return { src: a.source, tgt: a.target, id: a.id, channel: a.channel, date: a.date };
            }),
          },
        );
      }

      if (knows.length) {
        await tx.run(
          `UNWIND $rows AS row
           MATCH (a:Farmer {id: row.src}), (b:Farmer {id: row.tgt})
           MERGE (a)-[r:KNOWS {id: row.id}]->(b)
           SET r.trustWeight=row.tw`,
          {
            rows: knows.map((e) => {
              const k = e as Extract<GraphEdge, { type: "KNOWS" }>;
              return { src: k.source, tgt: k.target, id: k.id, tw: k.trustWeight };
            }),
          },
        );
      }

      if (adopted.length) {
        await tx.run(
          `UNWIND $rows AS row
           MATCH (a:Farmer {id: row.src}), (b:Practice {id: row.tgt})
           MERGE (a)-[r:ADOPTED {id: row.id}]->(b)
           SET r.date=row.date, r.outcome=row.outcome, r.round=row.round,
               r.hopsFromExpert=row.hops, r.rewardTx=row.tx, r.rewardAmount=row.amt,
               r.rewardExpertId=row.expertId`,
          {
            rows: adopted.map((e) => {
              const a = e as Extract<GraphEdge, { type: "ADOPTED" }>;
              return {
                src: a.source,
                tgt: a.target,
                id: a.id,
                date: a.date,
                outcome: a.outcome,
                round: a.round,
                hops: a.hopsFromExpert,
                tx: a.rewardTx,
                amt: a.rewardAmount,
                expertId: a.rewardExpertId,
              };
            }),
          },
        );
      }

      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  });
}

// ── Targeted insertions ──────────────────────────────────────────
// Used by the Build-mode UX. We MERGE on id (idempotent), and for experts
// we register a Masumi agent so the node can earn rewards from rounds.

export async function addNode(node: GraphNode): Promise<GraphSnapshot> {
  await bootstrapSchema();
  let resolved: GraphNode = node;
  if (node.type === "expert" && !node.agentId) {
    const agent = await registerAgent(node.name);
    resolved = { ...node, agentId: agent.agentId };
  }
  await withSession(async (s) => {
    if (resolved.type === "expert") {
      await s.run(
        `MERGE (e:Expert {id:$id})
         SET e.name=$name, e.domain=$domain, e.institution=$institution,
             e.credibilityScore=$cred, e.agentId=$agentId, e.mood=$mood`,
        {
          id: resolved.id,
          name: resolved.name,
          domain: resolved.domain,
          institution: resolved.institution,
          cred: resolved.credibilityScore,
          agentId: resolved.agentId,
          mood: resolved.mood ?? null,
        },
      );
    } else if (resolved.type === "farmer") {
      await s.run(
        `MERGE (f:Farmer {id:$id})
         SET f.name=$name, f.region=$region, f.farmSize=$farmSize,
             f.adoptionRate=$adoptionRate, f.adoptedPractices=$adopted, f.mood=$mood`,
        {
          id: resolved.id,
          name: resolved.name,
          region: resolved.region,
          farmSize: resolved.farmSize,
          adoptionRate: resolved.adoptionRate,
          adopted: resolved.adoptedPractices,
          mood: resolved.mood ?? null,
        },
      );
    } else {
      await s.run(
        `MERGE (p:Practice {id:$id})
         SET p.name=$name, p.category=$category, p.complexity=$complexity, p.evidenceLevel=$ev`,
        {
          id: resolved.id,
          name: resolved.name,
          category: resolved.category,
          complexity: resolved.complexity,
          ev: resolved.evidenceLevel,
        },
      );
    }
  });
  return getSnapshot();
}

export async function addEdge(edge: GraphEdge): Promise<GraphSnapshot> {
  await bootstrapSchema();
  await withSession(async (s) => {
    if (edge.type === "RECOMMENDS") {
      await s.run(
        `MATCH (a:Expert {id:$src}), (b:Practice {id:$tgt})
         MERGE (a)-[r:RECOMMENDS {id:$id}]->(b)
         SET r.confidence=$conf, r.date=$date`,
        { src: edge.source, tgt: edge.target, id: edge.id, conf: edge.confidence, date: edge.date },
      );
    } else if (edge.type === "ADVISES") {
      await s.run(
        `MATCH (a:Expert {id:$src}), (b:Farmer {id:$tgt})
         MERGE (a)-[r:ADVISES {id:$id}]->(b)
         SET r.channel=$channel, r.date=$date`,
        { src: edge.source, tgt: edge.target, id: edge.id, channel: edge.channel, date: edge.date },
      );
    } else if (edge.type === "KNOWS") {
      await s.run(
        `MATCH (a:Farmer {id:$src}), (b:Farmer {id:$tgt})
         MERGE (a)-[r:KNOWS {id:$id}]->(b)
         SET r.trustWeight=$tw`,
        { src: edge.source, tgt: edge.target, id: edge.id, tw: edge.trustWeight },
      );
    } else {
      // ADOPTED edges are typically engine-generated; allow manual creation
      // for completeness (e.g. seeding a "what if this farmer already
      // adopted" scenario in Build mode).
      await s.run(
        `MATCH (a:Farmer {id:$src}), (b:Practice {id:$tgt})
         MERGE (a)-[r:ADOPTED {id:$id}]->(b)
         SET r.date=$date, r.outcome=$outcome, r.round=$round,
             r.hopsFromExpert=$hops, r.rewardTx=$tx, r.rewardAmount=$amt,
             r.rewardExpertId=$expertId`,
        {
          src: edge.source,
          tgt: edge.target,
          id: edge.id,
          date: edge.date,
          outcome: edge.outcome,
          round: edge.round,
          hops: edge.hopsFromExpert,
          tx: edge.rewardTx,
          amt: edge.rewardAmount,
          expertId: edge.rewardExpertId,
        },
      );
    }
  });
  return getSnapshot();
}

// ── Reset ────────────────────────────────────────────────────────

export async function resetSnapshot(): Promise<GraphSnapshot> {
  await withSession(async (s) => {
    await s.run("MATCH (n) DETACH DELETE n");
  });
  // re-run the seed-if-empty flow
  await seedIfEmpty();
  return getSnapshot();
}

// ── Targeted patches ─────────────────────────────────────────────
// We expose patches as direct writes (no read-modify-write race) so they're
// cheap relative to a full snapshot rewrite.

export async function patchEdge(
  edgeId: string,
  patch: Partial<{ trustWeight: number; confidence: number }>,
): Promise<GraphSnapshot> {
  await withSession(async (s) => {
    if (patch.trustWeight !== undefined) {
      await s.run(
        `MATCH ()-[r:KNOWS {id:$id}]->() SET r.trustWeight = $tw`,
        { id: edgeId, tw: clamp(patch.trustWeight, 0, 1) },
      );
    }
    if (patch.confidence !== undefined) {
      await s.run(
        `MATCH ()-[r:RECOMMENDS {id:$id}]->() SET r.confidence = $c`,
        { id: edgeId, c: clamp(patch.confidence, 0, 1) },
      );
    }
  });
  return getSnapshot();
}

export async function patchFarmer(
  farmerId: NodeId,
  patch: { adoptionRate?: number },
): Promise<GraphSnapshot> {
  if (patch.adoptionRate !== undefined) {
    await withSession((s) =>
      s.run(`MATCH (f:Farmer {id:$id}) SET f.adoptionRate = $rate`, {
        id: farmerId,
        rate: clamp(patch.adoptionRate!, 0, 1),
      }),
    );
  }
  return getSnapshot();
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
