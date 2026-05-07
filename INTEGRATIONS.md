# How the integrations connect

AgriDiffuse v2 has three external integrations. Each one is gated by a
single env var, has a working mock fallback, and lives behind a small
client module so the rest of the codebase doesn't know — or care —
whether it's hitting a real service or a deterministic stand-in.

This doc walks the data flow end-to-end so you can read any one file and
know exactly where the others plug in.

---

## The three layers

| Layer | Purpose | Module | Live when… |
|---|---|---|---|
| **Neo4j** | Graph storage | [`src/lib/graph/store-neo4j.ts`](src/lib/graph/store-neo4j.ts) | `NEO4J_URI` is set |
| **Masumi.network** | Agent identity + payments | [`src/lib/integrations/masumi.ts`](src/lib/integrations/masumi.ts) | `MASUMI_API_KEY` is set and `MASUMI_MOCK` is not `true` |
| **Featherless.ai** | LLM narration | [`src/lib/integrations/featherless.ts`](src/lib/integrations/featherless.ts) | `FEATHERLESS_API_KEY` is set |

Default config (`.env.example`) has all three off — the demo runs end-to-end
with mocks. Flip env vars to bring services online; nothing else changes.

---

## The "Next round" data flow

This is the pivotal moment in the app. Pressing **Play** or **Step** in the
simulator triggers `POST /api/round`, and that one request fans out through
every integration. Here's the sequence:

```
Browser                 Next.js API                 Integrations
────────                ───────────                  ────────────

POST /api/round   ─────►   route.ts:10
                              │
                              │ getSnapshot()
                              ▼
                           store.ts (router)
                              │
                              ├─► store-neo4j.ts ──► Cypher: MATCH (n) RETURN n
                              │   (if NEO4J_URI)
                              └─► store-memory.ts
                                  (otherwise)
                              ▲
                              │ GraphSnapshot
                              │
                           runRound(snapshot, { payReward })
                              │
                              │  for each new adoption with expert ancestor:
                              │     payReward(expertId, amount, ctx)
                              │              │
                              │              ▼
                              │           masumi.ts pay()  ──► POST {api}/payments
                              │                              (or mock txHash)
                              │
                              │  builds RoundResult { events, totalReward, ... }
                              ▼
                           narrateRound(result, names)
                              │
                              ▼
                           featherless.ts ──► POST api.featherless.ai/v1/chat/completions
                                              (or mock paragraph)
                              │
                              │ narrative paragraph
                              ▼
                           replaceSnapshot(nextSnapshot)
                              │
                              ├─► store-neo4j.ts ──► Cypher: MERGE (...) SET ...
                              │   (transactional batch)
                              └─► store-memory.ts
                                  (process-local mutation)

                           ◄───── { snapshot, result } ◄─────
                              JSON response back to the browser
```

Three external calls per round (one Neo4j read, one Masumi `pay` per rewarded
adoption, one Featherless narration), then a transactional Neo4j write.

---

## The seed-time flow

The first time anyone hits `/api/graph`, the store discovers an empty
database and seeds it. This is where Masumi gets one of its two touchpoints.

```
First GET /api/graph
       │
       ▼
   store.getSnapshot()
       │
       ▼
   store-neo4j.seedIfEmpty()
       │
       │  (Neo4j is empty)
       │
       │  for each Expert in seed:
       │     registerAgent(name) ──► POST {api}/agents
       │                              (or mock agent_0001_meera)
       │     persist returned agentId on the Expert node
       │
       └─► writeSnapshot(seed)  ──► Cypher: MERGE Expert/Farmer/Practice nodes
                                    + RECOMMENDS / ADVISES / KNOWS edges
```

After this, every Expert has a stable `agentId` that subsequent rounds can
pay rewards to.

---

## The "Explain this node" flow

Click any node → side panel → **Explain this node →**. This is the second
Featherless prompt, kept separate so the round narrator stays focused.

```
Click "Explain this node"
       │
       ▼
   POST /api/node/:id  with body { action: "explain" }
       │
       ▼
   route.ts:32 — assemble { nodeType, properties, neighbors }
       │
       ▼
   featherless.explainNode(ctx)
       │
       ▼
   POST api.featherless.ai/v1/chat/completions
       │
       │ (or deterministic mock paragraph)
       ▼
   { explanation: "..." }
```

---

## The store router pattern

The graph layer uses a **router** pattern: one public module
([`store.ts`](src/lib/graph/store.ts)) that picks a backend per call.

```ts
const usingNeo4j = (): boolean => Boolean(process.env.NEO4J_URI);

export async function getSnapshot(): Promise<GraphSnapshot> {
  return usingNeo4j() ? neo4jStore.getSnapshot() : memoryStore.getSnapshot();
}
```

Two implementations sit behind it:

- **[`store-memory.ts`](src/lib/graph/store-memory.ts)** — pinned to
  `globalThis` so HMR doesn't wipe state. Synchronous reads/writes; one
  JS object holds the entire graph.
- **[`store-neo4j.ts`](src/lib/graph/store-neo4j.ts)** — every public
  function is a Cypher round-trip. Idempotent `MERGE` writes, transactional
  snapshot saves, lazy schema bootstrap on first call.

Every consumer (the spread engine, the API routes, the React components)
imports from `store.ts` and never sees the choice. Flip `NEO4J_URI` and
the entire data layer changes underneath them.

---

## The Cypher schema

When `NEO4J_URI` is set, the store-neo4j module bootstraps three uniqueness
constraints (which double as id-lookup indexes) on first call:

```cypher
CREATE CONSTRAINT expert_id   IF NOT EXISTS FOR (n:Expert)   REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT farmer_id   IF NOT EXISTS FOR (n:Farmer)   REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT practice_id IF NOT EXISTS FOR (n:Practice) REQUIRE n.id IS UNIQUE;
```

The graph shape mirrors the PRD §4.1 model:

```
(:Expert  {id, name, domain, institution, credibilityScore, agentId, mood})
(:Farmer  {id, name, region, farmSize, adoptionRate, adoptedPractices, mood})
(:Practice{id, name, category, complexity, evidenceLevel})
(:Meta    {key:'graph', round})

(:Expert)-[:RECOMMENDS {id, confidence, date}]->(:Practice)
(:Expert)-[:ADVISES    {id, channel, date}]->(:Farmer)
(:Farmer)-[:KNOWS      {id, trustWeight}]->(:Farmer)
(:Farmer)-[:ADOPTED    {id, date, outcome, round, hopsFromExpert,
                        rewardTx, rewardAmount, rewardExpertId}]->(:Practice)
```

The round counter lives on a singleton `Meta` node so we don't need to
scan ADOPTED edges every read.

---

## Running it locally

### Default (mocks)

```bash
npm install
npm run dev
```

That's it. All three integrations run mocked. Open
[http://localhost:3000/simulate](http://localhost:3000/simulate) and press
Play.

### With Neo4j

```bash
docker compose up -d                              # boots Neo4j on 7474/7687
cp .env.example .env                              # if you haven't yet
# In .env, uncomment / set:
#   NEO4J_URI=bolt://localhost:7687
#   NEO4J_USER=neo4j
#   NEO4J_PASSWORD=agridiffuse
npm run dev
```

The first request to `/api/graph` will detect an empty DB and write the
seed. Visit [http://localhost:7474](http://localhost:7474) (creds:
`neo4j` / `agridiffuse`) to inspect:

```cypher
MATCH (n) RETURN n LIMIT 50
```

Run a few rounds in the app, then re-check the browser — you'll see new
`ADOPTED` edges with `rewardTx` properties.

### With Featherless live

Set `FEATHERLESS_API_KEY` in `.env`. Done. Each round will hit
`api.featherless.ai`; on failure it falls back to the mock automatically
(see the `try/catch` in [`featherless.ts`](src/lib/integrations/featherless.ts)).

### With Masumi live

Set `MASUMI_API_KEY`, `MASUMI_API_BASE` (default
`https://api.masumi.network/v1`), `MASUMI_TREASURY_ID`, and remove
`MASUMI_MOCK=true`. Real `agentId`s replace the mock counter, real
`txHash`es replace the deterministic stand-ins, and the explorer links
in the side panel will resolve to actual Cardano transactions.

---

## Where each integration plugs in (file-level)

If you're tracing a specific call site:

| What | File | Where |
|---|---|---|
| Masumi `registerAgent` | `src/lib/graph/store-memory.ts` | `getSnapshot()` lazy-init |
| Masumi `registerAgent` | `src/lib/graph/store-neo4j.ts` | `seedIfEmpty()` |
| Masumi `pay` | `src/app/api/round/route.ts` | `payReward` callback passed to `runRound` |
| Masumi `explorerUrl` | `src/features/graph/components/NodePanel.tsx` | Expert agentId link |
| Masumi `explorerUrl` | `src/features/graph/components/EdgePanel.tsx` | ADOPTED edge tx link |
| Featherless `narrateRound` | `src/app/api/round/route.ts` | After `runRound`, before response |
| Featherless `explainNode` | `src/app/api/node/[id]/route.ts` | POST handler with `action=explain` |
| Neo4j (read) | `src/lib/graph/store-neo4j.ts` | `getSnapshot()` → 4 Cypher reads |
| Neo4j (write) | `src/lib/graph/store-neo4j.ts` | `replaceSnapshot()` → MERGE in tx |
| Neo4j (patch) | `src/lib/graph/store-neo4j.ts` | `patchEdge`, `patchFarmer` |

---

## Why mocks are first-class

Every integration is built mock-first because:

1. **Hackathon demo wifi is unreliable.** Real APIs fail at the worst time;
   mocks make the demo robust.
2. **Tests stay fast and deterministic.** Vitest runs the entire spread
   engine + API routes against mocks in milliseconds.
3. **Onboarding is one command.** A new contributor runs `npm run dev` and
   has a working app — no API keys, no Docker, no setup.

The mocks are not stubs in the throwaway sense. They preserve the *shape*
and *latency profile* of the real services so the flow you see in mock
mode is the flow you'll see live, just with synthetic IDs and hashes.
