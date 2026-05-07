/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server, resetMswState } from "../../tests/msw/server";
import { useGraphStore } from "./graphStore";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  // Reset store between tests by calling reset and clearing mock state.
  useGraphStore.setState({
    snapshot: null,
    lastResult: null,
    isLoading: false,
    isRunning: false,
    error: null,
    selectedNodeId: null,
  });
  resetMswState();
});

describe("graphStore.load", () => {
  it("populates snapshot on success", async () => {
    await useGraphStore.getState().load();
    const state = useGraphStore.getState();
    expect(state.snapshot).not.toBeNull();
    expect(state.snapshot?.nodes.length).toBeGreaterThan(0);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("captures error on non-OK response", async () => {
    server.use(http.get("/api/graph", () => HttpResponse.text("nope", { status: 500 })));
    await useGraphStore.getState().load();
    const state = useGraphStore.getState();
    expect(state.error).toMatch(/Graph load failed/);
    expect(state.snapshot).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it("captures error on network failure", async () => {
    server.use(http.get("/api/graph", () => HttpResponse.error()));
    await useGraphStore.getState().load();
    expect(useGraphStore.getState().error).toBeTruthy();
  });
});

describe("graphStore.runRound", () => {
  it("advances the snapshot's round and stores the round result", async () => {
    await useGraphStore.getState().load();
    const before = useGraphStore.getState().snapshot?.round ?? 0;

    await useGraphStore.getState().runRound();

    const state = useGraphStore.getState();
    expect(state.snapshot?.round).toBe(before + 1);
    expect(state.lastResult?.round).toBe(before + 1);
    expect(state.lastResult?.narrative).toMatch(/Round 1/);
    expect(state.isRunning).toBe(false);
  });

  it("clears running state on error", async () => {
    server.use(http.post("/api/round", () => HttpResponse.text("nope", { status: 500 })));
    await useGraphStore.getState().runRound();
    const state = useGraphStore.getState();
    expect(state.error).toMatch(/Round failed/);
    expect(state.isRunning).toBe(false);
  });

  it("ignores re-entrant calls while a round is running", async () => {
    let resolve: (value: Response) => void = () => {};
    server.use(
      http.post("/api/round", async () => {
        return new Promise<Response>((res) => {
          resolve = res;
        });
      }),
    );
    const p1 = useGraphStore.getState().runRound();
    const p2 = useGraphStore.getState().runRound();
    expect(useGraphStore.getState().isRunning).toBe(true);
    resolve(
      HttpResponse.json({
        snapshot: { round: 1, nodes: [], edges: [] },
        result: {
          round: 1,
          events: [],
          newAdoptions: 0,
          blockedAttempts: 0,
          totalRewardDistributed: 0,
          topExpertId: null,
          deepestChainLength: 0,
          narrative: "ok",
        },
      }),
    );
    await Promise.all([p1, p2]);
    expect(useGraphStore.getState().isRunning).toBe(false);
  });
});

describe("graphStore.reset", () => {
  it("re-fetches the seed snapshot and clears lastResult", async () => {
    await useGraphStore.getState().load();
    await useGraphStore.getState().runRound();
    expect(useGraphStore.getState().lastResult).not.toBeNull();

    await useGraphStore.getState().reset();
    const state = useGraphStore.getState();
    expect(state.lastResult).toBeNull();
    expect(state.snapshot?.round).toBe(0);
    expect(state.selectedNodeId).toBeNull();
  });
});

describe("graphStore.selectNode", () => {
  it("sets the selectedNodeId", () => {
    useGraphStore.getState().selectNode("e_a");
    expect(useGraphStore.getState().selectedNodeId).toBe("e_a");
  });

  it("clears selection when given null", () => {
    useGraphStore.getState().selectNode("f_seed");
    useGraphStore.getState().selectNode(null);
    expect(useGraphStore.getState().selectedNodeId).toBeNull();
  });
});

describe("graphStore.patchEdge / patchFarmer", () => {
  it("patchEdge updates the snapshot from the server response", async () => {
    await useGraphStore.getState().load();
    await useGraphStore.getState().patchEdge("k_seed_high", { trustWeight: 0.42 });
    const edge = useGraphStore
      .getState()
      .snapshot?.edges.find((e) => e.id === "k_seed_high");
    expect(edge && edge.type === "KNOWS" && edge.trustWeight).toBe(0.42);
  });

  it("patchFarmer updates the snapshot from the server response", async () => {
    await useGraphStore.getState().load();
    await useGraphStore.getState().patchFarmer("f_low", { adoptionRate: 0.05 });
    const node = useGraphStore.getState().snapshot?.nodes.find((n) => n.id === "f_low");
    expect(node && node.type === "farmer" && node.adoptionRate).toBe(0.05);
  });
});
