import { http, HttpResponse } from "msw";
import * as fx from "../fixtures/graph";
import type { GraphSnapshot, RoundResult } from "@/lib/graph/types";

/**
 * Default MSW handlers for the AgriDiffuse API surface. Each test that needs
 * a different response can override individual routes with `server.use(...)`.
 */

let snapshot: GraphSnapshot = fx.snapshot();
let nextRoundId = 1;

export function resetMswState() {
  snapshot = fx.snapshot();
  nextRoundId = 1;
}

export const handlers = [
  http.get("/api/graph", () => HttpResponse.json(snapshot)),

  http.post("/api/round", () => {
    snapshot = { ...snapshot, round: snapshot.round + 1 };
    const result: RoundResult = {
      round: snapshot.round,
      events: [
        {
          kind: "adopted",
          farmerId: "f_seed",
          practiceId: "p_one",
          via: "advises",
          sourceId: "e_a",
          hopsFromExpert: 0,
          expertAncestorId: "e_a",
        },
      ],
      newAdoptions: 1,
      blockedAttempts: 0,
      totalRewardDistributed: 1,
      topExpertId: "e_a",
      deepestChainLength: 1,
      narrative: `Round ${nextRoundId++}: a test adoption took root.`,
    };
    return HttpResponse.json({ snapshot, result });
  }),

  http.post("/api/reset", () => {
    resetMswState();
    return HttpResponse.json(snapshot);
  }),

  http.patch("/api/edge/:id", async ({ request }) => {
    const body = (await request.json()) as { trustWeight?: number };
    snapshot = {
      ...snapshot,
      edges: snapshot.edges.map((e) =>
        e.type === "KNOWS" && body.trustWeight !== undefined ? { ...e, trustWeight: body.trustWeight } : e,
      ),
    };
    return HttpResponse.json(snapshot);
  }),

  http.patch("/api/farmer/:id", async ({ params, request }) => {
    const body = (await request.json()) as { adoptionRate?: number };
    snapshot = {
      ...snapshot,
      nodes: snapshot.nodes.map((n) =>
        n.id === params.id && n.type === "farmer" && body.adoptionRate !== undefined
          ? { ...n, adoptionRate: body.adoptionRate }
          : n,
      ),
    };
    return HttpResponse.json(snapshot);
  }),
];
