# Tasks: Background Confidence Gate (Chat Completions CONTROL)

## Phase 1 – Setup

- [ ] T001 Verify DEBUG_MODE wiring in runtime config (read path) in app/.env usage
- [ ] T002 Ensure `NEXT_PUBLIC_NEXT_PUBLIC_OPENAI_API_KEY` is read only in client code; add note in README

## Phase 2 – Foundational

- [ ] T003 Create `shared/services/backgroundConfidenceTypes.ts` with types for CONTROL result (overallConfidence, pillars, readyToProceed)
- [ ] T004 Create `shared/services/buildControlContext.ts` to select last K alternating turns from `shared/state/interviewChatStore.ts`
- [ ] T005 Add exported const `CONTROL_CONTEXT_TURNS` (default 10) in `shared/services/backgroundConfidenceTypes.ts`
- [ ] T006 Create `shared/services/parseControlResult.ts` to safely parse/validate JSON to types

## Phase 3 – User Story 1 (P1): Evaluate background via Chat Completions

Goal: After a user answer (or via a button), send last K alternating turns to Chat Completions with strict JSON schema and update confidence.

- [ ] T007 [US1] Add prompt builder `buildControlEvaluationPrompt` in `shared/services/backgroundConfidenceScorer.ts`
- [ ] T008 [US1] Implement client call using OpenAI Chat Completions in `app/(features)/interview/components/chat/OpenAIConversation.tsx` (manual button path; temperature 0; strict json_schema)
- [ ] T009 [US1] [P] Wire parser to update `interviewChatStore` confidence on success; log full raw on parse errors
- [ ] T010 [US1] Serialize requests: ensure at most one in‑flight CONTROL per user answer (simple flag) in `OpenAIConversation.tsx`
- [ ] T011 [US1] Record `turnId` and timestamps in logs for each CONTROL request/response

## Phase 4 – User Story 2 (P2): Auto‑advance at threshold

Goal: Move to Coding when overallConfidence ≥ 95 AND readyToProceed=true AND ≥3 questions.

- [ ] T012 [US2] Implement `shared/services/stageGate.ts` with deterministic gate function
- [ ] T013 [US2] Update `OpenAIConversation.tsx` to invoke gate after CONTROL update; set stage="coding" and timestamp
- [ ] T014 [US2] Ensure single transition idempotency in store (`BG_MARK_TRANSITION` semantics)

## Phase 5 – User Story 3 (P3): Debug visibility

Goal: Show stage + confidence only when DEBUG_MODE=true.

- [ ] T015 [US3] Add/Update debug badge component to read stage/confidence (app/(features)/interview/components/debug/BackgroundDebugBadge.tsx)
- [ ] T016 [P] [US3] Toggle via `NEXT_PUBLIC_DEBUG_MODE`

## Phase 6 – Cleanup: Remove or fix legacy realtime CONTROL code

- [ ] T017 Remove realtime CONTROL backchannel request/parse/timers in `app/(features)/interview/components/chat/OpenAIConversation.tsx` (already removed, re‑verify)
- [ ] T018 Remove CONTROL parsing in `app/(features)/interview/components/chat/RealTimeConversation.tsx` (if present)
- [ ] T019 Remove any `CONTROL:` prompt strings from prompts or flows; keep prompts evaluation‑agnostic
- [ ] T020 Search repo for `overallConfidence` leakage checks tied to realtime parsing and delete or comment with TODO:MIGRATE note

## Final Phase – Polish & Cross‑Cutting

- [ ] T021 Add concise doc comments to new services and exported functions
- [ ] T022 Ensure new/edited files <300 LOC; extract helpers as needed
- [ ] T023 Add clear console logs (INFO/ERROR) for CONTROL request/parse/update with `turnId`
- [ ] T024 Plan follow‑up: move client Chat Completions call to server route `app/api/control/eval/route.ts` (not implemented now)

## Dependencies / Story Order

1. Setup → Foundational → US1 → US2 → US3 → Cleanup → Polish
2. US1 is prerequisite for US2; US3 can proceed after Foundational; Cleanup can run after US1 edits are merged

## Parallel Execution Examples

- T009 and T011 can run in parallel
- T012 and T014 can run in parallel after T013 landing
- T016 and T023 can run in parallel

## Implementation Strategy (MVP First)

- MVP: Complete US1 (T007–T011) to deliver confidence updates via Chat Completions with strict JSON.
- Next: US2 auto‑advance gating; Then US3 debug visibility; Finish with Cleanup and Polish.
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
