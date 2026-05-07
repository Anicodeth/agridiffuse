# Testing

AgriDiffuse ships with a layered test suite tuned for learning — every layer of the system is covered by tests at the appropriate level of abstraction, with deterministic fixtures and clean separation between unit, integration, and end-to-end tests.

## Test pyramid

```
                  ┌────────────────────┐
                  │  Playwright E2E    │   tests/e2e/*.spec.ts
                  │  (4 specs)         │   ~ user journeys
                  └─────────▲──────────┘
                            │
                  ┌─────────┴──────────┐
                  │  Component / RTL   │   *.test.tsx in src/
                  │  (8+ files)        │   ~ DOM, props, interaction
                  └─────────▲──────────┘
                            │
                  ┌─────────┴──────────┐
                  │  Integration       │   stores, API routes (Vitest, MSW)
                  │  (10+ files)       │   ~ behavior across modules
                  └─────────▲──────────┘
                            │
                  ┌─────────┴──────────┐
                  │  Pure unit         │   lib/, fixtures/, utils
                  │  (50+ tests)       │   ~ deterministic, fast
                  └────────────────────┘
```

## Stack

| Layer | Tool |
|---|---|
| Test runner | **Vitest 2** — fast, ESM-native, plays nicely with Next 15 + TypeScript |
| Component DOM | **happy-dom** — significantly faster than jsdom |
| Component testing | **@testing-library/react** + `@testing-library/user-event` |
| Network mocking | **MSW 2** (node) — intercepts `fetch` in store + route tests |
| Property-based | **fast-check** — invariants on the spread engine and RNG |
| E2E | **Playwright** (Chromium) — boots `next dev` against the in-memory store |
| Coverage | **@vitest/coverage-v8** — line/branch/function thresholds enforced |

## Running tests

```bash
# Unit + integration (fast — runs in <5s once node_modules is warm)
npm test
npm run test:watch          # interactive watch mode
npm run test:ui             # vitest UI

# Coverage report (HTML in ./coverage/index.html)
npm run test:coverage

# E2E (boots a dev server, ~30s cold start)
npm run playwright:install  # one-time
npm run test:e2e
npm run test:e2e:ui         # Playwright UI mode

# Everything (typecheck + lint + unit + e2e)
npm run test:all
```

## Coverage targets

| Scope | Target | Where |
|---|---|---|
| `lib/sim/`, `lib/graph/`, `lib/integrations/` | **95%+** lines, branches | enforced via vitest coverage |
| Stores, API routes | **90%+** | enforced via vitest coverage |
| UI primitives (`components/ui`) | **80%+** | enforced via vitest coverage |
| Page shells (`app/**/page.tsx`) | excluded | covered by E2E |
| Live integration code paths | excluded | covered by integration tests on the live env |

Global thresholds in `vitest.config.ts` are set to 80/75/80/80 (lines/branches/functions/statements). Per-file enforcement is opt-in for the load-bearing pure-logic modules.

## Test layout

Tests are co-located next to the source file, following the Google internal convention. E2E specs live separately because they need a live server.

```
src/lib/sim/engine.ts
src/lib/sim/engine.test.ts          ← unit tests next to source
src/components/ui/PillButton.tsx
src/components/ui/PillButton.test.tsx
src/app/api/round/route.ts
src/app/api/round/route.test.ts     ← API route handler tests

tests/
├── fixtures/graph.ts               ← reusable graph builders
├── msw/
│   ├── handlers.ts                 ← default API mocks for store tests
│   └── server.ts                   ← MSW server setup
├── vitest.setup.ts                 ← global setup (RTL cleanup, polyfills)
└── e2e/
    ├── landing.spec.ts
    ├── graph-canvas.spec.ts
    ├── spread-simulation.spec.ts
    └── metrics.spec.ts
```

## Conventions

### Determinism
Every test that exercises randomness passes an explicit seed. The simulation engine accepts `runRound(snapshot, { seed: 123 })` so a test can pin behavior. Tests that need varied outcomes (e.g. "blocking is more likely on low-trust ties") run a small Monte Carlo over many seeds and assert on aggregate statistics, not single-run outcomes.

### Fixtures over re-construction
Anything that takes more than a line to set up gets a fixture builder (`tests/fixtures/graph.ts`). Each builder takes a partial override and returns a fully-formed object. Tests then look like:

```ts
const snap = fx.snapshot({
  edges: [fx.advises({ source: "e1", target: "f1" })],
});
```

…which reads as a story rather than a database setup.

### One reason to fail per test
Each test name describes one observable behavior. If a test would fail for two unrelated reasons, split it.

### Property-based tests where they help
Used sparingly — for the RNG (always in `[0, 1)`, never NaN) and the engine (adoption count never negative, edges only grow). Property tests catch corner cases that example-based tests miss.

### Mocks at boundaries
- **MSW** for fetch in store + browser-targeted tests
- **Mock mode** flags (`MASUMI_MOCK=true`, blank `FEATHERLESS_API_KEY`) for integration tests — exercises the real fallback path the demo uses
- **`vi.spyOn(global, "fetch")`** for live-API code paths in `featherless.test.ts`

## CI integration

`npm run test:all` is the single command for CI. It runs:

1. `tsc --noEmit` — type safety
2. `next lint` — code quality
3. `vitest run --coverage` — unit + integration with coverage thresholds
4. `playwright test` — E2E

Failures at any step abort the build. Coverage HTML and Playwright reports are uploaded as artifacts.

## Adding a new test

1. **Logic change** → add a `*.test.ts` next to the source. Use existing fixtures.
2. **New API route** → add a `route.test.ts` next to the route handler. Use the in-memory store reset pattern (delete `Symbol.for("agridiffuse.graphStore.v2")` in `beforeEach`).
3. **New component** → add a `*.test.tsx` next to the component. Test behavior, not implementation (prefer `getByRole` and `getByText` over `data-testid`).
4. **New user flow** → add a `tests/e2e/*.spec.ts`. Always reset the in-memory graph via `request.post("/api/reset")` in `beforeEach`.
