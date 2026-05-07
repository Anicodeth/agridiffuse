/**
 * Masumi.network agent-economy client.
 *
 * Three touchpoints:
 *   1. registerAgent(name) — at seed, to assign each Expert a verifiable agent_id.
 *   2. pay(treasury → agent_id, amount) — on each rewarded adoption.
 *   3. explorerUrl(tx) — for the side panel & earnings card linkout.
 *
 * MASUMI_MOCK=true keeps the demo running without network calls. The mock is
 * deterministic so test runs are reproducible.
 */

const isMock = (): boolean => process.env.MASUMI_MOCK === "true" || !process.env.MASUMI_API_KEY;

const apiBase = (): string =>
  process.env.MASUMI_API_BASE ?? "https://api.masumi.network/v1";

const explorerBase = (): string =>
  process.env.MASUMI_EXPLORER_BASE ?? "https://preprod.cardanoscan.io/transaction";

let mockAgentCounter = 0;
let mockTxCounter = 0;

export interface MasumiAgent {
  agentId: string;
  name: string;
  registeredAt: string;
}

export interface MasumiPayment {
  txHash: string;
  amount: number;
  toAgentId: string;
  timestamp: string;
}

// ── Public API ────────────────────────────────────────────────────

export async function registerAgent(name: string): Promise<MasumiAgent> {
  if (isMock()) {
    mockAgentCounter += 1;
    const agentId = `agent_${mockAgentCounter.toString().padStart(4, "0")}_${slug(name)}`;
    return { agentId, name, registeredAt: new Date().toISOString() };
  }
  // Live — kept thin and replaceable.
  const response = await fetch(`${apiBase()}/agents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MASUMI_API_KEY}`,
    },
    body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Masumi register failed: ${response.status}`);
  return (await response.json()) as MasumiAgent;
}

export async function pay(
  toAgentId: string,
  amount: number,
  meta?: Record<string, string | number>,
): Promise<MasumiPayment> {
  if (isMock()) {
    mockTxCounter += 1;
    return {
      txHash: mockTxHash(toAgentId, amount, mockTxCounter),
      amount,
      toAgentId,
      timestamp: new Date().toISOString(),
    };
  }
  const response = await fetch(`${apiBase()}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MASUMI_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.MASUMI_TREASURY_ID,
      to: toAgentId,
      amount,
      meta,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Masumi pay failed: ${response.status}`);
  return (await response.json()) as MasumiPayment;
}

export function explorerUrl(txHash: string): string {
  return `${explorerBase()}/${txHash}`;
}

export function shortenAgent(agentId: string | null | undefined): string {
  if (!agentId) return "—";
  if (agentId.length <= 12) return agentId;
  return `${agentId.slice(0, 6)}…${agentId.slice(-4)}`;
}

// ── Helpers ───────────────────────────────────────────────────────

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8);
}

function mockTxHash(agentId: string, amount: number, n: number): string {
  // Deterministic 64-hex-ish string for the demo. Not a real hash. The
  // counter `n` makes each call unique even with the same agent/amount, and
  // we fold the input through a djb2-style hash repeatedly to fill 64 chars.
  const input = `${agentId}:${amount}:${n}`;
  let h = 5381 >>> 0;
  for (let i = 0; i < input.length; i += 1) h = ((h * 33) ^ input.charCodeAt(i)) >>> 0;
  let out = "";
  while (out.length < 64) {
    h = ((h * 33) ^ out.length) >>> 0;
    out += h.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}
