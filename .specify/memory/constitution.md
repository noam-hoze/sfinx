# Sfinx Constitution

## Core Principles

### I. Reuse-First and Modularity
- Teams MUST prioritize reusing existing code and composing modular units over duplicating logic.
- Modules MUST have a single clear purpose and minimal coupling; prefer helpers/services/components over large files.
- Rationale: Reuse and modularity reduce defects, speed delivery, and improve maintainability.

### II. File Size Discipline (<300 lines)
- Source files MUST remain under 300 lines (excluding generated code).
- Applies to `.ts`, `.tsx` under `app/`, `shared/`, `server/` (and related packages); generated files excluded.
- CI SHOULD enforce this limit; split into helpers/services/components as needed.
- Rationale: Smaller files are easier to test, review, and evolve.

### III. Documentation Discipline (Files and Functions)
- Every file and public function MUST be documented succinctly where defined (TypeScript doc comments).
- Function documentation MUST be concise (≤ 4 lines) while explaining purpose and key behavior.
- For every new file and every new function added, documentation MUST be included in the same change (commit/PR).
- Rationale: Lightweight documentation preserves clarity without burdening iteration speed.

### IV. Library-First Integration
- Prefer integrating mature, well-maintained libraries before building custom implementations.
- Evaluate maintenance signals (recent releases, issue activity) and license compatibility before adoption.
- Rationale: Leveraging proven libraries accelerates delivery and improves reliability.

### V. No Fallbacks Unless Explicitly Requested
- Do not add hidden fallbacks or implicit behavior; use explicit feature flags or instructions.
- Rationale: Predictable behavior reduces surprise and debugging cost.

### VI. Evidence‑First Debugging & Causality
- Before implementing fixes, teams MUST establish a clear, code‑level causal chain for any defect.
- Proof requires: reproducible steps, precise log/trace evidence, and file/line references showing how code yields the observed behavior.
- No guesswork or speculative mitigations; fixes proceed only after causality is demonstrated.
- Rationale: Ensures durable solutions, avoids masking symptoms, and prevents regressions.

## Additional Constraints
- Conversation and session data defaults to in-memory for POC; persistence requires explicit approval.
- Secrets MUST never be committed; use environment variables/CI secrets.
- Accessibility and performance are non-negotiable: fast first interaction and readable UI components.

## Development Workflow & Quality Gates
- Specifications: Each feature under `app/(features)/<feature>/` MUST have a local spec at `docs/specs/<feature>.md` and be referenced in commits.
- Static analysis: Repository MUST pass `tsc --noEmit` and ESLint with project lints.
- Testing & Coverage: Tests MUST run in CI with coverage ≥ 60% (adjustable by maintainers).
- File-length gate: CI fails if file-length limits are exceeded (generated files excluded).
- POC mode: Direct commits allowed; decisions recorded in specs/commits; no PR/issue requirement.
- Library Scan Gate (MANDATORY): Before implementing any non-trivial utility or infrastructure, teams MUST:
  - Document a brief "Library Scan" in `research.md`: candidates, decision, rationale, alternatives.
  - Prefer a library unless a documented constraint justifies custom code.
  - Plans and tasks MUST include "Select library", "Integrate library", and (if applicable) "Remove custom util".
  - Failure to include this scan is a GATE FAILURE for /speckit.plan and /speckit.tasks.

## Governance
- This Constitution supersedes other practices when conflict arises.
- Amendments: Use `/speckit.constitution` to propose changes; maintainers may update directly in POC. Post‑POC, changes require approval per governance policy.
- Versioning: MAJOR for incompatible principle changes; MINOR for new principles/sections; PATCH for clarifications.

**Version**: 1.2.0
