# Data Model: Weighted Mean Scorer

## Entities

### TraitState
- S: number (0..1)
- W: number (≥0)
- n: number (integer ≥0)

### AllTraitState
- A: TraitState
- C: TraitState
- R: TraitState

### Config
- w_max: number (default 1.0)
- c: number (default 2)
- τ: number (default 0.7)
- initialScore: number (default 0.5)

## Invariants
- 0 ≤ S ≤ 1
- W is non-decreasing per trait
- n is integer and non-decreasing per trait

## Operations
- computeWeight(d,q,w_ind,w_rec,w_max) → w (clipped/capped; if 0 skip)
- update(state, input) → {state', snapshot}
- confidences(state) → {conf_A, conf_C, conf_R}
- stopCheck(state, coverage) → boolean
- merge(a,b) → state
- reset() → initial state
