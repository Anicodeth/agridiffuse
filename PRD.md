# AgriDiffuse v2 — Product Requirements

**Tagline:** *Knowledge spreads. Rewards flow back. Same graph, opposite directions.*

A graph-based simulation of how agricultural practices diffuse through a network of experts and farmers. v2 layers a narrative engine and an agent-economy layer on top of the v1 diffusion graph.

---

## 1. Problem & Pitch

Agricultural extension is hard to measure: who recommended what, who actually adopted it, and whose advice meaningfully spread? AgriDiffuse models this as an epidemiological-style spread on a knowledge graph, then mirrors it with an economic graph so influence becomes verifiable and rewardable.

**The 30-second demo line:** *"This is how knowledge moves through a farming network. The graph shows the spread, the narrator tells you what just happened, and the agent layer pays the experts whose advice actually landed."*

---

## 2. Goals & Non-Goals

### Goals
- Demonstrate practice diffusion as a live, animated graph simulation.
- Show value flowing back to experts when their recommendations are adopted downstream.
- Translate raw graph state into plain-language narration each round.
- Keep the demo runnable from a cold start in under 60 seconds with seed data.

### Non-Goals (v2)
- No real farmers, real agronomy data, or production deployment.
- No marketplace, no expert onboarding flow, no auth.
- No fine-tuning, embeddings, or RAG — Featherless is used only for structured-data → text.
- No on-chain mainnet payments — Masumi runs in dev/test environment only.

---

## 3. Target Users

| Persona | What they need |
|---|---|
| **Researcher** | Step through spread rounds, inspect any node's full history, run targeted Cypher-style queries. |
| **Demo operator** | Reset to seed state, add nodes manually, trigger spread rounds on demand. |
| **Curious attendee** | Tweak trust weights, introduce a resistant farmer, toggle between graph and metrics. |

---

## 4. Core Concepts

### 4.1 Graph Data Model

**Nodes**

| Node | Properties |
|---|---|
| `Expert` | `name`, `domain`, `credibility_score` (0–1), `institution`, **`agent_id`** (Masumi wallet, v2) |
| `Farmer` | `name`, `region`, `farm_size`, `adoption_rate` (0–1), `adopted_practices[]` |
| `Practice` | `name`, `category` (soil/water/pest/yield), `complexity`, `evidence_level` (low/medium/high) |

**Relationships**

| Edge | Direction | Properties |
|---|---|---|
| `RECOMMENDS` | Expert → Practice | `confidence`, `date` |
| `ADVISES` | Expert → Farmer | `channel`, `date` |
| `KNOWS` | Farmer ↔ Farmer | `trust_weight` (0–1) |
| `ADOPTED` | Farmer → Practice | `date`, `outcome`, **`reward_tx`** (Masumi tx hash, v2; null for peer-driven adoption with no expert ancestor) |

The split between `ADVISES` (exposure) and `ADOPTED` (behavior change) is intentional — it lets the demo show the gap between reach and impact.

### 4.2 Spread Mechanics

Two propagation modes, applied each round:

1. **Direct seeding.** An `ADVISES` edge from an expert to a farmer can trigger adoption with probability `expert.credibility_score × farmer.adoption_rate`.
2. **Trust-weighted relay.** When a farmer adopts a practice, each `KNOWS` neighbor adopts with probability `trust_weight × adopter.adoption_rate`.

A round runs both passes, returns the set of new adoptions, and emits an event stream.

### 4.3 Post-Round Pipeline (new in v2)

After each spread round:

1. **Trace expert ancestry.** For each new adoption, walk back along `KNOWS`/`ADOPTED`/`RECOMMENDS` to find the closest originating expert. Record hop distance.
2. **Reward.** If an expert ancestor exists, send a Masumi payment from the demo treasury to `expert.agent_id`. Reward = `base × (0.5 ^ hop_distance)` (1× direct, 0.5× one hop, 0.25× two hops…). Store tx hash on the `ADOPTED` edge.
3. **Narrate.** Send the round's structured summary to Featherless. Display the returned 2–3 sentence paragraph.

---

## 5. User Stories

### Researcher
- I can watch a live graph step through spread rounds with nodes lighting up as they adopt.
- I can click any node to see properties, full history, and (for experts) earnings.
- I can run preset queries like *"farmers who adopted drip irrigation within 3 hops of Expert Meera."*

### Demo operator
- I can load seed data (15 farmers, 3 experts, 5 practices) with one click.
- I can add a new `Farmer` node and wire it into the network manually.
- I can trigger a spread round and watch the animation + narration appear together.
- I can reset to seed state at any time.

### Curious attendee
- I can drag a slider to adjust a `KNOWS` edge's trust weight and re-run the round.
- I can flip a farmer to "resistant" (`adoption_rate = 0.1`) and watch the spread stall.
- I can toggle between graph view and metrics view.

---

## 6. Screens

### Screen 1 — Graph Canvas
- Live force-directed graph (Neovis.js or D3 + Cypher).
- Node colors: purple = expert, teal = farmer-adopted, gray = farmer-not-reached, amber = practice.
- Edge thickness ∝ `trust_weight` or `confidence`.
- Experts display a small **Masumi badge** with shortened wallet ID.
- Click a node → side panel with properties, history, and an **"Explain this node"** button that calls Featherless for a plain-language summary.

### Screen 2 — Spread Simulator
- Big **"Next Round"** button.
- Round triggers: Neo4j propagation → expert trace → Masumi rewards → Featherless narration.
- New adoptions light up; reward flows pulse back along the recommendation chain.
- Counter shows both **"4 new adoptions"** and **"0.7 tADA distributed."**
- Below the graph: narrative box with the Featherless paragraph.
- Controls: trust-weight sliders on selected edges, "introduce resistant farmer" toggle, reset button.

### Screen 3 — Metrics Dashboard
Four cards:
1. **Practice adoption leaderboard** — count of farmers per practice.
2. **Expert reach ranking** — unique farmers within 2 hops of each expert.
3. **Deepest practice chain** — longest `Expert→Practice←Farmer→KNOWS*→Farmer→Practice` path.
4. **Expert earnings leaderboard** *(new in v2)* — sum of Masumi rewards per expert. Links out to a block explorer.

The earnings card is the proof that influence and value tracked together.

---

## 7. Key Cypher Queries

```cypher
// Adoption rate per practice
MATCH (f:Farmer)-[:ADOPTED]->(p:Practice)
RETURN p.name, count(f) AS adopters
ORDER BY adopters DESC;

// Expert reach (2 hops)
MATCH (e:Expert)-[:ADVISES]->(:Farmer)-[:KNOWS*0..1]->(f:Farmer)
RETURN e.name, count(DISTINCT f) AS reach
ORDER BY reach DESC;

// Practice chain (lineage)
MATCH path = (e:Expert)-[:RECOMMENDS]->(p:Practice)
             <-[:ADOPTED]-(f1:Farmer)-[:KNOWS*1..3]->(f2:Farmer)-[:ADOPTED]->(p)
RETURN path
ORDER BY length(path) DESC
LIMIT 5;

// Expert earnings (v2)
MATCH (e:Expert)-[:RECOMMENDS]->(p:Practice)<-[a:ADOPTED]-(:Farmer)
WHERE a.reward_tx IS NOT NULL AND a.reward_expert_id = e.agent_id
RETURN e.name, sum(a.reward_amount) AS earnings
ORDER BY earnings DESC;
```

---

## 8. Integrations (v2)

### 8.1 Featherless.ai — narrative layer
- **Model:** small instruct (Llama 3 8B Instruct or Mistral 7B Instruct).
- **Prompt 1 — Round narrator:** input = structured JSON of round events; output = one paragraph (2–3 sentences). Example output: *"Round 3: Drip irrigation moved through Kamau's cluster — three farmers adopted via the high-trust core. The eastern resistant cluster blocked the spread at two edges."*
- **Prompt 2 — Node explainer (optional):** input = node props + 1-hop neighborhood; output = readable description.
- One LLM call per round. No fine-tuning, embeddings, or RAG.

### 8.2 Masumi.network — agent economy
- **Seed:** on first load, register each of the 3 experts as a Masumi agent. Store `agent_id` on the `Expert` node.
- **Reward:** for each new adoption with a traceable expert ancestor, send a micro-payment from demo treasury → `expert.agent_id`. Amount = `base × 0.5^hop_distance`.
- **Display:** show the tx hash on the relevant edge in the side panel; link out to the Masumi/Cardano test explorer.

---

## 9. Success Criteria

The demo succeeds if, in a single 3-minute walkthrough, an attendee sees:
1. A spread round animate on the graph.
2. A coherent natural-language summary of what just happened.
3. A reward flow back to an expert with a real tx hash.
4. The earnings leaderboard reflect that flow.

If all four happen without manual intervention, ship it.

---

## 10. Open Questions

- Do we run Neo4j in Docker locally or via Aura free tier? (Affects setup time for the demo operator.)
- Is the Masumi dev environment reliable enough for a live demo, or do we need a "mock mode" toggle as fallback?
- Featherless latency budget: can we get a round narration back in under 2s? If not, render the graph animation first and stream the narrative in.
