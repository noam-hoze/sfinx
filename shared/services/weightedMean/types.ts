/** Letter keys for traits: A=Adaptability, C=Creativity, R=Reasoning. */
export type TraitKey = "A" | "C" | "R";

/** Per-trait cumulative state. */
export interface TraitState {
  S: number; // weighted mean in [0,1]
  W: number; // cumulative weight (evidence mass)
  n: number; // number of accepted samples
}

/** State for all traits. */
export type AllTraitState = Record<TraitKey, TraitState>;

/** Runtime config controlling weights, confidence, and thresholds. */
export interface Config {
  wMax: number; // cap for single-sample weight
  c: number; // confidence shape parameter
  tau: number; // stop rule threshold
  initialScore: number; // neutral score when W==0
  numericTolerance?: number; // tests/validation tolerance
}

/** Evidence coverage flags per trait for the stop rule. */
export interface CoverageStatus {
  A: boolean;
  C: boolean;
  R: boolean;
}

/** Debug snapshot emitted by update(). */
export interface Snapshot {
  trait: TraitKey;
  r: number; // incoming rating clipped to [0,1]
  w: number; // effective weight after composition and caps
  S_before: number;
  W_before: number;
  S_after: number;
  W_after: number;
  n_after: number;
}

export interface UpdateInput {
  trait: TraitKey;
  r: number; // raw rating (will be clipped)
  w: number; // raw weight (will be composed/capped externally if needed)
}


