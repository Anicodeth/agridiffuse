# AgriDiffuse v2 — Implementation Plan

Hackathon-scale build plan. Optimized for a working demo over architectural purity. Phases are ordered so the v1 spine is demo-able at the end of Phase 3, and each subsequent phase adds a layer that can ship independently.

---

## 0. Stack at a Glance

| Layer | Choice | Why |
|---|---|---|
| Graph DB | **Neo4j 5** (Aura Free or Docker) | Native multi-hop traversal, Cypher, APOC for path tracing. |
| Backend | **Node.js + Fastify** (or Python + FastAPI) | Thin REST/WS layer. Pick whichever the team types fastest in. |
| Neo4j driver | `neo4j-driver` (official) | First-party, supports streaming. |
| Frontend scaffold | **Lovable** | Generates the 3-screen shell from the PRD. |
| Graph viz | **Neovis.js** (Cypher → vis-network) with **D3** for animation overlays | Neovis handles the live binding; D3 handles per-round animation. |
| LLM | **Featherless.ai** serverless (Llama 3 8B Instruct) | One call per round, no infra. |
| Agent payments | **Masumi.network** dev/test env | Agent identity + micro-payments. |
| Realtime | WebSocket (Fastify `@fastify/websocket` or FastAPI `WebSocket`) | Push round events to the canvas. |

**Repo layout:**
```
/agridiffuse
  /apps
    /web        ← Lovable-scaffolded React app
    /api        ← backend (Fastify or FastAPI)
  /packages
    /graph      ← Cypher queries + seed data
    /sim        ← spread algorithm
    /integrations
      /featherless
      /masumi
  docker-compose.yml   ← Neo4j + API
  .env.example
```

---

## 1. Phases & Milestones

| Phase | Outcome | Demo-able? |
|---|---|---|
| **P0** Bootstrap | Neo4j running, seed loaded, API can read graph | No |
| **P1** Graph canvas | Screen 1 shows the seeded graph live | Yes (static) |
| **P2** Spread engine | Backend runs propagation rounds, returns events | Yes (CLI) |
| **P3** v1 demo complete | Screens 1–3 wired, "Next Round" animates adoptions | **Yes — v1 ship line** |
| **P4** Featherless | Narrative box on Screen 2, "Explain node" button on Screen 1 | Yes |
| **P5** Masumi | Expert agent IDs at seed, rewards on adoption, earnings card | Yes |
| **P6** Polish | Animations, resistant farmer, trust sliders, reset, error states | **v2 ship line** |

A team of 2–3 should be able to hit P3 inside the first day and P6 by end of weekend.

---

## 2. Phase 0 — Bootstrap

**Tasks**
1. `docker-compose.yml` with Neo4j 5 (expose 7474 + 7687, set `NEO4J_AUTH`).
2. `.env.example` with: `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `FEATHERLESS_API_KEY`, `MASUMI_API_KEY`, `MASUMI_TREASURY_ID`.
3. API skeleton with one health endpoint hitting Neo4j.
4. Seed script: 3 experts, 15 farmers, 5 practices, plus `RECOMMENDS`, `ADVISES`, `KNOWS` edges. Idempotent (clears + reloads).
5. `npm run seed` / `make seed` target.

**Definition of done:** `curl localhost:8000/health` returns `{ neo4j: "ok", nodes: 23 }`.

---

## 3. Phase 1 — Graph Canvas (Screen 1)

**Backend endpoints**
- `GET /graph` — returns full graph as `{ nodes: [...], edges: [...] }`.
- `GET /node/:id` — node properties + 1-hop neighborhood + history.

**Frontend (Lovable scaffold)**
- Three-route shell: `/graph`, `/simulate`, `/metrics`.
- Screen 1: Neovis.js canvas bound to `GET /graph`. Color nodes by type, edge thickness by `trust_weight`/`confidence`.
- Side panel: opens on node click, calls `GET /node/:id`. Shows raw properties for now (Featherless wraps this in P4).

**Definition of done:** loading `/graph` shows the seeded network. Clicking any node opens the panel with its data.

---

## 4. Phase 2 — Spread Engine

This is the core logic. Keep it in `/packages/sim` so it's testable without the API.

**Algorithm (`runRound(state) → events`)**

```pseudo
events = []
newAdoptions = set()

# Pass 1: direct ADVISES seeding
for each (expert)-[:ADVISES]->(farmer) where farmer hasn't adopted any practice expert recommends:
    for each practice expert RECOMMENDS:
        if random() < expert.credibility_score * farmer.adoption_rate:
            newAdoptions.add((farmer, practice, source=expert, hops=0))

# Pass 2: trust-weighted relay
for each farmer who adopted last round:
    for each (farmer)-[k:KNOWS]->(neighbor):
        for each practice farmer adopted:
            if neighbor hasn't adopted that practice:
                if random() < k.trust_weight * farmer.adoption_rate:
                    newAdoptions.add((neighbor, practice, source=farmer, hops=parentHops+1))
                else:
                    events.append({type: "blocked", from: farmer, to: neighbor, practice})

# Persist
for adoption in newAdoptions:
    create (adoption.farmer)-[:ADOPTED {date: now()}]->(adoption.practice)
    events.append({type: "adopted", ...adoption})

return events
```

**Backend endpoints**
- `POST /round` — runs one round, returns `{ round: N, events: [...], summary: {...} }`.
- `POST /reset` — clears all `ADOPTED` edges, restores seed.
- `WS /stream` — pushes `events` as they're persisted (so the canvas can animate progressively).

**Definition of done:** running `POST /round` 5 times in a row produces a believable spread (not all-or-nothing), persisted in Neo4j.

---

## 5. Phase 3 — Wire All Three Screens (v1 ship line)

**Screen 2 — Spread Simulator**
- "Next Round" button → `POST /round`.
- WebSocket subscription animates new adoptions: node turns teal, edge along the spread path pulses.
- Round counter + new-adoption counter update.
- "Reset" button → `POST /reset` and full graph reload.

**Screen 3 — Metrics Dashboard**
- Three cards (v1): adoption leaderboard, expert reach, deepest chain.
- Each backed by a single Cypher query (see PRD §7).
- Refresh on round completion.

**Trust slider + resistant farmer (curious-attendee stories)**
- Slider on selected edge → `PATCH /edge/:id { trust_weight }`.
- "Make resistant" toggle on selected farmer → `PATCH /farmer/:id { adoption_rate: 0.1 }`.

**Definition of done:** a fresh visitor can load the app, click through all 3 screens, run 5 rounds, and see the metrics change.

---

## 6. Phase 4 — Featherless Integration

**Setup**
- `/packages/integrations/featherless/client.ts` — single `narrate(payload)` function. Holds the API key, picks the model, retries once on timeout.
- Pick model: Llama 3 8B Instruct (or Mistral 7B Instruct as fallback).

**Prompt 1 — Round narrator**

```
System: You are narrating an agricultural knowledge-spread simulation.
Given structured round events, produce ONE paragraph (2–3 sentences) describing
what happened in plain language. Mention specific farmer/expert names when
notable. Keep it factual, no embellishment.

User: { round: 3, new_adoptions: [...], blocked: [...], top_expert: "Meera",
        deepest_chain: 4 }
```

**Prompt 2 — Node explainer**

```
System: Describe this node in 2 sentences for a non-technical viewer.

User: { type: "Farmer", props: {...}, neighbors: [...] }
```

**Wiring**
- After every `/round`, backend calls `narrate()` and includes the text in the response.
- Frontend Screen 2: narrative box renders below the graph. Show "Narrating…" spinner while waiting; render graph animation immediately, don't block on the LLM.
- Frontend Screen 1 side panel: "Explain this node" button → calls `POST /node/:id/explain` → renders the response.

**Latency budget:** target < 2s per call. If Featherless is slow, render graph first and stream narrative in async.

**Definition of done:** every round produces a coherent paragraph; node explainer returns a readable summary for any node.

---

## 7. Phase 5 — Masumi Integration

**Setup**
- `/packages/integrations/masumi/client.ts` — three functions: `registerAgent(name) → agent_id`, `pay(from_treasury, to_agent_id, amount) → tx_hash`, `explorerUrl(tx_hash) → string`.
- Demo treasury wallet pre-funded with test-tokens.

**Seed-time changes**
- After creating each `Expert` node, call `registerAgent()` and write the returned `agent_id` onto the node.

**Round-time changes**

Add a step between "persist adoptions" and "narrate":

```pseudo
for each newAdoption:
    expert = traceExpertAncestor(newAdoption)   # closest RECOMMENDS ancestor
    if expert is not null:
        amount = BASE_REWARD * (0.5 ** newAdoption.hops)
        tx_hash = masumi.pay(TREASURY, expert.agent_id, amount)
        update ADOPTED edge: { reward_tx: tx_hash, reward_amount: amount, reward_expert_id: expert.agent_id }
```

**Trace function (Cypher)**
```cypher
MATCH path = (e:Expert)-[:RECOMMENDS]->(p:Practice)<-[:ADOPTED]-(start:Farmer)
             -[:KNOWS*0..5]-(end:Farmer)
WHERE end.id = $newAdopterId AND p.id = $practiceId
RETURN e, length(path) AS hops
ORDER BY hops ASC
LIMIT 1;
```

**Frontend**
- Screen 1: experts show a Masumi badge with shortened `agent_id`. Click to copy / open explorer.
- Screen 2: reward flows pulse back along the recommendation chain (animation overlay). Counter adds "X tADA distributed."
- Screen 3: 4th card — earnings leaderboard. Each row links to the explorer for the expert's most recent tx.

**Fallback / mock mode**
- Env flag `MASUMI_MOCK=true` returns synthetic `agent_id`s and `tx_hash`es without hitting the network. Use this if the live demo wifi is dicey. The graph behavior is identical; only the explorer links go nowhere.

**Definition of done:** running a round produces real (or mock) tx hashes on adopted edges; earnings card reflects them.

---

## 8. Phase 6 — Polish

| Item | Why it matters for the demo |
|---|---|
| Animation smoothing (debounce WS events, stagger node lights) | Without this, a round looks like a flicker. |
| "Introduce resistant farmer" preset button | One-click drama for the curious-attendee story. |
| "Replay round" button | Lets the operator re-show a good moment. |
| Loading + error states on every fetch | Demo wifi will fail at least once. |
| Keyboard shortcut: `space` = next round | Smoother live demo. |
| Graph layout pinning after first load | Prevents nodes from drifting during a demo. |
| Empty / reset state | Clean slate without a full page reload. |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Masumi dev env flaky during demo | `MASUMI_MOCK=true` fallback, baked in from P5. |
| Featherless latency > 3s | Render graph animation first, narrative streams in. Pre-warm with a dummy call on app load. |
| Neo4j Aura cold start | Use Docker locally for the demo machine; Aura only for shared dev. |
| Spread looks all-or-nothing | Tune `BASE_REWARD`, `credibility_score`, and `trust_weight` distributions in seed data so 1–4 adoptions per round is typical. |
| Graph too dense to read | Cap seed at 15 farmers; use force-directed layout with collision; allow filter by practice. |
| Lovable scaffold drifts from PRD | Treat Lovable output as a starting point, not source of truth. Hand-edit Screen 2 (most complex) early. |

---

## 10. Test Plan (lightweight)

- **Unit:** spread algorithm in `/packages/sim` — given a fixed seed and RNG, asserts deterministic events.
- **Integration:** run 10 rounds end-to-end, assert no orphan adoptions, all rewards have valid tx hashes (or mocks).
- **Manual demo dry-run:** scripted 3-minute walkthrough, run twice before showing.

---

## 11. Cut Lines (if time runs short)

In priority order, cut from the bottom:

1. Node-explainer Featherless prompt (keep round narrator only).
2. Trust-weight slider (keep resistant-farmer toggle only).
3. Animation polish on reward flow (just show the tx hash in the panel).
4. Block explorer linkout (show hash as text).
5. Earnings leaderboard (show in panel only, drop the 4th card).

Below this line is the v1 demo, which still tells a complete story.

---

## 12. Day-by-Day Suggested Schedule (2-day hackathon)

**Day 1**
- Morning: P0 + P1 (bootstrap + canvas).
- Afternoon: P2 + P3 (spread engine + all 3 screens). **v1 demo-able by end of day.**

**Day 2**
- Morning: P4 (Featherless) + P5 (Masumi).
- Afternoon: P6 (polish), dry-runs, cut decisions. **v2 ship.**
