# Implementation Plan: sfinx-weighted-mean-scorer

**Branch**: `003-weighted-mean-scoring` | **Date**: 2025-10-30 | **Spec**: specs/003-weighted-mean-scoring/spec.md
**Input**: Feature specification from `/specs/003-weighted-mean-scoring/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a deterministic, order‑invariant scorer to aggregate per‑trait results (A,C,R) in [0,1] using cumulative weighted means with weights from difficulty, answer quality, independence, and recency. Provide per‑trait confidence `W/(W+c)`, a stop rule `coverage ∧ n≥2 ∧ conf≥τ`, and debug snapshots. No EMAs or Bayesian methods.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript (Node 20 / Next 15)  
**Primary Dependencies**: None (custom library)  
**Storage**: N/A (in‑memory state objects)  
**Testing**: Vitest/Jest (project default)  
**Target Platform**: Web/Node library within Sfinx monorepo  
**Project Type**: Web app with shared library under `shared/services`  
**Performance Goals**: O(1) update per sample; numerical stability within 1e‑12  
**Constraints**: Files <300 LOC; pure functions; zero side‑effects  
**Scale/Scope**: Small utility consumed by interview flow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Library‑first: no external library needed (simple arithmetic).  
File size: split into small modules (scorer.ts, types.ts, errors.ts, tests).  
Docs: add TSDoc to all public APIs.  
No fallbacks: invalid inputs throw `InvalidInputError`.

### Library Scan (MANDATORY)
- Candidates: none required (simple weighted mean).
- Decision: custom implementation (≤200 LOC), fully typed, testable.
- Alternatives: math/stat libraries rejected (overhead; no benefit).

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
shared/
  services/
    weightedMean/
      errors.ts
      types.ts
      scorer.ts
      index.ts
  tests/
    weightedMean/
      weightedMeanScorer.test.ts
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
