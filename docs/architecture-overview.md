# Sfinx Architecture Overview

> Single entry point to the entire Sfinx system. For quick-start and setup see [README](../README.md). For development rules see [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md).

Sfinx is an AI-powered autonomous technical screening interview system. It conducts, scores, and ranks candidates through a two-stage interview (background Q&A + live coding), then presents results to hiring managers via a Candidate Performance Summary (CPS) page with video evidence.

---

## End-to-End Flow

```
Company creates Job
  |  experienceCategories, codingCategories, interviewContent, scoringConfiguration
  v
Candidate logs in
  |  InterviewPreloadContext creates warmup shell (Application + Session + Telemetry)
  |  Preloads: OpenAI client, sound effects, interview scripts
  v
Candidate selects Job
  |  PATCH /api/interviews/warmup/activate -> links job, sets status IN_PROGRESS
  v
Background Interview (experience stage)
  |  AI asks questions per dynamic category prioritization
  |  Each answer -> /next-question (fast, ~300ms) + /evaluate-answer (async)
  |  CategoryContribution + EvidenceClip + VideoChapter created per strong answer
  |  Gate: all categories at avgStrength >= 100 OR timebox expired -> transition
  |  /background-summary generates BackgroundSummary
  v
Coding Interview (problem-solving stage)
  |  Monaco editor, debounced code evaluation via /evaluate-code-change
  |  Paste detection -> /identify-paste-topics -> Q&A -> /evaluate-paste-accountability
  |  Iterations tracked per "Run Code" click -> /evaluate-output
  v
Submission
  |  POST /session/:id/process -> returns 202 immediately
  |  after() runs 5 async steps: coding gaps, coding summary, code quality,
  |  job-specific eval, profile story -> marks session COMPLETED
  v
CPS Review (company)
  |  /candidates/:id/telemetry serves full evaluation
  |  calculateScore computes finalScore (experience 50% + coding 50%)
  |  Video player with chapters, evidence clips, captions
  |  Score breakdown, experience modal, coding modal, workstyle dashboard
```

---

## System Areas

| Area | Documents | Key Concern |
|------|-----------|-------------|
| **Core Architecture** | [system-design](./system-design.md), [CLAUDE.md](../CLAUDE.md), [AGENTS.md](../AGENTS.md) | Layers, state machine, conventions |
| **Interview Pipeline** | [interview-start-loading-optimization](./interview-start-loading-optimization.md), [blank-answer-handling](./blank-answer-handling.md), [dont-know-detection](./dont-know-detection-and-topic-exclusion.md), [answer-evaluation-optimization](./answer-evaluation-optimization.md), [skip-to-coding](./skip-to-coding-feature.md), [animation-states](./sfinx-animation-states.md) | Candidate-facing interview flow |
| **Evaluation Engine** | [dynamic-category-prioritization](./dynamic-category-prioritization-system.md), [contributions-target-and-transition](./contributions-target-and-transition-logic.md), [external-tool-evaluation](./external-tool-evaluation.md), [evidence-clip-timing](./evidence-clip-timing.md), [unified-realtime-evaluation](./unified-realtime-evaluation-system.md) | Real-time scoring during interview |
| **Scoring System** | [scoring-system](./scoring-system.md), [dynamic-categories-migration](./dynamic-categories-migration.md), [job-specific-coding-categories](./job-specific-coding-categories.md), [company-dashboard-score-implementation](./company-dashboard-score-implementation.md) | Score calculation, category weights |
| **Post-Interview** | [async-interview-processing-handoff](./async-interview-processing-handoff.md) | Async processing after submission |
| **Company Dashboard** | [company-dashboard spec](./specs/company-dashboard.md), [company-dashboard-score-implementation](./company-dashboard-score-implementation.md) | Company-facing review UI |
| **Mascot / Avatar** | [mascot-integration](./specs/mascot-integration.md), [heygen plan](./specs/heygen_streaming_avatar_integration_2031ff0d.plan.md), [animation-states](./sfinx-animation-states.md) | AI interviewer avatar |
| **Reference** | [qm-demo](./qm-demo-jan-13-2026.md), [CHANGELOG](../CHANGELOG.md) | Demo prep, version history |

---

## Architecture Layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Presentation** | `app/(features)/interview/`, `app/(features)/cps/`, `app/(features)/company-dashboard/` | React pages + components, camera/mic, Monaco editor, video player |
| **Application** | `shared/state/slices/` | Redux: `interviewSlice` (stage machine), `backgroundSlice` (Q&A + category stats), `codingSlice` (code + paste evals), `cpsSlice` (evidence playback) |
| **API** | `app/api/interviews/`, `app/api/company/`, `app/api/candidates/` | Next.js route handlers (REST) |
| **Service** | `shared/services/`, `shared/prompts/` | OpenAI integration, answer classification, TTS, mascot, background interview orchestration |
| **Data** | `server/prisma/schema.prisma`, `lib/prisma.ts` | PostgreSQL via Prisma ORM, Vercel Blob for video |

---

## Key API Endpoints

### Interview Session
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/interviews/warmup` | Pre-create shell records at login |
| PATCH | `/api/interviews/warmup/activate` | Activate shell with real job data |
| POST | `/api/interviews/session` | Create interview session |
| GET | `/api/interviews/session/[id]` | Fetch session + recordingStartedAt |
| POST | `/api/interviews/session/[id]/process` | Trigger async post-interview processing (returns 202) |
| PATCH | `/api/interviews/session/[id]/update-recording-start` | Set recordingStartedAt |

### Background Stage
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/interviews/next-question` | Fast question generation with answer classification (~300ms) |
| POST | `/api/interviews/evaluate-answer` | Full answer evaluation with category scoring (async) |
| POST | `/api/interviews/session/[id]/background-summary` | Generate BackgroundSummary |
| POST | `/api/interviews/session/[id]/background-evidence` | Save answer timestamps for video |

### Coding Stage
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/interviews/evaluate-code-change` | Real-time code diff evaluation |
| POST | `/api/interviews/evaluate-output` | Compare code output to expected |
| POST | `/api/interviews/evaluate-job-specific-coding` | Job-category scoring for final code |
| POST | `/api/interviews/generate-coding-summary` | Generate CodingSummary |
| POST | `/api/interviews/generate-coding-gaps` | Identify skill gaps |

### Paste Detection
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/interviews/identify-paste-topics` | Extract topics from pasted code |
| POST | `/api/interviews/evaluate-paste-accountability` | Score understanding via Q&A |
| POST | `/api/interviews/generate-paste-summary` | Final paste assessment |

### Company
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/company/jobs` | List company jobs |
| POST | `/api/company/jobs` | Create job with categories |
| GET | `/api/company/jobs/[id]/applicants` | List applicants with highlights |
| GET | `/api/company/applicants` | All applicants across jobs |

### Candidate / Telemetry
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/candidates/[id]/telemetry` | Full evaluation data for CPS page |
| POST | `/api/applications/create` | Apply to a job |
| GET | `/api/user/applications` | User's applications |

---

## Database Models

```
User (id, name, email, role: CANDIDATE|COMPANY|ADMIN)
  |-- CandidateProfile (resume, skills, experience)
  |-- CompanyProfile (company info)
  |-- Application (candidateId, jobId, status: WARMUP|PENDING|INTERVIEWING|...)
  |     |-- InterviewSession (candidateId, applicationId, status, finalScore, recordingStartedAt)
  |           |-- TelemetryData (matchScore, confidence, story, storyEmphasis)
  |           |     |-- BackgroundSummary (executiveSummary, experienceCategories, recommendation)
  |           |     |-- CodingSummary (codeQualityScore, jobSpecificCategories, finalCode)
  |           |     |-- WorkstyleMetrics (aiAssistUsage, externalToolUsage)
  |           |     |-- GapAnalysis -> Gap[] (skill, severity, evidence)
  |           |     |-- EvidenceClip[] (category, startTime, contributionStrength)
  |           |     |-- VideoChapter[] -> VideoCaption[] (timestamped captions)
  |           |-- ConversationMessage[] (role, content, stage, timestamp)
  |           |-- Iteration[] (codeSnapshot, output, evaluation, matchPercentage)
  |           |-- ExternalToolUsage[] (pastedContent, understanding, accountabilityScore)
  |           |-- CategoryContribution[] (categoryName, codeChange, strength, caption)
  |
Company (id, name, slug, logo)
  |-- Job (title, type, experienceCategories, codingCategories)
        |-- InterviewContent (backgroundQuestion, codingPrompt, template, answer, timeboxes)
        |-- ScoringConfiguration (aiAssistWeight=25, experienceWeight=50, codingWeight=50)
```

---

## State Management (Redux)

| Slice | Key State | Purpose |
|-------|-----------|---------|
| `interviewSlice` | `stage`, `sessionId`, `userId`, `preloadedFirstQuestion`, `isRecording` | Global interview lifecycle, stage transitions (greeting -> background -> coding -> wrapup) |
| `backgroundSlice` | `messages`, `categoryStats`, `currentFocusTopic`, `evaluatingAnswer`, `transitioned` | Background Q&A flow, per-category contribution tracking, "I don't know" counts |
| `codingSlice` | `messages`, `activePasteEvaluation`, `timeboxSeconds` | Coding chat, paste detection state (topics, Q&A scores, accountability) |
| `cpsSlice` | `activeEvidenceTimestamp`, `activeEvidenceKey`, `activeCaption` | CPS page video playback, evidence clip navigation |

---

## Scoring Formula

```
experienceScore = weightedAverage(experienceCategories[].score, weights)
codingCategoryAvg = weightedAverage(codingCategories[].score, weights)
codingScore = codingCategoryAvg * (1 - aiAssistWeight/100) + aiAssistScore * (aiAssistWeight/100)
finalScore = (experienceScore * experienceWeight + codingScore * codingWeight) / totalWeight
```

Implementation: `app/shared/utils/calculateScore.ts`
Documentation: [scoring-system.md](./scoring-system.md)

---

## Document Index

| Document | Location | Description |
|----------|----------|-------------|
| AGENTS.md | [/AGENTS.md](../AGENTS.md) | Sfinx Constitution v1.7.0 - core development principles and governance |
| answer-evaluation-optimization | [/docs/](./answer-evaluation-optimization.md) | Dual-call evaluation architecture (fast + full API) |
| async-interview-processing-handoff | [/docs/](./async-interview-processing-handoff.md) | Async post-interview processing via `/process` endpoint |
| blank-answer-handling | [/docs/](./blank-answer-handling.md) | System for handling blank/empty candidate answers |
| CHANGELOG | [/CHANGELOG.md](../CHANGELOG.md) | Release history v0.1.0 - v1.23.0 |
| CLAUDE.md | [/CLAUDE.md](../CLAUDE.md) | Claude AI assistant guidelines for development |
| company-dashboard (spec) | [/docs/specs/](./specs/company-dashboard.md) | Company dashboard feature spec |
| company-dashboard-score-implementation | [/docs/](./company-dashboard-score-implementation.md) | Score display implementation in company dashboard |
| contributions-target-and-transition-logic | [/docs/](./contributions-target-and-transition-logic.md) | CONTRIBUTIONS_TARGET constant, transition gate logic |
| dont-know-detection-and-topic-exclusion | [/docs/](./dont-know-detection-and-topic-exclusion.md) | "I don't know" detection, topic exclusion, thresholds |
| dynamic-categories-migration | [/docs/](./dynamic-categories-migration.md) | Migration from static to dynamic job-defined categories |
| dynamic-category-prioritization-system | [/docs/](./dynamic-category-prioritization-system.md) | 3-phase question selection algorithm |
| evidence-clip-timing | [/docs/](./evidence-clip-timing.md) | Video offset calculation and timestamp architecture |
| external-tool-evaluation | [/docs/](./external-tool-evaluation.md) | 3-phase paste detection and accountability pipeline |
| heygen plan (spec) | [/docs/specs/](./specs/heygen_streaming_avatar_integration_2031ff0d.plan.md) | HeyGen streaming avatar integration plan |
| interview-start-loading-optimization | [/docs/](./interview-start-loading-optimization.md) | Warmup pre-creation and parallel preloading |
| job-specific-coding-categories | [/docs/](./job-specific-coding-categories.md) | Real-time code evaluation with job-specific criteria |
| mascot-integration (spec) | [/docs/specs/](./specs/mascot-integration.md) | Mascot/avatar integration spec |
| qm-demo-jan-13-2026 | [/docs/](./qm-demo-jan-13-2026.md) | QM demo case study with 3 candidate profiles |
| README | [/README.md](../README.md) | Project overview, setup, demo flow |
| scoring-system | [/docs/](./scoring-system.md) | Scoring formulas, weights, edge cases |
| sfinx-animation-states | [/docs/](./sfinx-animation-states.md) | Three animation states for avatar UI |
| skip-to-coding-feature | [/docs/](./skip-to-coding-feature.md) | Dev feature to bypass background phase |
| unified-realtime-evaluation-system | [/docs/](./unified-realtime-evaluation-system.md) | Shared debug panel architecture for evaluation stages |
