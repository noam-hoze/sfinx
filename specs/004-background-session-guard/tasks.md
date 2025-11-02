# Tasks: Background Session Guard

## Phase 1 – Setup

- [ ] T001 Create guard service file shared/services/backgroundSessionGuard.ts
- [ ] T002 Add tests folder and helpers shared/tests/utils/{mockOpenAI.ts,simInterview.ts}
- [ ] T003 Add constants in shared/services/backgroundSessionGuard.ts (TIMEBOX_MS, ZERO_RUN_LIMIT, PROJECT_CAP)

## Phase 2 – Foundational

- [ ] T004 Implement GuardState type and helpers (startTimer, elapsedMs, resetProject, incZeroRuns, shouldTransition) in shared/services/backgroundSessionGuard.ts
- [ ] T005 [P] Wire guard state into shared/state/interviewChatStore.ts (add startedAtMs, zeroRuns, projectsUsed, reason)
- [ ] T006 Update prompt constraint in app/(features)/interview/components/chat/OpenAIConversation.tsx (explicit “no coding unless instructed”)

## Phase 3 – User Story 1 (P1): Session guard and timebox

Goal: Prevent unprompted coding; graceful switch at 4:00.
- [ ] T007 [US1] Start timer on first background question; persist startedAtMs in shared/state/interviewChatStore.ts
- [ ] T008 [US1] Implement graceful switch: if time hits 4:00 mid‑AI, transition after response.done; mid‑user, after finalization (state slice in shared/state/slices/interviewMachineSlice.ts)
- [ ] T009 [P] [US1] Unit test: Timebox‑During‑AI (backgroundSessionGuard.test.ts)
- [ ] T010 [P] [US1] Unit test: Timebox‑During‑User (backgroundSessionGuard.test.ts)
- [ ] T011 [US1] Unit test: No‑Unprompted‑Coding across 100 sessions (mocked interview runner)

## Phase 4 – User Story 2 (P2): Zero‑run and project cap

Goal: After 2×0/0/0 ask for another project (≤2 projects); otherwise proceed to coding.
- [ ] T012 [US2] Track consecutive zeroRuns per project; reset on non‑zero; increment projectsUsed on switch (shared/state/interviewChatStore.ts)
- [ ] T013 [US2] On zeroRuns==2 and projectsUsed<2, send follow‑up prompt (OpenAIConversation.tsx)
- [ ] T014 [US2] On projectsUsed==2 OR second zeroRuns after prompt, transition to coding unless stopCheck true (interviewMachineSlice.ts)
- [ ] T015 [P] [US2] Unit test: Zero‑Run Prompt (next AI turn asks for another project)
- [ ] T016 [P] [US2] Unit test: Project Cap triggers coding (records reason "projects_cap")

## Phase 5 – User Story 3 (P3): Debug indicators

Goal: Show countdown, zeroRuns, projectsUsed, reason.
- [ ] T017 [US3] Display countdown mm:ss, zeroRuns, projectsUsed, gate ready in app/shared/components/BackgroundDebugPanel.tsx
- [ ] T018 [US3] Show transition reason when set; maintain existing confidences/pillars display

## Final Phase – Polish & Cross‑Cutting

- [ ] T019 Add structured logs at guard transitions (elapsed, zeroRuns, projectsUsed, reason)
- [ ] T020 Ensure new/edited files <300 LOC; add TSDoc to public helpers
- [ ] T021 Quickstart updates with constants and test command (specs/004-background-session-guard/quickstart.md)

## Dependencies / Order

1. Setup → Foundational → US1 → US2 → US3 → Polish
2. Parallel: T005 with T006; T009–T011 in parallel; T015–T016 in parallel; T017–T018 after US2

## Implementation Strategy (MVP)

- Implement US1 (timer + graceful switch + tests), then US2 (zero‑run/project cap + tests), then US3 (UI).
