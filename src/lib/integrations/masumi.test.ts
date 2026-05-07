import { describe, expect, it, beforeEach, vi } from "vitest";

async function freshClient() {
  vi.resetModules();
  vi.stubEnv("MASUMI_MOCK", "true");
  vi.stubEnv("MASUMI_API_KEY", "");
  return await import("./masumi");
}

describe("masumi — mock mode", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("registerAgent returns an agent with id, name, and timestamp", async () => {
    const masumi = await freshClient();
    const agent = await masumi.registerAgent("Dr. Test");
    expect(agent.name).toBe("Dr. Test");
    expect(agent.agentId).toMatch(/^agent_\d{4}_/);
    expect(typeof agent.registeredAt).toBe("string");
    expect(new Date(agent.registeredAt).toString()).not.toBe("Invalid Date");
  });

  it("registerAgent slugifies and truncates the agent name into the id", async () => {
    const masumi = await freshClient();
    const agent = await masumi.registerAgent("Margaret O'Hare-Smith, PhD");
    expect(agent.agentId).toMatch(/^agent_\d{4}_[a-z0-9]+/);
    // the slug is at most 8 chars
    const slug = agent.agentId.split("_").slice(2).join("_");
    expect(slug.length).toBeLessThanOrEqual(8);
  });

  it("registerAgent issues a fresh, monotonically increasing counter per call", async () => {
    const masumi = await freshClient();
    const a = await masumi.registerAgent("A");
    const b = await masumi.registerAgent("B");
    const counterA = Number(a.agentId.split("_")[1]);
    const counterB = Number(b.agentId.split("_")[1]);
    expect(counterB).toBe(counterA + 1);
  });

  it("pay returns a 64-character tx hash and echoes amount + recipient", async () => {
    const masumi = await freshClient();
    const payment = await masumi.pay("agent_x", 0.5);
    expect(payment.txHash).toHaveLength(64);
    expect(payment.amount).toBe(0.5);
    expect(payment.toAgentId).toBe("agent_x");
  });

  it("pay produces unique tx hashes across distinct calls", async () => {
    const masumi = await freshClient();
    const seen = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      const p = await masumi.pay(`agent_${i}`, 1);
      expect(seen.has(p.txHash)).toBe(false);
      seen.add(p.txHash);
    }
  });
});

describe("masumi — helpers", () => {
  it("explorerUrl uses the configured base by default", async () => {
    vi.stubEnv("MASUMI_EXPLORER_BASE", "");
    const masumi = await freshClient();
    expect(masumi.explorerUrl("0xabc")).toContain("/0xabc");
  });

  it("explorerUrl uses MASUMI_EXPLORER_BASE when set", async () => {
    vi.stubEnv("MASUMI_EXPLORER_BASE", "https://example.com/tx");
    const masumi = await freshClient();
    expect(masumi.explorerUrl("0xabc")).toBe("https://example.com/tx/0xabc");
  });

  it("shortenAgent abbreviates long IDs to 6…4 form", async () => {
    const masumi = await freshClient();
    expect(masumi.shortenAgent("agent_123456_wxyz")).toBe("agent_…wxyz");
  });

  it("shortenAgent returns short IDs unchanged", async () => {
    const masumi = await freshClient();
    expect(masumi.shortenAgent("short")).toBe("short");
  });

  it("shortenAgent returns '—' for null/undefined input", async () => {
    const masumi = await freshClient();
    expect(masumi.shortenAgent(null)).toBe("—");
    expect(masumi.shortenAgent(undefined)).toBe("—");
  });
});
