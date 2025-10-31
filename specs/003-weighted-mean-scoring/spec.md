# Feature Specification: sfinx-weighted-mean-scorer

**Feature Branch**: `003-weighted-mean-scoring`  
**Created**: 2025-10-30  
**Status**: Draft  
**Input**: User description: "Generate production-ready TypeScript for Sfinx to score {Adaptability, Creativity, Reasoning} using a cumulative weighted mean. Deterministic, order-invariant, debuggable. No EMAs. No Bayes."

**Purpose**: Provide a deterministic, order-invariant, debuggable scorer that aggregates per-trait scores in [0,1] using a cumulative weighted mean with weights from difficulty, answer quality, independence, and recency; expose a monotonic evidence-based confidence `W/(W+c)` and a simple stop rule.

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Compute per-trait cumulative scores (Priority: P1)

As a reviewer, I can compute per-trait cumulative scores in [0,1] from a sequence of per-turn trait estimates using a deterministic weighted-mean rule.

**Why this priority**: Foundation for a consistent gate; downstream features depend on stable scoring.

**Independent Test**: Feed a fixed list of per-trait triples with weights; expect exact cumulative results regardless of order.

**Acceptance Scenarios**:

1. **Given** an empty TraitState, **When** apply (0.5,0.5,0.5,w=1), **Then** cumulative = (0.5,0.5,0.5).
2. **Given** cumulative=(0.5,0.5,0.5,W=1), **When** apply (0.8,0.2,0.6,w=2) in any order with (0.5,0.5,0.5,w=1), **Then** results are identical: ((0.5*1+0.8*2)/3, (0.5*1+0.2*2)/3, (0.5*1+0.6*2)/3).

---

### User Story 2 - Confidence and gate (Priority: P2)

As a reviewer, I see a monotonic confidence derived from cumulative evidence to drive a τ gate.

**Why this priority**: Confidence gates should depend on evidence mass; reduces variance and flip‑flops.

**Independent Test**: With fixed c=2, confidence per trait `W/(W+c)` never decreases as updates with w>0 are applied; gate flips only once at conf≥τ.

**Acceptance Scenarios**:

1. **Given** cumulative scores, **When** compute confidence, **Then** order-invariance holds.
2. **Given** increasing W via updates with w>0, **Then** the gate flips at most once when conf≥τ.

---

### User Story 3 - Debug outputs (Priority: P3)

As a developer, I can inspect intermediate weights, partial sums, and final scores for any aggregation call.

**Why this priority**: Debuggability is critical for trust and fast incident resolution.

**Independent Test**: Trigger a single update and verify the snapshot matches mathematically recomputed values.

**Acceptance Scenarios**:

1. **Given** `S=0.5,W=0,n=0`, **When** update with `r_A=0.8,w=0.6`, **Then** snapshot shows `S_A_before=0.5,W_A_before=0`, `S_A_after=(0.5*0+0.8*0.6)/0.6=0.8`, `W_A_after=0.6`, `n_A_after` unchanged unless flagged.
2. **Given** any update, **Then** invariants hold: `0≤S≤1`, `W` non‑decreasing, `n` is an integer.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- No inputs: returns zeros and W=0.
- w≤0: skip.
- Any component outside [0,1]: clip to [0,1].
- Very large raw weight: cap at w_max.
- Merge with zero total weight: if `W_a+W_b=0`, return `{S=initialScore,W=0,n=0}`.
- Any NaN/undefined component in inputs: reject update.
- Default caps: `w_max=1.0` (cap raw weight after composition and clipping).
 - If `w` becomes 0 after clipping/cap → skip update.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: For each trait T∈{A,C,R}, maintain state `{S_T∈[0,1], W_T≥0, n_T∈ℕ}` and update with weighted mean: `S_T ← (W_T·S_T + w·r_T)/(W_T+w)`, `W_T ← W_T + w`.
- **FR-002**: Compute per-answer weight: `w = clip(d,0,1) · clip(q,0,1) · ((clip(w_ind,0,1)+clip(w_rec,0,1))/2)` then `w ← min(w, w_max)`.
- **FR-003**: Skip update for traits not evidenced in the answer; increment `n_T` only when evidence is strong & independent.
- **FR-004**: Confidence per trait: `conf_T = W_T/(W_T + c)`; report per‑trait confidences; defaults: `c=2`, gate `τ=0.7`.
- **FR-005**: Order-invariant and deterministic for identical multisets; `merge(a,b)` is commutative/associative.
- **FR-006**: Expose debug snapshot per update: `{trait, r_T, w, S_before, W_before, S_after, W_after, n_after}`.
- **FR-007**: Stop rule API: `ready = ∧_T (coverage_T ∧ n_T≥2 ∧ conf_T≥τ)`.
 - **FR-008**: Scorer exports `computeWeight(d,q,w_ind,w_rec,w_max)` that returns `min( clip(d)*clip(q)*((clip(w_ind)+clip(w_rec))/2), w_max )`.
 - **FR-009**: **Invalid inputs**: if any of `{d,q,w_ind,w_rec,r_T}` is `NaN`/`undefined`, throw `InvalidInputError`; clip all components to [0,1]. After clipping, if `w===0` → skip.
   - Export `class InvalidInputError extends Error { name = "InvalidInputError" }`.

### Key Entities

- **TraitState**: `{ S: number; W: number; n: number }`.
- **AllTraitState**: `{ A: TraitState; C: TraitState; R: TraitState }`.
- **WeightedMeanScorer**: `initState()`, `update(input)`, `confidences()` (uses `c` from config), `stopCheck(coverage: CoverageStatus)` (uses `τ,c` from config), `merge(a,b)`, `reset()`.
  - **merge math per trait T**: `W = W_a + W_b`; `S = (W_a·S_a + W_b·S_b)/W` if `W>0` else `S=initialScore`; `n = n_a + n_b`.
  - **reset semantics**: returns `{S=initialScore, W=0, n=0}` for each trait.

### Non-Functional Requirements

- Deterministic across runs for same inputs; pure functions (`update/merge`).
- Numeric tolerance in tests: 1e-12; precision stable on expected ranges.
- Fully typed; zero runtime deps.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Order‑invariance: 1,000 random permutations yield identical `S_T,W_T` within 1e‑12 tolerance.
- **SC-002**: Confidence monotonicity: for each trait, `conf_T` strictly increases iff each added `w>0`; unchanged when `w=0`.
- **SC-003**: Stop rule returns ready=true only when `coverage_T ∧ n_T≥2 ∧ conf_T≥τ` for all traits.
- **SC-004**: Merge equals batch: `merge(reduce(first half), reduce(second half)) == reduce(all)` within 1e‑12; all unit tests pass.

## Config

- `w_max=1.0`, `c=2`, `τ=0.7`, `initialScore=0.5`.

## Determinism

- `update/merge` are pure; no RNG/time dependence.
