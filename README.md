# AgriDiffuse

> **Knowledge spreads. Rewards flow back. Same graph, opposite directions.**

AgriDiffuse is a graph-based simulation of how agricultural practices diffuse through a network of experts and farmers. v2 layers a narrative engine (Featherless.ai) and an agent-economy layer (Masumi.network) on top of the v1 diffusion graph.

This repo contains:
- **[PRD.md](./PRD.md)** — product requirements
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** — phased build plan
- **Working Next.js app** — three screens, mock-by-default integrations, ready to wire to live services.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # all values are optional — defaults run in mock mode
npm run dev
```

Then open `http://localhost:3000`. The demo runs entirely on in-memory mocks by default, so you can present without internet.

To wire live services later, fill in the env vars in `.env.local`:

```
NEO4J_URI=bolt://localhost:7687    # leaves in-memory store if blank
FEATHERLESS_API_KEY=...            # falls back to deterministic local narrator if blank
MASUMI_MOCK=false                  # flip to use the live dev environment
MASUMI_API_KEY=...
MASUMI_TREASURY_ID=...
```

---

## Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout — fonts, NavBar, Footer
│   ├── page.tsx                  # Landing
│   ├── graph/page.tsx            # Screen 1 — graph canvas
│   ├── simulate/page.tsx         # Screen 2 — spread simulator
│   ├── metrics/page.tsx          # Screen 3 — metrics dashboard
│   └── api/                      # Server-side endpoints
│       ├── graph/                # GET full graph
│       ├── round/                # POST step the simulation
│       ├── reset/                # POST reset to seed
│       ├── metrics/              # GET aggregated metrics
│       ├── node/[id]/            # GET node detail / POST explain
│       ├── edge/[id]/            # PATCH edge (trustWeight)
│       └── farmer/[id]/          # PATCH farmer (adoptionRate)
│
├── features/                     # Feature modules — co-located UI + logic
│   ├── graph/
│   │   ├── components/           # GraphCanvas, NodePanel, Legend, custom nodes
│   │   └── lib/layout.ts         # snapshot → React Flow layout
│   ├── simulator/
│   │   └── components/           # SimulatorPanel, NarrativeBox, EventLog
│   └── metrics/
│       └── components/           # MetricsDashboard with 4 cards
│
├── components/                   # Shared UI primitives
│   ├── ui/                       # PillButton, Card, Badge
│   ├── illustrations/            # BlobCharacter, Coin, Star, Sprout (the brand)
│   └── layout/                   # NavBar, Footer
│
├── lib/                          # Framework-free libraries
│   ├── graph/
│   │   ├── types.ts              # Domain model — single source of truth
│   │   ├── seed.ts               # 3 experts · 15 farmers · 5 practices
│   │   ├── store.ts              # Server-side graph state (in-memory; swap for Neo4j)
│   │   └── metrics.ts            # Pure metric computations
│   ├── sim/
│   │   ├── engine.ts             # Spread propagation algorithm
│   │   └── rng.ts                # Deterministic Mulberry32 RNG
│   ├── integrations/
│   │   ├── featherless.ts        # LLM narrator (with deterministic fallback)
│   │   └── masumi.ts             # Agent registration + payments (with mock)
│   └── utils/cn.ts               # Tailwind class merger
│
├── stores/graphStore.ts          # Client-side Zustand store
└── styles/globals.css            # Tailwind v4 @theme + Family design tokens
```

### Why this layout

- **`app/` thin, `features/` thick.** Pages are one-or-two-line wrappers that compose feature modules. All domain logic lives in `features/` and `lib/`, where it can be tested without React.
- **`lib/` is framework-free.** No imports from `next/*`, `react`, or anything client-side. The simulation engine, metrics, and seed data are plain TypeScript — call them from a script, a test, or a future worker process.
- **Integration boundaries are single files.** `featherless.ts` and `masumi.ts` each export one stable API surface; the live/mock switch is internal. Replacing one is a single-file change.
- **Graph store is process-local in dev.** Pinned to `globalThis` so Next.js HMR doesn't reset it. Swap to Neo4j by reimplementing the four functions in `lib/graph/store.ts` — every consumer sees the same shape.

---

## The three screens

### Screen 1 — Graph canvas (`/graph`)
React Flow with custom node renderers (the Family blob characters). Nodes colored by type and adoption state; edges colored and weighted by relationship type. Click any node for properties + history + a one-click Featherless explainer.

### Screen 2 — Spread simulator (`/simulate`)
Big "Next round" button (or press `space`) runs one propagation step:

1. **Spread.** Pass 1 — direct ADVISES seeding. Pass 2 — trust-weighted relay along KNOWS edges.
2. **Trace.** Each new adoption walks back to its closest expert ancestor.
3. **Reward.** Masumi micro-payment fires for each traceable adoption — `base × 0.5^hops`.
4. **Narrate.** Featherless turns the round event log into one paragraph.

The narrative box, event log, and graph all update in lockstep.

### Screen 3 — Metrics (`/metrics`)
Four cards:
1. Practice adoption leaderboard
2. Expert reach (2-hop)
3. Deepest practice chain
4. Expert earnings (sum of Masumi rewards)

The earnings card is the proof that influence and value tracked together.

---

## The design system

Built around the **Family** style reference: warm cream canvas (`#fbfaf9`), inset stone borders on cards, near-black pill buttons as the only true contrast moment, and flat illustrated blob characters as the brand identity.

Tokens live in `src/styles/globals.css` under `@theme {}` and are auto-generated as Tailwind v4 utilities. See the comments in that file for the source-of-truth color/typography/spacing scale.

The illustration components in `src/components/illustrations/` are the real identity — characters use the brand palette (Ember, Meadow, Sky, Sunburst, Flamingo, Violet) and bob/spin/pulse via the keyframes defined alongside the tokens.

---

## Going live

### Neo4j
Replace `src/lib/graph/store.ts` with a Neo4j-backed implementation. The four exported functions (`getSnapshot`, `replaceSnapshot`, `resetSnapshot`, `patchEdge`, `patchFarmer`) define the contract.

A reference Cypher seed exists in `src/lib/graph/seed.ts` — translate the arrays into `CREATE` / `MERGE` statements once and you're live.

### Featherless
Set `FEATHERLESS_API_KEY` in `.env.local`. The narrator hits `https://api.featherless.ai/v1/chat/completions` with a small instruct model (default: Llama 3 8B Instruct). Failures fall back to the deterministic mock.

### Masumi
Set `MASUMI_MOCK=false` and provide `MASUMI_API_KEY` + `MASUMI_TREASURY_ID`. The integration registers each expert at first graph load and pays per rewarded adoption.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint the codebase |
| `npm run typecheck` | TypeScript noEmit check |
| `npm run format` | Prettier write |
| `npm test` | Vitest unit + integration suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Run with coverage thresholds enforced |
| `npm run test:e2e` | Playwright end-to-end suite |
| `npm run test:all` | typecheck + lint + unit + e2e (CI-equivalent) |

---

## Testing

A full test pyramid ships with the project — pure-logic units (with property-based tests on the engine and RNG), MSW-backed integration tests for the client store, route-handler tests for every API endpoint, RTL component tests for every primitive, and Playwright E2E specs for the three core user journeys.

See [TESTING.md](./TESTING.md) for the full strategy, conventions, and the layout of the suite.

```bash
npm test                  # ~5s — unit + integration
npm run test:coverage     # generates ./coverage/index.html
npm run test:e2e          # Playwright (boots dev server)
```
