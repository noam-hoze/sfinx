import { InvalidInputError } from "./errors";
import type {
  AllTraitState,
  Config,
  Snapshot,
  TraitKey,
  UpdateInput,
  CoverageStatus,
} from "./types";

export const DefaultConfig: Config = {
  wMax: 1.0,
  c: 2,
  tau: 0.75,
  initialScore: 0.5,
  numericTolerance: 1e-12,
};

function assertFinite(x: number, label: string) {
  if (!Number.isFinite(x)) throw new InvalidInputError(`${label} must be finite`);
}

function clip01(x: number, label?: string): number {
  if (x === undefined || Number.isNaN(x)) throw new InvalidInputError(`${label ?? "value"} is NaN/undefined`);
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Compose and cap a single-sample weight.
 * w = min( clip(d)*clip(q)*((clip(w_ind)+clip(w_rec))/2), w_max )
 */
export function computeWeight(
  d: number,
  q: number,
  w_ind: number,
  w_rec: number,
  w_max: number = DefaultConfig.wMax
): number {
  const dC = clip01(d, "d");
  const qC = clip01(q, "q");
  const wi = clip01(w_ind, "w_ind");
  const wr = clip01(w_rec, "w_rec");
  const composed = dC * qC * ((wi + wr) / 2);
  const w = Math.min(Math.max(0, composed), w_max);
  assertFinite(w, "w");
  return w;
}

/** Initialize scorer state per trait using config.initialScore and zero evidence. */
export function initState(cfg: Partial<Config> = {}): AllTraitState {
  const c = { ...DefaultConfig, ...cfg };
  const make = () => ({ S: c.initialScore, W: 0, n: 0 });
  return { A: make(), C: make(), R: make() };
}

/** Reset returns a fresh initial state. */
export function reset(cfg: Partial<Config> = {}): AllTraitState {
  return initState(cfg);
}

/**
 * Update a single trait with rating r∈[0,1] and effective weight w∈[0,wMax].
 * Returns next state and a debug snapshot.
 */
export function update(
  state: AllTraitState,
  input: UpdateInput,
  cfg: Partial<Config> = {}
): { state: AllTraitState; snapshot: Snapshot } {
  const c = { ...DefaultConfig, ...cfg };
  const trait = input.trait;
  const prev = state[trait];
  const r = clip01(input.r, "r");
  const wRaw = input.w;
  if (wRaw === undefined || Number.isNaN(wRaw)) throw new InvalidInputError("w is NaN/undefined");
  const w = Math.min(Math.max(0, wRaw), c.wMax);

  // Skip if no effective weight
  if (w === 0) {
    const snapshot: Snapshot = {
      trait,
      r,
      w,
      S_before: prev.S,
      W_before: prev.W,
      S_after: prev.S,
      W_after: prev.W,
      n_after: prev.n,
    };
    return { state, snapshot };
  }

  const S_before = prev.S;
  const W_before = prev.W;

  const W_after = W_before + w;
  const S_after = W_after > 0 ? (W_before * S_before + w * r) / W_after : c.initialScore;

  const next: AllTraitState = {
    ...state,
    [trait]: { S: S_after, W: W_after, n: prev.n + 1 },
  };

  const snapshot: Snapshot = {
    trait,
    r,
    w,
    S_before,
    W_before,
    S_after,
    W_after,
    n_after: prev.n + 1,
  };

  return { state: next, snapshot };
}

/** Merge two states (commutative/associative) per trait. */
export function merge(a: AllTraitState, b: AllTraitState, cfg: Partial<Config> = {}): AllTraitState {
  const c = { ...DefaultConfig, ...cfg };
  const combine = (t: TraitKey): { S: number; W: number; n: number } => {
    const A = a[t];
    const B = b[t];
    const W = A.W + B.W;
    const S = W > 0 ? (A.W * A.S + B.W * B.S) / W : c.initialScore;
    const n = A.n + B.n;
    return { S, W, n };
  };
  return { A: combine("A"), C: combine("C"), R: combine("R") };
}

/** Confidence per trait: W/(W+c). */
export function confidences(state: AllTraitState, cfg: Partial<Config> = {}): Record<TraitKey, number> {
  const c = { ...DefaultConfig, ...cfg };
  const conf = (W: number) => W / (W + c.c);
  return { A: conf(state.A.W), C: conf(state.C.W), R: conf(state.R.W) };
}

/** Stop rule: ready iff coverage∧n≥2∧conf≥τ for all traits. */
export function stopCheck(
  state: AllTraitState,
  coverage: CoverageStatus,
  cfg: Partial<Config> = {}
): boolean {
  const c = { ...DefaultConfig, ...cfg };
  const conf = confidences(state, c);
  const ok = (k: TraitKey) => coverage[k] && state[k].n >= 1 && conf[k] >= c.tau;
  return ok("A") && ok("C") && ok("R");
}


