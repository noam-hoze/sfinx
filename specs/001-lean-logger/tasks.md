# Tasks: Lean Logger

## Phase 1 — Setup

- [ ] T001 Add loglevel dependency in /Users/noonejoze/Projects/sfinx/package.json
- [ ] T002 Create wrapper in /Users/noonejoze/Projects/sfinx/app/shared/services/logger.ts (export log, setLevel, optional setAllowedFiles)
- [ ] T003 Update barrel in /Users/noonejoze/Projects/sfinx/app/shared/services/index.ts (export log, setLevel)
- [ ] T004 Update barrel in /Users/noonejoze/Projects/sfinx/app/index.ts (export log, remove useLogger)

## Phase 2 — Foundational

- [ ] T005 Replace legacy env/namespacing logic in /Users/noonejoze/Projects/sfinx/app/shared/services/logger.ts
- [ ] T006 Remove runtime logger config in /Users/noonejoze/Projects/sfinx/app/(features)/interview/components/chat/RealTimeConversation.tsx

## Phase 3 — [US1] Refactor components to new logger

- [ ] T007 [P] [US1] Update /Users/noonejoze/Projects/sfinx/app/shared/hooks/useElevenLabsStateMachine.ts to use log
- [ ] T008 [P] [US1] Update /Users/noonejoze/Projects/sfinx/app/(features)/interview/components/hooks/useScreenRecording.ts to use log
- [ ] T009 [P] [US1] Update /Users/noonejoze/Projects/sfinx/app/(features)/interview/components/hooks/useCamera.ts to use log
- [ ] T010 [P] [US1] Update /Users/noonejoze/Projects/sfinx/app/(features)/interview/components/chat/OpenAIConversation.tsx to use log
- [ ] T011 [P] [US1] Update /Users/noonejoze/Projects/sfinx/app/(features)/interview/components/InterviewIDE.tsx to use log
- [ ] T012 [P] [US1] Update /Users/noonejoze/Projects/sfinx/app/shared/components/Header.tsx to use log
- [ ] T013 [P] [US1] Update /Users/noonejoze/Projects/sfinx/app/(features)/interview/components/editor/EditorPanel.tsx to use log

## Phase 4 — [US2] Refactor API routes to new logger

- [ ] T014 [P] [US2] Update /Users/noonejoze/Projects/sfinx/app/api/convai/route.ts to use log
- [ ] T015 [P] [US2] Update /Users/noonejoze/Projects/sfinx/app/api/interviews/session/screen-recording/route.ts to use log
- [ ] T016 [P] [US2] Update /Users/noonejoze/Projects/sfinx/app/api/user/applications/route.ts to use log
- [ ] T017 [P] [US2] Update /Users/noonejoze/Projects/sfinx/app/api/upload/profile-image/route.ts to use log
- [ ] T018 [P] [US2] Update /Users/noonejoze/Projects/sfinx/app/api/interviews/session/route.ts to use log
- [ ] T019 [P] [US2] Update /Users/noonejoze/Projects/sfinx/app/api/interviews/session/[sessionId]/route.ts to use log
- [ ] T020 [P] [US2] Update /Users/noonejoze/Projects/sfinx/app/api/company/candidates/route.ts to use log
- [ ] T021 [P] [US2] Update /Users/noonejoze/Projects/sfinx/app/api/companies/route.ts to use log
- [ ] T022 [P] [US2] Update /Users/noonejoze/Projects/sfinx/app/api/applications/create/route.ts to use log

## Phase 5 — Polish & Cross-Cutting

- [ ] T023 Add optional central allowlist in wrapper (default empty)
- [ ] T024 Ensure imports use app/shared/services barrel; remove useLogger export
- [ ] T025 Add quickstart at /Users/noonejoze/Projects/sfinx/specs/001-lean-logger/quickstart.md
- [ ] T026 [P] Replace all console.debug/log/warn/error in /Users/noonejoze/Projects/sfinx/app, /Users/noonejoze/Projects/sfinx/server, /Users/noonejoze/Projects/sfinx/shared with log.*
- [ ] T027 [P] Add ESLint no-console rule in /Users/noonejoze/Projects/sfinx/eslint.config.mjs (allow warn/error if desired)

## Dependencies & Parallelization

- Order: Phase 1 → Phase 2 → Phases 3 & 4 (parallel per-file)

## Independent Test Criteria

- setLevel('silent') mutes all logs; raising to 'debug' enables logs; no leftover logger.for/setEnabled/namespacedOnly
