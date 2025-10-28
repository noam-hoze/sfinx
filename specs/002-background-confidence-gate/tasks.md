# Tasks: Background Confidence Gate

## Phase 1 – Setup

- [ ] T001 Ensure DEBUG_MODE env is wired into runtime config in app (verify reading path)
- [ ] T002 Create feature directory scaffolds in app/(features)/interview/components/debug and hooks

## Phase 2 – Foundational

- [ ] T003 Define BackgroundAssessment types in app/shared/services/backgroundConfidenceScorer.ts (source: CONTROL JSON)
- [ ] T004 Create stage gate helper in app/shared/services/stageGate.ts
- [ ] T005 Expose question count and confidence fields in shared/state/interviewChatStore.ts
- [ ] T005a Update interviewer prompt to align with FR‑009 and emit CONTROL JSON in shared/prompts/openAIInterviewerPrompt.ts
- [ ] T005b Encode 5‑stage flow in shared/services/openAIFlowController.ts (Greeting → Background → Coding → Submission → Wrap‑up)
- [ ] T005c Add optional stage field to shared/state/interviewChatStore.ts ("greeting"|"background"|"coding"|"submission"|"wrapup")

## Phase 3 – User Story 1 (P1): AI gathers and evaluates background

- [ ] T006 [US1] Parse CONTROL JSON lines in app/(features)/interview/components/chat/RealTimeConversation.tsx and update store
- [ ] T007 [P] [US1] Increment background questions count upon each parsed candidate answer
- [ ] T008 [US1] Remove local heuristic scorer usage; rely solely on CONTROL JSON
- [ ] T009 [US1] Display per‑pillar confidence in debug (if available) without exposing to candidate
- [ ] T010 [US1] Independent test script: feed CONTROL lines and assert store updates (quickstart.md)

## Phase 4 – User Story 2 (P2): Auto‑advance at threshold

- [ ] T012 [US2] Gate progression: advance only when overallConfidence ≥ 95, readyToProceed=true, and ≥3 questions
- [ ] T013 [P] [US2] Ensure single transition idempotency in stageGate.ts
- [ ] T014 [US2] Set stage="coding" on transition and timestamp (store)
- [ ] T015 [US2] Independent test: 94% then 95% with readyToProceed toggled

## Phase 5 – User Story 3 (P3): Debug visibility

- [ ] T017 [US3] Update BackgroundDebugBadge.tsx to read and display current stage + confidence
- [ ] T018 [P] [US3] Keep behind NEXT_PUBLIC_DEBUG_MODE
- [ ] T019 [US3] Independent test: toggle DEBUG_MODE true/false and verify visibility

## Final Phase – Polish & Cross‑Cutting

- [ ] T021 Add concise doc comments to new services and functions
- [ ] T022 Verify files <300 LOC; factor helpers if needed
- [ ] T023 Validate prompt does not reveal rubric/confidence in trial runs (quickstart.md)
- [ ] T025 Verify flow controller transitions across 5 stages in a dry run

## Dependencies / Story Order

1. Setup → Foundational → US1 → US2 → US3 → Polish
2. US1 is prerequisite for US2; US3 can run after Foundational in parallel with late US1 tasks if needed

## Parallel Execution Examples

- T007 and T009 can run in parallel (separate concerns)
- T013 and T014 can run in parallel after T012
- T017 and T018 can run in parallel

## Implementation Strategy (MVP First)

- MVP: Complete US1 (T006–T011) to deliver confidence tracking with evidence
- Next: US2 auto‑advance gating; Then US3 debug visibility; Finish with polish
