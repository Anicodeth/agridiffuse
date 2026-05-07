import { describe, expect, it, beforeEach, vi } from "vitest";
import { narrateRound, explainNode } from "./featherless";
import type { RoundResult } from "@/lib/graph/types";

const baseResult = (override: Partial<RoundResult> = {}): RoundResult => ({
  round: 3,
  events: [],
  newAdoptions: 0,
  blockedAttempts: 0,
  totalRewardDistributed: 0,
  topExpertId: null,
  deepestChainLength: 0,
  narrative: "",
  ...override,
});

const namesCtx = {
  expertNameById: { e_a: "Dr. Test" },
  farmerNameById: { f1: "Wanjiru", f2: "Kamau" },
  practiceNameById: { p1: "Drip irrigation" },
};

describe("featherless — mock fallback (no API key)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("FEATHERLESS_API_KEY", "");
  });

  it("narrateRound returns the 'still' message when no adoptions occurred", async () => {
    const text = await narrateRound({ result: baseResult({ newAdoptions: 0 }), ...namesCtx });
    expect(text).toMatch(/network sat still/i);
    expect(text).toContain("Round 3");
  });

  it("narrateRound names specific farmers and practices when adoptions happened", async () => {
    const text = await narrateRound({
      result: baseResult({
        newAdoptions: 2,
        events: [
          {
            kind: "adopted",
            farmerId: "f1",
            practiceId: "p1",
            via: "advises",
            sourceId: "e_a",
            hopsFromExpert: 0,
            expertAncestorId: "e_a",
          },
          {
            kind: "adopted",
            farmerId: "f2",
            practiceId: "p1",
            via: "relay",
            sourceId: "f1",
            hopsFromExpert: 1,
            expertAncestorId: "e_a",
          },
        ],
        topExpertId: "e_a",
        totalRewardDistributed: 0.75,
      }),
      ...namesCtx,
    });
    expect(text).toContain("Wanjiru");
    expect(text).toContain("Drip irrigation");
    expect(text).toContain("Dr. Test");
    expect(text).toContain("0.75");
  });

  it("narrateRound mentions blocked attempts when present", async () => {
    const text = await narrateRound({
      result: baseResult({
        newAdoptions: 1,
        blockedAttempts: 4,
        events: [
          {
            kind: "adopted",
            farmerId: "f1",
            practiceId: "p1",
            via: "advises",
            sourceId: "e_a",
            hopsFromExpert: 0,
            expertAncestorId: "e_a",
          },
        ],
      }),
      ...namesCtx,
    });
    expect(text).toMatch(/4 attempts? stalled/i);
  });

  it("explainNode returns expert-shaped text for an expert", async () => {
    const text = await explainNode({
      nodeType: "expert",
      properties: { name: "Dr. Test", domain: "Soil", credibilityScore: 0.9 },
      neighbors: [{ relation: "ADVISES", name: "Farmer A" }],
    });
    expect(text).toContain("Dr. Test");
    expect(text).toContain("Soil");
  });

  it("explainNode returns farmer-shaped text for a farmer", async () => {
    const text = await explainNode({
      nodeType: "farmer",
      properties: { name: "Wanjiru", farmSize: 2.5, region: "Nyeri", adoptionRate: 0.7 },
      neighbors: [{ relation: "KNOWS", name: "Kamau" }],
    });
    expect(text).toContain("Wanjiru");
    expect(text).toContain("Nyeri");
  });

  it("explainNode returns practice-shaped text for a practice", async () => {
    const text = await explainNode({
      nodeType: "practice",
      properties: { name: "Drip irrigation", category: "water", evidenceLevel: "high" },
      neighbors: [],
    });
    expect(text).toContain("Drip irrigation");
    expect(text).toContain("water");
  });
});

describe("featherless — live API path (mocked fetch)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("FEATHERLESS_API_KEY", "test-key");
  });

  it("narrateRound calls the Featherless endpoint with the model and bearer key", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "A great round, indeed." } }],
        }),
        { status: 200 },
      ),
    );

    const text = await narrateRound({ result: baseResult({ newAdoptions: 1 }), ...namesCtx });
    expect(text).toBe("A great round, indeed.");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("featherless.ai");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
  });

  it("narrateRound falls back to the mock on non-OK response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    const text = await narrateRound({ result: baseResult({ newAdoptions: 0 }), ...namesCtx });
    expect(text).toMatch(/Round 3/);
  });

  it("narrateRound falls back to the mock on network error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    const text = await narrateRound({ result: baseResult({ newAdoptions: 0 }), ...namesCtx });
    expect(text).toMatch(/Round 3/);
  });
});
