# Sfinx Constitution

## Core Principles

### I. Hard Ban on Fallbacks
- Hidden fallbacks or implicit behavior are PROHIBITED unless a maintainer spells out the exact fallback in writing for that change.
- Any approved fallback MUST ship behind a documented feature flag or configuration toggle with monitoring.
- Every violation must block merges and be logged in the changelog with remediation steps.
- Rationale: Predictable behavior reduces surprise and debugging cost.

### II. Reuse-First and Modularity
- Teams MUST prioritize reusing existing code and composing modular units over duplicating logic.
- Modules MUST have a single clear purpose and minimal coupling; prefer helpers/services/components over large files.
- When identical logic repeats, you MUST extract it into a shared helper immediately. Example from `OpenAITextConversation`:
  - `interviewChatStore.dispatch({ type: "SET_PENDING_REPLY", payload: { pending: false } })`
  - `throw new Error("OpenAI returned empty coding prompt response");`
  These two lines appeared twice—duplication is a constitution breach.
- Rationale: Reuse and modularity reduce defects, speed delivery, and improve maintainability.

### III. Function Length Discipline (≤25 lines)
- Functions MUST remain under 25 lines of code (excluding comments and blank lines).
- Applies to all `.ts`, `.tsx` under `app/`, `shared/`, `server/` (and related packages); generated code excluded.
- When a function exceeds this limit, extract helper functions with clear, descriptive names to maintain readability.
- The goal is NOT to make code shorter at the expense of readability, but to defer complexity into well-named helper functions.
- CI SHOULD enforce this limit.
- Rationale: Short functions are easier to understand, test, and maintain; readable code beats clever code.

### IV. Documentation Discipline (Files and Functions)
- Every file and public function MUST be documented succinctly where defined (TypeScript doc comments).
- Function documentation MUST be concise (≤ 4 lines) while explaining purpose and key behavior.
- For every new file and every new function added, documentation MUST be included in the same change (commit/PR).
- Rationale: Lightweight documentation preserves clarity without burdening iteration speed.

### V. Library-First Integration
- Prefer integrating mature, well-maintained libraries before building custom implementations.
- Evaluate maintenance signals (recent releases, issue activity) and license compatibility before adoption.
- Rationale: Leveraging proven libraries accelerates delivery and improves reliability.

### VI. Evidence‑First Debugging & Causality
- Before implementing fixes, teams MUST establish a clear, code‑level causal chain for any defect.
- Proof requires: reproducible steps, precise log/trace evidence, and file/line references showing how code yields the observed behavior.
- No guesswork or speculative mitigations; fixes proceed only after causality is demonstrated.
- Rationale: Ensures durable solutions, avoids masking symptoms, and prevents regressions.

### VII. Observability & Logging for AI‑Assisted Coding
- ALL logging MUST use the logger service located at `app/shared/services/logger.ts`; direct `console.log`, `console.error`, or other console methods are PROHIBITED.
- Code MUST emit concise, structured logs at key state transitions, decisions, external I/O, retries, and errors.
- Logs MUST include correlation context (request/session IDs) and minimal input/output summaries; secrets and PII MUST be redacted.
- Log levels MUST be consistent (debug/info/warn/error); logs MUST be actionable and avoid noise or duplication.
- Do NOT add hidden fallbacks that mask failures; failures MUST be logged explicitly with impact.
- Rationale: AI‑assisted workflows depend on clear state visibility so humans and agents can understand current and next states.

## Additional Constraints
- Conversation and session data defaults to in-memory for POC; persistence requires explicit approval.
- Secrets MUST never be committed; use environment variables/CI secrets.
- Accessibility and performance are non-negotiable: fast first interaction and readable UI components.
- Default-value fallbacks are forbidden; expressions like `const companyName = ms.companyName || "Company"` MUST NOT be used.

## Development Workflow & Quality Gates
- Planning Enforcement: During planning mode, every constitution gate MUST be resolved explicitly; implementation plans MUST capture the detailed decisions, parameters, and rationale for each gate before any code changes begin (e.g., library versus custom build choices, timeboxing defaults, validation strategy).
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

## Communication Style
- All responses MUST be limited to 5 sentences maximum.
- Concise, direct communication is mandatory.
- No exceptions to the 5-sentence limit.

## AI Efficiency & Token Optimization
- Use `grep` or `codebase_search` instead of reading entire files when searching for specific code patterns.
- Execute all independent tool calls in parallel (batch file reads, searches, etc.).
- NEVER re-read files unnecessarily; remember file contents from earlier in the conversation.
- Use targeted line ranges (`offset`/`limit`) when reading large files; only read full files when absolutely necessary.
- Execute changes immediately without verbose explanations; let the code speak for itself.
- Avoid redundant context or explanatory text—assume the user understands their codebase.
- Only read/reference files directly relevant to the current task; avoid including unnecessary context.
- Consolidate related changes within single conversations to maximize cache effectiveness.
- Prefer targeted edits (`search_replace`) over full file rewrites to minimize token usage.
- Batch related requests together rather than making separate prompts for connected work.

**Version**: 1.6.0
