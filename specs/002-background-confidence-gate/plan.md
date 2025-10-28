# Implementation Plan: Background Confidence Gate

**Branch**: `[002-background-confidence-gate]` | **Date**: 2025-10-28 | **Spec**: ../spec.md
**Input**: Feature specification from `/specs/002-background-confidence-gate/spec.md`

**Note**: This plan is generated via `/speckit.plan` for design-only; no implementation details beyond contracts and structure.

## Summary

Introduce a 5‑stage interview flow: Greeting → Background → Coding → Submission → Wrap‑up. Background uses OpenAI‑provided confidence via a hidden control line (JSON) after each answer; the app parses and gates progression (≥95% and ≥3 questions). Debug visibility remains internal.

## Technical Context

**Language/Version**: TypeScript (NEEDS CLARIFICATION: exact TS version)
**Primary Dependencies**: OpenAI conversational integration (reuse), existing interview state store (reuse)
**Storage**: In-memory (POC default)
**Testing**: Jest/Playwright (NEEDS CLARIFICATION: project-standard test stack)
**Target Platform**: Web app runtime
**Project Type**: Web
**Performance Goals**: Immediate parsing (<5ms per message) (assumed)
**Constraints**: No hidden fallbacks; file-size discipline; reuse-first
**Scale/Scope**: Flow definition + control-line parsing + gating

## Constitution Check

- Reuse-First and Modularity: PASS
- File Size Discipline (<300 lines): PASS
- Documentation Discipline: PASS
- Library-First Integration: PASS
- No Fallbacks Unless Explicitly Requested: PASS
- Library Scan Gate (MANDATORY): PASS (see research.md)

### Library Scan (MANDATORY)
- Candidates: Existing OpenAI SDK; internal state store
- Decision: Reuse existing; no new libs
- Alternatives: XState, analytics libraries — rejected

## Project Structure

### Documentation (this feature)

```text
specs/002-background-confidence-gate/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
shared/
├── services/
│   ├── openAIFlowController.ts    # 5 stages and transitions
│   └── ...
├── prompts/
│   └── openAIInterviewerPrompt.ts # Emit CONTROL JSON line per answer (hidden)
└── state/
    └── interviewChatStore.ts      # confidence, questionsAsked, stage
app/(features)/interview/components/chat/
└── RealTimeConversation.tsx       # Parse CONTROL line, update store, gate to coding
```

**Structure Decision**: Prompt emits CONTROL JSON; chat layer parses it and gates; UI minimally unchanged.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Post-Design Constitution Re-check

- Gates remain PASS; artifacts updated with control-line design.
