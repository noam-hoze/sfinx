# Implementation Plan: Background Session Guard

**Branch**: `004-background-session-guard` | **Date**: 2025-11-02 | **Spec**: specs/004-background-session-guard/spec.md
**Input**: Feature specification from `/specs/004-background-session-guard/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Guard the background interview: prevent AI from initiating coding, enforce a 4:00 timebox, prompt for another project after two consecutive 0/0/0 (max 2 projects), and transition to coding when the earliest of {timebox, project cap, stopCheck} fires. Show countdown and guard state in the debug panel. Tests simulate interviews via Chat Completions (text).

## Technical Context

**Language/Version**: TypeScript (Node 20 / Next 15)  
**Primary Dependencies**: openai (Chat Completions), Redux-style local stores (existing)  
**Storage**: N/A (in‑memory state)  
**Testing**: Vitest (project default); fake timers; mocked OpenAI client  
**Target Platform**: Web app (Next app dir)  
**Project Type**: Web app with shared libs under `shared/`  
**Performance Goals**: Timer accuracy ≤ ±1s; zero extra network calls when silent  
**Constraints**: Files <300 LOC; strong logs; no hidden fallbacks  
**Scale/Scope**: Single feature; adds counters/timer and prompt constraint

## Constitution Check

- File size discipline: keep new files ≤300 lines; split helpers.  
- Documentation discipline: TSDoc on new public functions.  
- No fallbacks: explicit gating only.  
- Observability: log guard transitions (elapsed, zeroRuns, projectsUsed, reason).  
- Library Scan: reuse existing OpenAI client and stores; no new infra needed.

### Library Scan (MANDATORY)
- Candidates: None (timer, counters, existing OpenAI client suffice).  
- Decision: Custom minimal code; no external scheduler libraries.  
- Alternatives: RxJS/timers libs rejected (overhead; not needed).

## Project Structure

### Documentation (this feature)

```text
specs/004-background-session-guard/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md (via /speckit.tasks)
```

### Source Code (repository)

```text
shared/
  state/
    interviewChatStore.ts        # add guard counters + timer start
    slices/interviewMachineSlice.ts  # transition using guard reason
  services/
    backgroundSessionGuard.ts    # guard helpers (time, counters, reason)

app/shared/components/
  BackgroundDebugPanel.tsx       # countdown + guard indicators

shared/tests/
  backgroundSessionGuard.test.ts # full unit tests with mocked OpenAI
```

**Structure Decision**: Add a tiny `backgroundSessionGuard.ts` for purity and reuse; keep UI changes isolated to panel.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
