import { describe, it, expect } from "vitest";
import { initState, update, merge, DefaultConfig, confidences, stopCheck } from "../../services/weightedMean/scorer";
import type { UpdateInput } from "../../services/weightedMean/types";

function applyAll(inputs: UpdateInput[]) {
  let s = initState();
  for (const inp of inputs) {
    s = update(s, inp).state;
  }
  return s;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor((i + 1) * 9301.123) % (i + 1); // deterministic-ish
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

describe("WeightedMeanScorer – US1 order invariance", () => {
  it("permutation invariance over 1000 shuffles", () => {
    const base: UpdateInput[] = [
      { trait: "A", r: 0.5, w: 0.3 },
      { trait: "C", r: 0.7, w: 0.8 },
      { trait: "R", r: 0.2, w: 0.5 },
      { trait: "A", r: 0.9, w: 1.0 },
      { trait: "C", r: 0.1, w: 0.2 },
      { trait: "R", r: 0.6, w: 0.7 },
    ];

    const ref = applyAll(base);
    for (let k = 0; k < 1000; k++) {
      const s = applyAll(shuffle(base));
      expect(Math.abs(s.A.S - ref.A.S)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
      expect(Math.abs(s.C.S - ref.C.S)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
      expect(Math.abs(s.R.S - ref.R.S)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
      expect(Math.abs(s.A.W - ref.A.W)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
      expect(Math.abs(s.C.W - ref.C.W)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
      expect(Math.abs(s.R.W - ref.R.W)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
    }
  });

  it("merge equals batch", () => {
    const inputs: UpdateInput[] = [
      { trait: "A", r: 0.4, w: 0.5 },
      { trait: "C", r: 0.6, w: 0.7 },
      { trait: "R", r: 0.8, w: 0.9 },
      { trait: "A", r: 0.2, w: 0.3 },
      { trait: "C", r: 0.9, w: 1.0 },
      { trait: "R", r: 0.1, w: 0.4 },
    ];
    const half = Math.floor(inputs.length / 2);
    const s1 = applyAll(inputs.slice(0, half));
    const s2 = applyAll(inputs.slice(half));
    const merged = merge(s1, s2);
    const all = applyAll(inputs);

    expect(Math.abs(merged.A.S - all.A.S)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
    expect(Math.abs(merged.C.S - all.C.S)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
    expect(Math.abs(merged.R.S - all.R.S)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
    expect(Math.abs(merged.A.W - all.A.W)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
    expect(Math.abs(merged.C.W - all.C.W)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
    expect(Math.abs(merged.R.W - all.R.W)).toBeLessThanOrEqual(DefaultConfig.numericTolerance!);
  });
});

describe("WeightedMeanScorer – US2 confidence and gate", () => {
  it("confidence monotonicity for w>0; unchanged for w=0", () => {
    let s = initState();
    const c0 = confidences(s);
    // w=0 should not change confidence
    s = update(s, { trait: "A", r: 0.9, w: 0 }).state;
    const c1 = confidences(s);
    expect(c1.A).toBe(c0.A);

    // positive weights should increase confidence
    s = update(s, { trait: "A", r: 0.5, w: 0.2 }).state;
    const c2 = confidences(s);
    expect(c2.A).toBeGreaterThan(c1.A);

    s = update(s, { trait: "A", r: 0.5, w: 0.3 }).state;
    const c3 = confidences(s);
    expect(c3.A).toBeGreaterThan(c2.A);
  });

  it("gate flips at most once when conf≥τ and coverage true with n≥2", () => {
    // Use cfg with c=1 so after two updates with total W=1.0, conf=W/(W+c)=0.5 meets τ
    const τ = 0.5;
    const cfg = { tau: τ, c: 1 } as const;
    let s = initState();
    let ready = stopCheck(s, { A: true, C: true, R: true }, cfg);
    expect(ready).toBe(false);

    // build evidence for all traits
    s = update(s, { trait: "A", r: 0.8, w: 0.5 }).state;
    s = update(s, { trait: "C", r: 0.6, w: 0.5 }).state;
    s = update(s, { trait: "R", r: 0.7, w: 0.5 }).state;
    ready = stopCheck(s, { A: true, C: true, R: true }, cfg);
    // n is 1 for each -> still false due to n≥2
    expect(ready).toBe(false);

    // second round to meet n≥2 and push conf above τ
    s = update(s, { trait: "A", r: 0.8, w: 0.5 }).state;
    s = update(s, { trait: "C", r: 0.7, w: 0.5 }).state;
    s = update(s, { trait: "R", r: 0.6, w: 0.5 }).state;
    const ready2 = stopCheck(s, { A: true, C: true, R: true }, cfg);
    expect(ready2).toBe(true);

    // further updates keep it true (no second flip)
    s = update(s, { trait: "A", r: 0.1, w: 0 }).state; // w=0 shouldn't affect
    const ready3 = stopCheck(s, { A: true, C: true, R: true }, cfg);
    expect(ready3).toBe(true);
  });
});

describe("WeightedMeanScorer – US3 debug snapshot", () => {
  it("single update snapshot matches recompute and invariants hold", () => {
    let s = initState();
    const before = s.A;
    const { state: after, snapshot } = update(s, { trait: "A", r: 0.8, w: 0.6 });
    const expectedW = before.W + 0.6;
    const expectedS = expectedW > 0 ? (before.W * before.S + 0.6 * 0.8) / expectedW : DefaultConfig.initialScore;

    expect(snapshot.W_after).toBeCloseTo(expectedW, 12);
    expect(snapshot.S_after).toBeCloseTo(expectedS, 12);
    expect(snapshot.S_before).toBeCloseTo(before.S, 12);
    expect(snapshot.W_before).toBeCloseTo(before.W, 12);
    expect(Number.isInteger(snapshot.n_after)).toBe(true);
    expect(snapshot.S_after).toBeGreaterThanOrEqual(0);
    expect(snapshot.S_after).toBeLessThanOrEqual(1);
    expect(snapshot.W_after).toBeGreaterThanOrEqual(snapshot.W_before);
  });
});


