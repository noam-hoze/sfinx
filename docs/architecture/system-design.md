# Sfinx System Design Document

**Version:** 1.1.0  
**Date:** January 2026  
**Status:** Production

**Changelog v1.1.0:**
- Refactored Redux state: `interviewMachineSlice` → `interviewSlice`
- Split interview chat into `backgroundSlice` and `codingSlice`
- Removed fallback defaults (Meta) from Redux initialState (constitution compliance)
- Fixed background timer: moved `startTimer()` dispatch to component level
- Removed `isPageLoading` from Redux (now local state in page.tsx)
- Moved coding timebox to Redux `codingSlice` (single source of truth, set during preload)

---

## Executive Summary

Sfinx is an autonomous AI-powered technical interview platform that conducts, evaluates, and ranks candidates through structured background interviews and coding assessments. The system uses OpenAI's GPT models for real-time conversation, code evaluation, and scoring, delivering consistent, scalable screening that replicates hiring-manager judgment.

**Key Metrics:**
- Fully automated candidate screening (0 human interviewer time)
- Real-time evaluation with sub-3-second response latency
- Multi-dimensional scoring (Experience + Coding + AI Accountability)
- Video evidence capture with timestamp-linked evaluation moments
- Job-specific dynamic evaluation criteria

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [Database Design](#database-design)
6. [State Management](#state-management)
7. [Evaluation Pipeline](#evaluation-pipeline)
8. [Scoring System](#scoring-system)
9. [API Design](#api-design)
10. [Security & Performance](#security--performance)
11. [Development Workflow](#development-workflow)
12. [Future Roadmap](#future-roadmap)

---

## System Overview

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                        │
│  Next.js 15 (App Router) + React 18 + TailwindCSS + TypeScript  │
│                                                                    │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │   Candidate     │  │    Company       │  │    Admin         │  │
│  │   Interview UI  │  │   Dashboard      │  │    Portal        │  │
│  └────────────────┘  └─────────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                          │
│              Redux State Management + Business Logic             │
│                                                                    │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐    │
│  │  Interview    │  │  Evaluation   │  │  Session           │    │
│  │  State Machine│  │  Orchestrator │  │  Management        │    │
│  └──────────────┘  └───────────────┘  └────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                           API LAYER                               │
│              Next.js API Routes + Server Actions                 │
│                                                                    │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Interview APIs  │  │ Evaluation    │  │  Company APIs    │    │
│  │  /api/interviews │  │ APIs          │  │  /api/company    │    │
│  └─────────────────┘  └──────────────┘  └──────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                             │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │   OpenAI     │  │   Logger     │  │   Background         │    │
│  │   Client     │  │   Service    │  │   Interview Service  │    │
│  └──────────────┘  └──────────────┘  └──────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                 │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │   PostgreSQL     │  │  Vercel Blob │  │   NextAuth       │    │
│  │   (Prisma ORM)   │  │  (Video)     │  │   (Sessions)     │    │
│  └──────────────────┘  └──────────────┘  └──────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                            │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │   OpenAI API     │  │   Monaco     │  │   Screen         │    │
│  │   (gpt-4o-mini)  │  │   Editor     │  │   Recording API  │    │
│  └──────────────────┘  └──────────────┘  └──────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- Next.js 15 (App Router, React Server Components)
- React 18 (Client Components for interactivity)
- TypeScript 5.5
- TailwindCSS 3.4
- Redux Toolkit 2.9 (global state)
- Monaco Editor 0.52 (code editor)
- Framer Motion 12.23 (animations)

**Backend:**
- Next.js API Routes (serverless functions)
- Prisma 6.15 (ORM)
- PostgreSQL (Neon/hosted)
- NextAuth 4.24 (authentication)

**AI/ML:**
- OpenAI gpt-4o-mini (text completions; evaluation model configurable via `OPENAI_EVALUATION_MODEL`)
- OpenAI Realtime API (voice conversations)
- OpenAI whisper-1 (audio transcription)
- OpenAI text-embedding-3-small (**planned, not yet implemented**)

**Infrastructure:**
- Vercel (hosting)
- Vercel Blob Storage (video recordings)

---

## Architecture Layers

### 1. Presentation Layer

**Candidate Interview Flow:**
- `/interview` - Unified interview page (background + coding)
- Real-time chat UI with OpenAI streaming
- Monaco code editor with syntax highlighting
- Screen recording with MediaRecorder API
- Debug panels (toggleable) for development

**Company Dashboard:**
- `/company-dashboard` - Job listings with applicant stats
- `/company-dashboard/applicants/[jobId]` - Applicant list per job
- `/company-dashboard/jobs/[jobId]` - Job configuration and scoring weights
- `/company-dashboard/settings` - Company profile management

**Candidate Profile Summary (CPS):**
- `/cps` - Comprehensive candidate evaluation view
- Video playback with timestamp navigation
- Score breakdown (Experience, Coding, AI Accountability)
- Evidence clips with contextual video jumps
- Modal overlays for detailed summaries

### 2. Application Layer

**State Management:**
- Redux store at `shared/state/store.ts`
- Interview machine slice: tracks interview progression states
- Chat store: manages messages, recording, stage transitions
- Evaluation data: real-time contributions, code evaluations

**Business Logic Services:**
- Background interview orchestration (`shared/services/backgroundInterview/`)
- Answer evaluation handlers
- Category gate checks
- OpenAI flow controller

### 3. API Layer

**Interview APIs (`/api/interviews/`):**
- `evaluate-answer` - Real-time answer evaluation for experience categories
- `evaluate-code-change` - Real-time code diff evaluation
- `evaluate-job-specific-coding` - Final code submission evaluation
- `evaluate-paste-accountability` - Paste detection Q&A scoring
- `session/[sessionId]/*` - Session management (messages, summaries, contributions)

**Company APIs (`/api/company/`):**
- `jobs/with-applicants` - Dashboard job list with stats
- `jobs/[jobId]/applicants` - Applicant list for job
- `jobs/[jobId]/scoring-config` - Configure scoring weights

**Candidate APIs (`/api/candidates/`):**
- `[id]/telemetry` - Fetch full evaluation telemetry
- `[id]/basic` - Candidate basic profile data

### 4. Service Layer

**OpenAI Integration:**
- Client initialization with API keys
- Streaming chat completions
- Structured JSON output parsing
- Error handling and retries

**Logger Service:**
- Centralized logging at `app/shared/services/logger.ts`
- Log levels: debug, info, warn, error
- Structured logs with session IDs
- Console.log/error PROHIBITED per constitution

**Background Interview Services:**
- Answer handler with gate logic
- Prompt builders (interviewer, summary)
- Category contribution aggregation

### 5. Data Layer

**Prisma ORM:**
- Schema at `server/prisma/schema.prisma`
- Migrations in `server/prisma/migrations/`
- Type-safe database client
- Relations fully normalized

**Blob Storage:**
- Video recordings stored in Vercel Blob
- Chunked upload support
- URL-based retrieval

---

## Core Components

### Interview State Machine

**Location:** `shared/state/slices/interviewSlice.ts`

**Stages:**
```typescript
type InterviewStage =
  | "greeting"    // AI greeting in progress
  | "background"  // Background Q&A in progress
  | "coding"      // Coding stage active
  | "submission"  // Code submitted, wrapping up
  | "wrapup";     // Interview completed
```

**Stage Transitions (via `setStage()`):**
- `null` → `"greeting"` on interview start
- `"greeting"` → `"background"` when background Q&A begins
- `"background"` → `"coding"` when gate passes or timebox expires
- `"coding"` → `"submission"` on code submit
- `end()` → sets stage to `"wrapup"`

**Gate Logic (in `useBackgroundAnswerHandler`):**
- Checks category coverage (all categories have contributions)
- Checks overall weighted average score (≥ 75%)
- Checks minimum contributions per category
- OR timebox expires (15 minutes default)

### OpenAI Conversation Manager

**Location:** `app/(features)/interview/components/chat/OpenAITextConversation.tsx`

**Responsibilities:**
- Initialize OpenAI client
- Stream messages to/from OpenAI Chat Completions API
- Manage conversation context window
- Handle paste detection events
- Coordinate with state machine for stage transitions

**Key Features:**
- Automatic mode (AI asks questions without user clicking)
- Manual mode (user controls conversation flow)
- Paste detection hooks for accountability Q&A
- Coding prompt delivery coordination

### Real-Time Evaluation System

**Unified Architecture:**
- Shared presentation components for background + coding
- Stage-specific data transformers
- Pluggable context components (Q&A vs Code Diff)

**Components:**
- `RealTimeContributionsView` - Shared view layer
- `BackgroundDebugPanel` - Background stage parent
- `CodingEvaluationDebugPanel` - Coding stage parent
- `QuestionAnswerContext` - Background evaluation context
- `CodeDiffContext` - Coding evaluation context

**Features:**
- Summary stats cards (evaluations, contributions, categories)
- Category breakdown with progress bars
- Evaluation timeline (chronological list)
- Accepted/rejected evaluations displayed
- Countdown timer for next evaluation (coding only)

### Video Recording System

**Location:** `app/(features)/interview/components/InterviewIDE.tsx`

**Flow:**
1. Request screen recording permission
2. Start MediaRecorder with video constraints
3. Capture chunks in real-time
4. On interview end, create Blob from chunks
5. Upload to Vercel Blob Storage
6. Store video URL in `InterviewSession.videoUrl`

**Timestamp Calculation:**
- `recordingStartedAt` stored in `InterviewSession`
- Evidence timestamps relative to recording start
- Video player can jump to exact evaluation moments

---

## Data Flow

### Background Interview Flow

```
Candidate answers question
  ↓
useBackgroundAnswerHandler captures answer
  ↓
Dispatch candidateMessage() → machine state: background_answered_by_user
  ↓
Call /api/interviews/evaluate-answer (non-blocking)
  ├─ Fetch experience categories from job config
  ├─ Call OpenAI to evaluate answer against ALL categories
  ├─ OpenAI returns evaluations (accepted + rejected)
  ├─ Accepted evaluations → Create CategoryContribution records
  └─ Store all evaluations in response for debug panel
  ↓
OpenAI generates next question or transitions to coding
  ↓
Dispatch interviewerMessage() → Check gate logic
  ├─ If gate satisfied → Dispatch startCoding()
  └─ Else → Ask another question
  ↓
At completion → Call /api/interviews/session/[sessionId]/background-summary
  ├─ Aggregate all contributions by category
  ├─ Calculate average score per category
  ├─ Generate executive summary via OpenAI
  └─ Store BackgroundSummary record
```

### Coding Interview Flow

```
Candidate types code in Monaco editor
  ↓
InterviewIDE debounces changes (8 seconds default)
  ↓
After inactivity, trigger evaluation
  ↓
Check Monaco editor for syntax errors
  ├─ If errors present → Skip evaluation, wait for next change
  └─ If no errors → Proceed
  ↓
Generate diff (previousCode → currentCode)
  ↓
Call /api/interviews/evaluate-code-change
  ├─ Send: previousCode, diff, currentCode, timestamp, categories
  ├─ OpenAI evaluates diff against ALL coding categories
  ├─ Returns evaluations (accepted + rejected)
  ├─ Accepted evaluations → Create CategoryContribution records
  └─ All evaluations → Stored in Redux for debug panel
  ↓
User clicks "Submit Code"
  ↓
Call /api/interviews/evaluate-job-specific-coding (legacy final eval)
  ↓
Call /api/interviews/session/[sessionId]/coding-summary-update
  ├─ Aggregate all CategoryContribution records by category
  ├─ Calculate average score per category
  ├─ Generate code quality analysis via OpenAI
  └─ Store CodingSummary record
```

### Paste Detection Flow

```
Candidate pastes code (clipboard event)
  ↓
onPasteDetected callback fired
  ↓
Call /api/interviews/identify-paste-topics
  ├─ Extract key concepts from pasted code (max set by NEXT_PUBLIC_MAX_PASTE_TOPICS)
  ├─ Generate initial probing question
  └─ Return topics array with name/description; percentage initialized to 0 client-side
  ↓
AI asks first question via OpenAI conversation
  ↓
Candidate answers
  ↓
Call /api/interviews/evaluate-paste-accountability
  ├─ Evaluate answer quality (0-100)
  ├─ Update topic coverage score
  ├─ Determine if more questions needed
  └─ Generate next question or conclude
  ↓
Repeat Q&A until:
  ├─ All topics covered (score > 0)
  ├─ OR 4+ questions asked
  └─ OR candidate requests to move on
  ↓
Call /api/interviews/generate-paste-summary
  ├─ Generate 1-2 sentence overall assessment
  ├─ Calculate average accountability score
  └─ Store ExternalToolUsage record
  ↓
AI transitions back to coding task
```

---

## Database Design

### Core Entities

**User** (Authentication & Authorization)
- `id`, `email`, `password`, `role` (CANDIDATE | COMPANY | ADMIN)
- Relations: `candidateProfile`, `companyProfile`, `applications`, `interviewSessions`

**Job** (Job Postings)
- `id`, `title`, `type`, `location`, `salary`, `description`, `requirements`
- **`codingCategories`** (Json): Dynamic coding evaluation criteria
- **`experienceCategories`** (Json): Dynamic experience evaluation criteria
- `interviewContentId`: Links to shared interview script
- Relations: `company`, `interviewContent`, `applications`, `scoringConfiguration`

**InterviewSession** (Interview Instances)
- `id`, `candidateId`, `applicationId`, `videoUrl`, `recordingStartedAt`, `finalScore`
- `status` (String, untyped — default `"IN_PROGRESS"`, convention: `"IN_PROGRESS"` | `"COMPLETED"` | `"PROCESSING"` | `"ABANDONED"`)
- Relations: `telemetryData`, `messages`, `iterations`, `externalToolUsages`, `categoryContributions`

**TelemetryData** (Evaluation Results)
- `id`, `interviewSessionId`, `matchScore`, `confidence`, `story`
- Relations: `backgroundSummary`, `codingSummary`, `workstyleMetrics`, `evidenceClips`, `videoChapters`

**CategoryContribution** (Real-Time Evaluations)
- `id`, `interviewSessionId`, `categoryName`, `timestamp`
- `codeChange`, `explanation`, `contributionStrength` (0-100), `caption`
- Used for both experience and coding categories

**BackgroundSummary** (Experience Evaluation)
- `id`, `telemetryDataId`
- **`experienceCategories`** (Json): Aggregated scores per category
- `executiveSummary`, `executiveSummaryOneLiner`, `recommendation`
- `conversationJson`, `evidenceJson`

**CodingSummary** (Coding Evaluation)
- `id`, `telemetryDataId`
- **`jobSpecificCategories`** (Json): Aggregated scores per category
- `codeQualityScore`, `codeQualityText`, `finalCode`, `codeQualityAnalysis`
- `executiveSummary`, `recommendation`

**WorkstyleMetrics** (Behavioral Metrics)
- `id`, `telemetryDataId`
- `aiAssistUsage` (AI Accountability score), `externalToolUsage`, `refactorCleanups`

**ScoringConfiguration** (Per-Job Weights)
- `id`, `jobId`
- `experienceWeight`, `codingWeight` (main dimensions, sum to 100)
- `aiAssistWeight` (part of coding score, default 25%)

**EvidenceClip** (Video Evidence)
- `id`, `telemetryDataId`, `title`, `thumbnailUrl`, `duration`, `description`
- `startTime`, `category` (enum), `categoryName`, `contributionStrength`

**InterviewContent** (Shared Interview Script)
- `id`, `companyId`, `openingMessage`, `codingTask`, `referenceCode`
- Relations: `jobs`, `company`

**VideoChapter** (Video Timeline Segments)
- `id`, `telemetryDataId`, `title`, `startTime`, `endTime`, `category`
- Relations: `captions`

**VideoCaption** (Chapter Captions)
- `id`, `videoChapterId`, `text`, `startTime`, `endTime`

**ConversationMessage** (Persisted Chat Messages)
- `id`, `interviewSessionId`, `speaker`, `text`, `timestamp`

**Iteration** (Code Submission Snapshots)
- `id`, `interviewSessionId`, `code`, `output`, `matchPercentage`, `timestamp`
- Used for problem-solving evaluation; `matchPercentage` tracks output correctness

**BackgroundEvidence** (Background Stage Evidence Clips)
- `id`, `telemetryDataId`, `categoryName`, `contributionStrength`, `caption`, `videoOffset`

**GapAnalysis** / **Gap** (Coding Skill Gap Analysis)
- `GapAnalysis`: `id`, `telemetryDataId`, `summary`
- `Gap`: `id`, `gapAnalysisId`, `skillArea`, `description`, `severity`

### Schema Highlights

**Dynamic Categories (Job Model):**
```json
{
  "codingCategories": [
    {"name": "TypeScript Proficiency", "description": "...", "weight": 33},
    {"name": "React Best Practices", "description": "...", "weight": 33},
    {"name": "Performance Optimization", "description": "...", "weight": 34}
  ],
  "experienceCategories": [
    {"name": "Technical Depth", "description": "...", "weight": 40},
    {"name": "System Design", "description": "...", "weight": 30},
    {"name": "Communication", "description": "...", "weight": 30}
  ]
}
```

**Aggregated Scores (CodingSummary):**
```json
{
  "jobSpecificCategories": {
    "TypeScript Proficiency": {
      "score": 85,
      "text": "Strong type safety usage...",
      "description": "Type safety, interfaces, generics",
      "evidenceLinks": [1245, 1892, 2103],  // Video timestamps
      "contributions": [
        {"timestamp": "2024-01-15T10:23:45Z", "strength": 80, "explanation": "..."},
        {"timestamp": "2024-01-15T10:25:12Z", "strength": 90, "explanation": "..."}
      ]
    }
  }
}
```

**EvidenceCategory Enum:**
```prisma
enum EvidenceCategory {
  AI_ASSIST_USAGE          // Paste detection Q&A
  EXTERNAL_TOOL_USAGE      // Legacy paste detection
  JOB_SPECIFIC_CATEGORY    // Coding category contributions
  EXPERIENCE_CATEGORY      // Background category contributions
}
```

---

## State Management

### Redux Architecture

**Store Location:** `shared/state/store.ts`

**Slices:**
1. **interviewSlice** - Interview stage and session metadata
2. **backgroundSlice** - Background stage messages, timer, category tracking
3. **codingSlice** - Coding stage messages and paste evaluation
4. **cpsSlice** - Candidate Profile Summary state
5. **navigationSlice** - App navigation state

### Interview State

```typescript
interface InterviewState {
  isRecording: boolean;
  stage: InterviewStage | null;
  candidateName?: string;
  companyName?: string;
  companySlug?: string;
  roleSlug?: string;
  sessionId?: string;
  userId?: string;
  applicationId?: string;
  script?: any;
  preloadedFirstQuestion?: string;
  preloadedFirstIntent?: string;
  shouldReset?: boolean;
}
```

### Background Slice

**Location:** `shared/state/slices/backgroundSlice.ts`

```typescript
interface BackgroundState {
  messages: ChatMessage[];
  startedAtMs?: number;
  timeboxMs?: number;
  transitioned: boolean;
  transitionedAt?: number;
  reason?: "timebox";
  // Category tracking for dynamic prioritization
  evaluatingAnswer: boolean;
  currentFocusTopic: string | null;
  currentQuestionTarget: { question: string; category: string } | null;
  categoryStats: CategoryStats[];
  currentQuestionSequence: number;
  clarificationRetryCount: number;
}
```

### Coding Slice

**Location:** `shared/state/slices/codingSlice.ts`

```typescript
interface CodingState {
  messages: ChatMessage[];
  pendingReply: boolean;
  timeboxSeconds?: number;
  activePasteEvaluation?: {
    pasteEvaluationId: string;
    pastedContent: string;
    timestamp: number;
    pasteAccountabilityScore: number;
    answerCount: number;
    readyToEvaluate: boolean;
    currentQuestion?: string;
    evaluationReasoning?: string;
    evaluationCaption?: string;
    accountabilityScore?: number;
    questionScores?: Array<{
      question: string;
      answer: string;
      score: number;
      reasoning: string;
      understandingLevel: string;
      topicsAddressed?: string[];
    }>;
    topics?: Array<{
      name: string;
      description: string;
      percentage: number;
      lastUpdatedBy?: number;
    }>;
  };
}
```

### Actions & Reducers

**Interview Machine Actions:**
- `start()` - Initialize interview with candidate name
- `setCompanyContext()` - Set company/role metadata
- `setSessionId()` - Link to interview session
- `setRecording()` - Update recording state
- `setStage()` - Transition interview stage
- `setPreloadedData()` - Set userId, applicationId, script, preloadedFirstQuestion, preloadedFirstIntent atomically
- `end()` - Set stage to "wrapup"
- `reset()` - Reset all fields to initial state
- `triggerReset()` - Set shouldReset flag (triggers coordinated reset)
- `resetInterview()` - Global reset action (listened by all slices via extraReducers)

**Background Actions:**
- `addMessage()` - Add message to background chat
- `clear()` - Clear background messages
- `startTimer()` - Start background timer
- `setTimebox()` - Set timer limit
- `forceTimeExpiry()` - Force timer expiration
- `markTransition()` - Mark transition to coding
- `setReason()` - Set transition reason
- `resetAll()` - Full background state reset
- `setEvaluatingAnswer()` - Lock/unlock during answer evaluation
- `setCurrentFocusTopic()` - Set active category topic
- `setCurrentQuestionTarget()` - Set target question for current turn
- `initializeCategoryStats()` - Seed category stats from job config
- `updateCategoryStats()` - Update contribution count/score per category
- `incrementDontKnowCount()` - Track IDK responses per category
- `incrementQuestionSequence()` - Advance question counter
- `incrementClarificationRetry()` / `resetClarificationRetry()` - Manage clarification retries

**Coding Actions:**
- `addMessage()` - Add message to coding chat
- `clear()` - Clear coding messages
- `setPendingReply()` - Lock/unlock input during AI processing
- `setTimebox()` - Set coding timer duration (seconds)
- `startPasteEvaluation()` - Initialize paste accountability Q&A
- `clearPasteEvaluation()` - Clear active paste evaluation
- `updatePasteTopics()` - Update topic coverage scores
- `updatePasteQuestionScores()` - Record per-question scores
- `setPasteEvaluationSummary()` - Store final accountability summary
- `incrementPasteAnswer()` / `setPasteQuestion()` / `setPasteScore()` / `setPasteReadyToEvaluate()` - Granular paste state updates

---

## Evaluation Pipeline

### Background Stage Evaluation

**Step 1: Real-Time Answer Evaluation**
- **API:** `/api/interviews/evaluate-answer`
- **Trigger:** User submits answer
- **Process:**
  1. Fetch job's `experienceCategories`
  2. Build OpenAI prompt with categories and conversation context
  3. Call OpenAI Chat Completions with JSON schema
  4. OpenAI evaluates answer against ALL categories
  5. Returns array of evaluations (accepted + rejected)
  6. Accepted evaluations → Create `CategoryContribution` records
  7. All evaluations returned to frontend for debug panel

**OpenAI Prompt Structure:**
```typescript
systemPrompt: `
You are evaluating a candidate's answer in a technical interview.

Experience Categories:
${categories.map(c => `- ${c.name}: ${c.description}`).join('\n')}

Question: ${question}
Answer: ${answer}

For EACH category, evaluate:
- Does the answer demonstrate this capability?
- Contribution strength (0-100)
- Accept or reject
- Reasoning

Return JSON with evaluations array.
`
```

**Step 2: Gate Check**
- **Location:** `shared/services/backgroundInterview/useBackgroundAnswerHandler.ts`
- **Checks:**
  - All categories have at least 1 contribution
  - Overall weighted average ≥ 75%
  - Minimum contribution count threshold
- **Result:** `{ gateSatisfied: boolean, reason: string }`

**Step 3: Summary Generation**
- **API:** `/api/interviews/session/[sessionId]/background-summary`
- **Trigger:** Background stage completes
- **Process:**
  1. Fetch all `CategoryContribution` records for session
  2. Group by category name
  3. Calculate average contribution strength per category
  4. Build OpenAI prompt with all contributions
  5. Generate executive summary (2-3 paragraphs)
  6. Generate one-liner summary
  7. Generate recommendation (STRONG_YES, YES, MAYBE, NO)
  8. Store in `BackgroundSummary` record

### Coding Stage Evaluation

**Step 1: Real-Time Code Diff Evaluation**
- **API:** `/api/interviews/evaluate-code-change`
- **Trigger:** 8 seconds of coding inactivity (configurable)
- **Process:**
  1. Check Monaco editor for syntax errors → Skip if errors present
  2. Generate diff (previousCode → currentCode)
  3. Fetch job's `codingCategories`
  4. Call OpenAI with previousCode, diff, currentCode, categories
  5. OpenAI evaluates diff against ALL categories
  6. Returns array of evaluations (accepted + rejected)
  7. Accepted evaluations → Create `CategoryContribution` + `EvidenceClip`
  8. All evaluations stored in Redux for debug panel

**OpenAI Prompt Strategy:**
```typescript
systemPrompt: `
You are a strict technical evaluator.

CODE BEFORE CHANGES:
${previousCode}

CHANGES MADE (diff):
${diff}

CODE AFTER CHANGES:
${currentCode}

Categories to evaluate:
${categories.map(c => `- ${c.name}: ${c.description}`).join('\n')}

ONLY credit NEW code in the + lines of the diff.
REJECT gibberish, incomplete syntax, or trivial changes.

Return JSON with evaluations array.
`
```

**Step 2: Final Code Evaluation (Legacy)**
- **API:** `/api/interviews/evaluate-job-specific-coding`
- **Trigger:** User clicks "Submit Code"
- **Process:** (Still used for "Test Evaluation" button)

**Step 3: Coding Summary Generation**
- **API:** `/api/interviews/session/[sessionId]/coding-summary-update`
- **Trigger:** Coding stage completes
- **Process:**
  1. Fetch all `CategoryContribution` records for session
  2. Group by category name
  3. Calculate average contribution strength per category
  4. Extract evidence links (video timestamps)
  5. Generate code quality analysis via OpenAI
  6. Calculate `codeQualityScore` (average of all categories)
  7. Store in `CodingSummary` record with enriched `jobSpecificCategories`

### Paste Detection Evaluation (3-Phase)

**Phase 1: Identify Topics**
- **API:** `/api/interviews/identify-paste-topics`
- **Input:** Pasted code + coding task
- **Output:** Up to 4 key concepts with initial question

**Phase 2: Q&A Scoring**
- **API:** `/api/interviews/evaluate-paste-accountability`
- **Input:** Question, answer, topics, pasted code
- **Output:** Answer score (0-100), updated topics, next question or conclude

**Phase 3: Generate Summary**
- **API:** `/api/interviews/generate-paste-summary`
- **Input:** Topics with coverage scores, Q&A history
- **Output:** Overall assessment text, average accountability score

---

## Scoring System

### Score Architecture

```
                      Final Score (0-100)
                            |
        ┌───────────────────┴───────────────────┐
        |                                       |
  Experience Score                       Coding Score
  (50% default)                         (50% default)
        |                                       |
  ┌─────┴─────┐                     ┌───────────┴──────────┐
  |     |     |                     |                      |
Cat1 Cat2 Cat3              Job-Specific Cats      AI Accountability
(weights)                    (75% default)           (25% default)
```

### Formulas

**Final Score:**
```typescript
finalScore = (
  (experienceScore × experienceWeight) +
  (codingScore × codingWeight)
) / (experienceWeight + codingWeight)
```

**Experience Score:**
```typescript
experienceScore = sum(
  category[i].score × category[i].weight
) / sum(category[i].weight)
```

**Coding Score:**
```typescript
// categories weighted average, scaled by (100 - aiAssistWeight)%
const categoryAverage = sum(category[i].score * category[i].weight) / sum(category[i].weight);
const categoryContribution = categoryAverage * (100 - aiAssistWeight) / 100;

// AI assist contributes its percentage of the final coding score
const aiAssistContribution = hasAiAssistScore
  ? normalizedAiAssist * aiAssistWeight / 100
  : 0;

const codingScore = categoryContribution + aiAssistContribution;
// e.g. aiAssistWeight=25: categories → 75% of score, AI assist → 25%
```

### Per-Category Score Calculation

**Simple Averaging:**
```typescript
categoryScore = sum(contributionStrengths) / contributionCount
```

**Rationale:** No quality weighting because:
- For background: No objective signal for answer quality separate from strength
- For coding: All accepted code changes are meaningful contributions
- Simplicity over complexity (can refine later with ML)

### Score Ranges

**Final Score Color Coding:**
- **75-100:** Green (Excellent) - Strong hire signal
- **50-74:** Amber (Good) - Consider for next round
- **0-49:** Red (Needs Improvement) - Likely reject

### Weight Configuration

**Default Weights:**
```typescript
experienceWeight = 50%
codingWeight = 50%
aiAssistWeight = 25%  // Part of coding score
```

**Job-Specific Category Weights:**
- Must sum to 100% within dimension
- Configurable via job edit form
- Validated client-side and server-side

**Example:**
```json
{
  "experienceCategories": [
    {"name": "Technical Depth", "weight": 40},
    {"name": "System Design", "weight": 30},
    {"name": "Communication", "weight": 30}
  ],
  "codingCategories": [
    {"name": "TypeScript", "weight": 33},
    {"name": "React", "weight": 33},
    {"name": "Performance", "weight": 34}
  ],
  "scoringConfiguration": {
    "experienceWeight": 50,
    "codingWeight": 50,
    "aiAssistWeight": 25
  }
}
```

### Edge Cases

**Missing Data:**
- No background summary → `experienceScore = null`, use 100% coding
- No coding summary → `codingScore = null`, use 100% experience
- No paste events → `aiAssistAccountability = null`, exclude from calculation
- No category contributions → Category score = 0 (valid, not missing)

**Zero vs Null:**
- `0` = Poor performance (valid data)
- `null` = Missing data (exclude from calculation)

---

## API Design

### REST Conventions

**URL Structure:**
- `/api/{resource}/{id}/{action}`
- Example: `/api/interviews/session/abc123/background-summary`

**HTTP Methods:**
- `GET` - Fetch data
- `POST` - Create or trigger evaluation
- `PATCH` - Update existing record
- `DELETE` - Remove record

**Response Format:**
```typescript
// Success
{
  "data": { ... },
  "message": "Success message"
}

// Error
{
  "error": "Error message",
  "details": { ... }  // Optional
}
```

### Key Endpoints

**Interview Session Management:**
- `POST /api/interviews/session` - Initialize new session
- `GET /api/interviews/session/[sessionId]` - Fetch session details
- `PATCH /api/interviews/session/[sessionId]` - Update session
- `POST /api/interviews/session/[sessionId]/messages` - Save message
- `GET /api/interviews/session/[sessionId]/contributions` - Fetch contribution stats
- `POST /api/interviews/session/[sessionId]/process` - Trigger post-interview processing
- `POST /api/interviews/session/[sessionId]/terminate` - Terminate session
- `PATCH /api/interviews/session/[sessionId]/update-recording-start` - Save recording start timestamp
- `GET /api/interviews/session/[sessionId]/background-evidence` - Fetch background evidence clips
- `GET /api/interviews/session/[sessionId]/background-chapters` - Fetch background video chapters
- `GET /api/interviews/session/[sessionId]/code-quality-analysis` - Fetch code quality results
- `GET /api/interviews/session/[sessionId]/external-tools` - Fetch external tool usage records
- `GET /api/interviews/session/[sessionId]/iterations` - Fetch code iteration records
- `POST /api/interviews/session/[sessionId]/paste-chapter` - Create paste video chapter
- `GET /api/interviews/session/[sessionId]/scoring-config` - Fetch scoring config for session
- `POST /api/interviews/session/blob-upload-url` - Get signed Vercel Blob upload URL
- `POST /api/interviews/session/screen-recording` - Store screen recording URL
- `POST /api/interviews/session/telemetry` - Initialize telemetry record

**Real-Time Evaluation:**
- `POST /api/interviews/evaluate-answer` - Background answer evaluation (full)
- `POST /api/interviews/evaluate-answer-fast` - Background answer evaluation (fast parallel path)
- `POST /api/interviews/evaluate-code-change` - Coding diff evaluation
- `POST /api/interviews/evaluate-paste-accountability` - Paste Q&A scoring
- `POST /api/interviews/evaluate-job-specific-coding` - Final code submission evaluation
- `POST /api/interviews/evaluate-output` - Code output correctness evaluation
- `POST /api/interviews/identify-paste-topics` - Extract key concepts from pasted code
- `POST /api/interviews/next-question` - Generate next interview question
- `POST /api/interviews/score-answer` - Score a candidate answer
- `POST /api/interviews/chat` - General chat completions
- `POST /api/interviews/integration` - Interview integration webhook

**Summary Generation:**
- `POST /api/interviews/session/[sessionId]/background-summary` - Generate experience summary
- `PATCH /api/interviews/session/[sessionId]/coding-summary-update` - Generate coding summary
- `POST /api/interviews/generate-paste-summary` - Generate paste accountability summary
- `POST /api/interviews/generate-coding-gaps` - Generate skill gap analysis for coding
- `POST /api/interviews/generate-coding-summary` - Generate coding summary text
- `POST /api/interviews/generate-profile-story` - Generate candidate profile story (280 chars)

**Video:**
- `GET /api/interviews/video-chapter/[chapterId]/caption` - Fetch chapter caption
- `POST /api/interviews/warmup/activate` - Warm up interview session

**Company Dashboard:**
- `GET /api/company/jobs/with-applicants` - Job list with stats
- `GET /api/company/jobs/[jobId]/applicants` - Applicant list
- `GET /api/company/jobs/[jobId]/scoring-config` - Fetch scoring config
- `PATCH /api/company/jobs/[jobId]/scoring-config` - Update weights
- `POST /api/company/jobs/generate-categories` - AI-generate job categories from description

**Candidate:**
- `GET /api/candidates/[id]/telemetry` - Fetch full evaluation data
- `GET /api/candidates/[id]/basic` - Candidate basic profile

**Utilities:**
- `POST /api/tts` - Text-to-speech synthesis
- `POST /api/transcribe` - Audio transcription (whisper-1)
- `POST /api/mascot/visemes-audio` - Mascot lip-sync visemes
- `DELETE /api/cache/clear` - Clear server-side cache
- `GET /api/debug/*` - Debug utilities (dev only)

### Error Handling

**Standard Errors:**
- `400` - Bad Request (validation failed)
- `401` - Unauthorized (missing auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

**Logging:**
- All errors logged via logger service
- Include session ID, user ID, request details
- No sensitive data in logs (PII redacted)

---

## Security & Performance

### Authentication

**NextAuth Integration:**
- Session-based authentication
- Email/password + OAuth providers
- JWT tokens for API calls
- Role-based access control (CANDIDATE, COMPANY, ADMIN)

**API Protection:**
```typescript
// Middleware example
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Authorization

**Role Checks:**
- Candidates can only access own interview sessions
- Companies can only view applicants for their jobs
- Admins have full access

### Data Privacy

**PII Handling:**
- Video recordings stored securely in Vercel Blob
- Access URLs are time-limited
- Conversation data redacted from logs
- GDPR compliance (data deletion on request)

### Performance Optimizations

**Caching Strategy:**
- Job definitions cached in interview session
- Dashboard responses cacheable (5-10 min TTL)
- Static assets served via Vercel CDN

**Database Queries:**
- Prisma includes optimized for nested data
- Indexes on `interviewSessionId`, `categoryName`, `timestamp`
- Connection pooling enabled

**OpenAI Rate Limits:**
- Throttled code evaluations (8 seconds default)
- Error handling with exponential backoff
- Fallback to simplified evaluation on timeout

**Frontend Performance:**
- React Server Components for initial render
- Client Components for interactivity
- Code splitting with dynamic imports
- Monaco editor lazy-loaded

---

## Development Workflow

### Constitution Compliance

**Core Principles:**
1. **No Hidden Fallbacks** - All behavior explicit, no default values masking errors
2. **Reuse-First** - Extract shared logic immediately, no duplication
3. **Function Length ≤ 25 lines** - Break down complex functions
4. **Documentation Required** - Every file/function documented
5. **Library-First** - Prefer mature libraries over custom code
6. **Evidence-First Debugging** - Reproduce bugs with clear causality
7. **Logger Service Only** - No console.log/console.error

### Code Organization

**Directory Structure:**
```
app/
├── (auth)/                  # Auth pages (login, signup)
├── (features)/              # Feature pages
│   ├── interview/           # Interview flow (background + coding stages)
│   ├── cps/                 # Candidate profile summary
│   ├── company-dashboard/   # Company UI
│   ├── job-search/          # Job listing / search
│   ├── settings/            # User/account settings
│   └── ...
├── api/                     # API routes (see Key Endpoints section)
│   ├── interviews/          # Interview APIs
│   ├── company/             # Company APIs
│   └── ...
├── shared/                  # Next.js-specific shared code (NOT same as root /shared/)
│   ├── components/          # UI components (AtomScene, Header, Sidebar, etc.)
│   ├── contexts/            # React contexts (DebugContext, InterviewPreloadContext, etc.)
│   ├── services/            # Server-side services (Prisma, NextAuth, logger, cache)
│   ├── hooks/               # Custom React hooks
│   ├── config/              # App config (breadcrumbs, navigation)
│   └── utils/               # Pure utility functions (calculateScore, http)
└── test/                    # Dev-only test pages

shared/                      # Root-level shared (client + server-safe, framework-agnostic)
├── state/                   # Redux store
│   ├── store.ts             # Root store (configureStore)
│   └── slices/              # Redux slices (background, coding, cps, interview, navigation)
├── services/                # Client-side services (backgroundInterview, tts, mascot)
│   └── backgroundInterview/ # Background interview orchestration
├── prompts/                 # OpenAI prompt templates
├── constants/               # Shared constants
├── types/                   # Shared TypeScript types
└── utils/                   # Client-safe utility functions

server/
├── prisma/                  # Database
│   ├── schema.prisma        # Prisma schema
│   └── migrations/          # Migration files
└── db-scripts/              # Seed data scripts

docs/
├── architecture/            # System-wide design docs (this file, scoring, etc.)
├── evaluation/              # Scoring pipeline and answer judgment subsystems
├── features/                # Shipped user-facing feature docs
├── reference/               # Demos, migrations, handoffs
└── specs/                   # Planned/future integrations
```

> **Note on two `shared/` directories:** `app/shared/` is Next.js App Router-coupled (contains Prisma singleton, NextAuth, React contexts — server-only code cannot be imported by client components). Root `shared/` is framework-agnostic client+server code (Redux state, browser-safe services). They must remain separate to respect Next.js server/client boundaries.

### Development Commands

```bash
# Start dev server
pnpm dev

# Database operations
pnpm sync-db:dev         # Sync schema and seed data
pnpm seed                # Seed data only
pnpm studio              # Open Prisma Studio

# Testing
pnpm test                # Run Vitest tests
pnpm e2e                 # Run Playwright E2E tests

# Build
pnpm build               # Production build
pnpm start               # Start production server
```

### Environment Variables

**.env.local (required):**
```bash
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."

# OpenAI (server-side only — never expose to browser)
OPENAI_API_KEY="sk-..."

# Vercel Blob (video storage)
BLOB_READ_WRITE_TOKEN="..."

# Feature Flags
NEXT_PUBLIC_DEBUG_MODE="true"
NEXT_PUBLIC_CODE_EVALUATION_THROTTLE_MS="8000"
```

### Testing Strategy

**Unit Tests:**
- Vitest for business logic
- Run with `pnpm test`

**Manual Testing:**
- Debug panels for real-time inspection
- Skip-to-coding mode for rapid iteration
- Test evaluation button for instant feedback

---

## Future Roadmap

### Planned Features

**Q1 2026:**
- Real-time job criteria extraction from job description
- Aggregated minimal view for CPS (reduce noise)
- WebSocket updates for dashboard (replace polling)
- Multi-language coding support

**Q2 2026:**
- Machine learning score normalization
- Historical percentile rankings
- Category effectiveness analytics
- A/B testing for weight configurations

**Q3 2026:**
- Custom formulas per company
- Team-based scoring aggregations
- Automated weight optimization
- Integration with ATS systems

**Q4 2026:**
- Voice-only interview mode (no video)
- Mobile-optimized candidate experience
- Advanced anti-cheating measures
- Candidate feedback loop

### Technical Debt

**High Priority:**
- Migrate from polling to WebSockets for real-time updates
- Implement score caching in `TelemetryData.matchScore`
- Add Redis cache layer for dashboard responses
- Virtualize evaluation timeline for long interviews

**Medium Priority:**
- Extract reusable OpenAI client service
- Consolidate duplicate evaluation prompt logic
- Add comprehensive E2E test suite
- Implement CI/CD pipeline with automated testing

**Low Priority:**
- Migrate to Prisma 7 when stable
- Upgrade to Next.js 16 when released
- Explore edge runtime for API routes
- Add Sentry for error tracking

### Scalability Considerations

**Current Bottlenecks:**
- Dashboard score calculation on every request (O(n × m))
- OpenAI API rate limits (60 req/min per key)
- Video storage costs at scale

**Mitigation Strategies:**
- Background jobs for score pre-calculation
- Multiple OpenAI API keys with load balancing
- CDN for video delivery with compression
- Database read replicas for dashboard queries

---

## Conclusion

Sfinx is a production-ready, AI-powered technical interview platform built with modern web technologies. The architecture is designed for scalability, maintainability, and extensibility, with clear separation of concerns and comprehensive documentation.

**Key Strengths:**
- Fully autonomous interview process (no human intervention)
- Dynamic, job-specific evaluation criteria
- Real-time evaluation with video evidence
- Consistent, fair scoring across all candidates
- Extensible architecture for future enhancements

**Governance:**
- All changes must comply with Sfinx Constitution
- Feature specs required in `docs/specs/`
- Commit messages reference related documentation
- POC mode allows rapid iteration with explicit decision tracking

---

**Document Version:** 1.1.0  
**Last Updated:** January 2026  
**Maintained by:** Sfinx Engineering Team  
**Next Review:** Q2 2026
