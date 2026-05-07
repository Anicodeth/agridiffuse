import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { createRng } from "./rng";

describe("createRng (Mulberry32)", () => {
  it("returns a function that produces values in [0, 1)", () => {
    const rng = createRng(42);
    for (let i = 0; i < 100; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("is deterministic given the same seed", () => {
    const a = createRng(123);
    const b = createRng(123);
    const sequenceA = Array.from({ length: 20 }, () => a());
    const sequenceB = Array.from({ length: 20 }, () => b());
    expect(sequenceA).toEqual(sequenceB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toEqual(b());
  });

  it("[property] never returns NaN or Infinity, regardless of seed", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const rng = createRng(seed);
        for (let i = 0; i < 50; i += 1) {
          const v = rng();
          if (Number.isNaN(v) || !Number.isFinite(v)) return false;
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("[property] all draws stay in [0, 1) for arbitrary seeds", () => {
    fc.assert(
      fc.property(fc.integer({ min: -(2 ** 30), max: 2 ** 30 }), (seed) => {
        const rng = createRng(seed);
        for (let i = 0; i < 30; i += 1) {
          const v = rng();
          if (v < 0 || v >= 1) return false;
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });

  it("has reasonable distribution — mean of 1000 draws is near 0.5", () => {
    const rng = createRng(7);
    let sum = 0;
    const N = 1000;
    for (let i = 0; i < N; i += 1) sum += rng();
    const mean = sum / N;
    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
  });

  it("handles seed = 0 without locking up", () => {
    const rng = createRng(0);
    const a = rng();
    const b = rng();
    expect(a).not.toBe(b);
  });
});
