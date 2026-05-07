import type { RoundResult } from "@/lib/graph/types";

/**
 * Featherless.ai serverless inference client.
 *
 * One call per round (the round narrator). The node-explainer prompt is the
 * second prompt — see explainNode().
 *
 * Falls back to a deterministic local mock when FEATHERLESS_API_KEY is unset,
 * so demos work offline. The mock matches the same JSON contract.
 */

const FEATHERLESS_URL = "https://api.featherless.ai/v1/chat/completions";

interface NarrateContext {
  result: RoundResult;
  expertNameById: Record<string, string>;
  farmerNameById: Record<string, string>;
  practiceNameById: Record<string, string>;
}

export async function narrateRound(ctx: NarrateContext): Promise<string> {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  const model = process.env.FEATHERLESS_MODEL ?? "mistralai/Mistral-7B-Instruct-v0.3";

  if (!apiKey) {
    return mockNarrate(ctx);
  }

  const prompt = buildNarratorPrompt(ctx);

  try {
    const response = await fetch(FEATHERLESS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are narrating an agricultural knowledge-spread simulation. Given structured round events, produce ONE paragraph (2–3 sentences) describing what happened in plain language. Mention specific farmer/expert names when notable. Keep it factual, no embellishment.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 180,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      console.warn(`[featherless] ${response.status} ${response.statusText} — falling back to mock`);
      return mockNarrate(ctx);
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? mockNarrate(ctx);
  } catch (err) {
    console.warn("[featherless] error — falling back to mock", err);
    return mockNarrate(ctx);
  }
}

interface ExplainContext {
  nodeType: "expert" | "farmer" | "practice";
  properties: Record<string, unknown>;
  neighbors: Array<{ relation: string; name: string }>;
}

export async function explainNode(ctx: ExplainContext): Promise<string> {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  const model = process.env.FEATHERLESS_MODEL ?? "mistralai/Mistral-7B-Instruct-v0.3";

  if (!apiKey) {
    return mockExplain(ctx);
  }

  try {
    const response = await fetch(FEATHERLESS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "Describe this node in 2 sentences for a non-technical viewer.",
          },
          { role: "user", content: JSON.stringify(ctx) },
        ],
        max_tokens: 120,
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return mockExplain(ctx);
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? mockExplain(ctx);
  } catch {
    return mockExplain(ctx);
  }
}

// ── Prompt builder ────────────────────────────────────────────────

function buildNarratorPrompt(ctx: NarrateContext): string {
  const { result, expertNameById, farmerNameById, practiceNameById } = ctx;
  const adopted = result.events.filter((e) => e.kind === "adopted");
  const blocked = result.events.filter((e) => e.kind === "blocked");
  const rewarded = result.events.filter((e) => e.kind === "rewarded");

  const summary = {
    round: result.round,
    new_adoptions: adopted.map((e) =>
      e.kind === "adopted"
        ? {
            farmer: farmerNameById[e.farmerId] ?? e.farmerId,
            practice: practiceNameById[e.practiceId] ?? e.practiceId,
            via: e.via,
            from:
              e.via === "advises"
                ? expertNameById[e.sourceId] ?? e.sourceId
                : farmerNameById[e.sourceId] ?? e.sourceId,
            hops: e.hopsFromExpert,
          }
        : null,
    ),
    blocked: blocked.length,
    rewards_distributed: result.totalRewardDistributed,
    top_expert: result.topExpertId ? expertNameById[result.topExpertId] : null,
    deepest_chain: result.deepestChainLength,
  };

  return `Round event log: ${JSON.stringify(summary, null, 2)}\n\nWrite the narration paragraph now.`;
}

// ── Mock fallbacks (deterministic, on-brand) ──────────────────────

function mockNarrate(ctx: NarrateContext): string {
  const { result, expertNameById, farmerNameById, practiceNameById } = ctx;
  const adopted = result.events.filter((e) => e.kind === "adopted");
  if (adopted.length === 0) {
    return `Round ${result.round}: the network sat still — every advice attempt this round was blocked by low trust or skeptical adopters. No new practices took root.`;
  }
  const named = adopted
    .slice(0, 3)
    .map((e) =>
      e.kind === "adopted"
        ? `${farmerNameById[e.farmerId] ?? "someone"} picked up ${practiceNameById[e.practiceId] ?? "a practice"}`
        : "",
    )
    .filter(Boolean);
  const topExpert = result.topExpertId ? (expertNameById[result.topExpertId] ?? "an expert") : null;
  const trail = topExpert
    ? ` ${topExpert}'s recommendations carried the round, with ${result.totalRewardDistributed.toFixed(2)} tADA flowing back along the chain.`
    : ` Peer relays did the work — no expert reward was triggered.`;
  return `Round ${result.round}: ${named.join(", ")}.${trail}${
    result.blockedAttempts ? ` ${result.blockedAttempts} attempts stalled at weak ties.` : ""
  }`;
}

function mockExplain(ctx: ExplainContext): string {
  const { nodeType, properties, neighbors } = ctx;
  const name = (properties.name as string) ?? "This node";
  if (nodeType === "expert") {
    return `${name} is an agricultural expert specializing in ${properties.domain ?? "field work"}, with a credibility score of ${properties.credibilityScore}. They've connected with ${neighbors.length} people in this network.`;
  }
  if (nodeType === "farmer") {
    return `${name} farms ${properties.farmSize ?? "a plot"} hectares in ${properties.region ?? "the region"} with an adoption tendency of ${properties.adoptionRate}. They're tied to ${neighbors.length} neighbors in the trust network.`;
  }
  return `${name} is a ${(properties.category as string) ?? "general"} practice with ${properties.evidenceLevel ?? "some"} evidence behind it.`;
}
