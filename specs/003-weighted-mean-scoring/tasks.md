# Tasks: sfinx-weighted-mean-scorer

## Phase 1 – Setup

 - [X] T001 Create feature source folder shared/services/weightedMean/
 - [X] T002 Create tests folder shared/tests/weightedMean/

## Phase 2 – Foundational

 - [X] T003 Add errors class InvalidInputError in shared/services/weightedMean/errors.ts
 - [X] T004 Add scorer types in shared/services/weightedMean/types.ts (TraitState, AllTraitState, Config, CoverageStatus, Snapshot)
 - [X] T005 [P] Barrel export in shared/services/weightedMean/index.ts

## Phase 3 – User Story 1 (P1): Compute per-trait cumulative scores

Goal: Deterministic, order‑invariant cumulative weighted mean per trait in [0,1].
 - [X] T006 [US1] Implement computeWeight(d,q,w_ind,w_rec,w_max) in shared/services/weightedMean/scorer.ts
 - [X] T007 [US1] Implement initState(cfg) → AllTraitState in shared/services/weightedMean/scorer.ts
 - [X] T008 [US1] Implement update(state,input) with clipping, w_max cap, w===0 skip, NaN reject; return {state', snapshot}
 - [X] T009 [US1] Implement merge(a,b) (commutative/associative; zero‑sum branch to initialScore)
 - [X] T010 [US1] Implement reset(cfg) → initial state
 - [X] T011 [P] [US1] Unit test: permutation invariance over 1000 shuffles (shared/tests/weightedMean/weightedMeanScorer.test.ts)

## Phase 4 – User Story 2 (P2): Confidence and gate

Goal: Evidence‑based confidence and stop rule.
- [ ] T012 [US2] Implement confidences(state) using conf_T = W_T/(W_T + c)
- [ ] T013 [US2] Implement stopCheck(state, coverage: CoverageStatus) using τ,c from config
- [ ] T014 [P] [US2] Unit test: confidence monotonicity strictly increases iff w>0; unchanged for w=0
- [ ] T015 [P] [US2] Unit test: gate flips at most once as W grows; stop rule satisfied only when coverage∧n≥2∧conf≥τ

## Phase 5 – User Story 3 (P3): Debug outputs

Goal: Snapshot for each update with before/after and invariants.
- [ ] T016 [US3] Ensure update() returns snapshot {trait, r_T, w, S_before, W_before, S_after, W_after, n_after}
- [ ] T017 [P] [US3] Unit test: single update snapshot equals mathematical recompute; invariants 0≤S≤1, W non‑decreasing, n integer
 
 - [X] T012 [US2] Implement confidences(state) using conf_T = W_T/(W_T + c)
 - [X] T013 [US2] Implement stopCheck(state, coverage: CoverageStatus) using τ,c from config
 - [X] T014 [P] [US2] Unit test: confidence monotonicity strictly increases iff w>0; unchanged for w=0
 - [X] T015 [P] [US2] Unit test: gate flips at most once as W grows; stop rule satisfied only when coverage∧n≥2∧conf≥τ

 - [X] T016 [US3] Ensure update() returns snapshot {trait, r_T, w, S_before, W_before, S_after, W_after, n_after}
 - [X] T017 [P] [US3] Unit test: single update snapshot equals mathematical recompute; invariants 0≤S≤1, W non‑decreasing, n integer

## Final Phase – Polish & Cross‑Cutting

- [ ] T018 Add TSDoc to public APIs (errors.ts, types.ts, scorer.ts)
- [ ] T019 Ensure files <300 LOC; split helpers if needed
- [ ] T020 Add README section snippet to specs/003-weighted-mean-scoring/quickstart.md linking new API
 - [X] T018 Add TSDoc to public APIs (errors.ts, types.ts, scorer.ts)
 - [X] T019 Ensure files <300 LOC; split helpers if needed
 - [X] T020 Add README section snippet to specs/003-weighted-mean-scoring/quickstart.md linking new API

## Dependencies / Order

1. Setup → Foundational → US1 → US2 → US3 → Polish
2. Parallel examples: T005 with T003/T004; T011 with T009/T010; T014–T015–T017 in parallel after US1 core

## Implementation Strategy (MVP)

- MVP: Complete US1 (T006–T011) + basic tests; then add confidence/stop (US2), then debug outputs (US3).
