# Sfinx System Design Document

**Version:** 1.0.0  
**Date:** January 2026  
**Status:** Production

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
│  │   (GPT-4o)       │  │   Editor     │  │   Recording API  │    │
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
- OpenAI GPT-4o (text completions)
- OpenAI Realtime API (voice conversations)
- OpenAI text-embedding-3-small (retrieval, future)

**Infrastructure:**
- Vercel (hosting)
- Vercel Blob Storage (video recordings)
- Docker (containerization, optional)
- GCP Cloud Run (deployment target, optional)

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
- `[id]/profile` - Candidate profile management

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

**Location:** `shared/state/slices/interviewMachineSlice.ts`

**States:**
```typescript
type InterviewState =
  | "idle"                          // Initial page load
  | "greeting_said_by_ai"          // AI greeted candidate
  | "background_asked_by_ai"       // Background Q&A in progress
  | "background_answered_by_user"  // User submitted answer
  | "in_coding_session"            // Coding stage active
  | "followup_question"            // Follow-up question asked
  | "ended";                       // Interview completed
```

**Transitions:**
- `greet()` → greeting_said_by_ai
- `askQuestion()` → background_asked_by_ai
- `userFinal()` → background_answered_by_user
- `aiFinal()` → Check gate, transition to coding or ask more
- `startCoding()` → in_coding_session
- `end()` → ended

**Gate Logic:**
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
Dispatch userFinal() → machine state: background_answered_by_user
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
Dispatch aiFinal() → Check gate logic
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
  ├─ Extract up to 4 key concepts from pasted code
  ├─ Generate initial probing question
  └─ Return topics array with coverageScore: 0
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
- `id`, `candidateId`, `applicationId`, `videoUrl`, `recordingStartedAt`
- `status` (IN_PROGRESS | COMPLETED)
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
1. **interviewMachineSlice** - Interview state machine
2. **conversationSlice** - Messages and chat history
3. **evaluationSlice** - Real-time contribution data

### Interview Machine State

```typescript
interface InterviewMachineState {
  state: InterviewState;
  candidateName?: string;
  companyName?: string;
  companySlug?: string;
  roleSlug?: string;
  expectedBackgroundQuestion?: string;
  userId?: string;
  applicationId?: string;
  sessionId?: string;
  script?: InterviewScript;
  preloadedFirstQuestion?: string;
  isPageLoading: boolean;
  shouldReset: boolean;
}
```

### Interview Chat Store

**Location:** `shared/state/interviewChatStore.ts`

```typescript
interface InterviewChatState {
  messages: ChatMessage[];
  isRecording: boolean;
  stage: InterviewStage;  // "background" | "coding" | "completed"
  pendingReply: boolean;
  pendingReplyContext?: {
    reason?: string;
    stage?: InterviewStage;
    since: number;
  };
  background: {
    confidence: number;  // 0-100
    transitioned: boolean;
    transitionedAt?: number;
    startedAtMs?: number;
    reason?: "timebox";
    timeboxMs?: number;
  };
  coding: {
    activePasteEvaluation?: PasteEvaluationState;
  };
}
```

### Actions & Reducers

**Machine Transitions:**
- `greet()` - AI greeted candidate
- `askQuestion()` - AI asked background question
- `userFinal()` - User submitted answer
- `aiFinal()` - AI completed response, check gate
- `startCoding()` - Transition to coding
- `forceCoding()` - Skip to coding (dev mode)
- `end()` - Interview ended

**Chat Actions:**
- `ADD_MESSAGE` - Add message to conversation
- `SET_PENDING_REPLY` - Lock/unlock input during AI processing
- `BG_INCREMENT_USELESS_ANSWERS` - Track empty answers
- `BG_RESET_USELESS_ANSWERS` - Reset counter on useful answer

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
- **Location:** `shared/services/backgroundInterview/categoryGateCheck.ts`
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
codingScore = (
  sum(codingCategory[i].score × codingCategory[i].weight) +
  (aiAssistAccountability × aiAssistWeight)
) / (sum(codingCategory[i].weight) + aiAssistWeight)
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
- `POST /api/interviews/session/create` - Initialize new session
- `GET /api/interviews/session/[sessionId]` - Fetch session details
- `PATCH /api/interviews/session/[sessionId]` - Update session
- `POST /api/interviews/session/[sessionId]/messages` - Save message
- `GET /api/interviews/session/[sessionId]/contributions` - Fetch contribution stats

**Real-Time Evaluation:**
- `POST /api/interviews/evaluate-answer` - Background answer evaluation
- `POST /api/interviews/evaluate-code-change` - Coding diff evaluation
- `POST /api/interviews/evaluate-paste-accountability` - Paste Q&A scoring

**Summary Generation:**
- `POST /api/interviews/session/[sessionId]/background-summary` - Generate experience summary
- `PATCH /api/interviews/session/[sessionId]/coding-summary-update` - Generate coding summary
- `POST /api/interviews/generate-paste-summary` - Generate paste accountability summary

**Company Dashboard:**
- `GET /api/company/jobs/with-applicants` - Job list with stats
- `GET /api/company/jobs/[jobId]/applicants` - Applicant list
- `GET /api/company/jobs/[jobId]/scoring-config` - Fetch scoring config
- `PATCH /api/company/jobs/[jobId]/scoring-config` - Update weights

**Candidate Telemetry:**
- `GET /api/candidates/[id]/telemetry` - Fetch full evaluation data

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
│   ├── interview/           # Interview flow
│   ├── cps/                 # Candidate profile summary
│   ├── company-dashboard/   # Company UI
│   └── ...
├── api/                     # API routes
│   ├── interviews/          # Interview APIs
│   ├── company/             # Company APIs
│   └── ...
├── shared/                  # Shared components/services
│   ├── components/          # UI components
│   ├── services/            # Business logic services
│   ├── hooks/               # Custom React hooks
│   └── utils/               # Pure utility functions
└── data/                    # Mock data (dev only)

shared/
├── state/                   # Redux store
│   ├── store.ts             # Root store
│   └── slices/              # Redux slices
├── services/                # Backend-compatible services
├── prompts/                 # OpenAI prompt templates
└── types/                   # Shared TypeScript types

server/
├── prisma/                  # Database
│   ├── schema.prisma        # Prisma schema
│   └── migrations/          # Migration files
└── db-scripts/              # Seed data scripts

docs/
├── system-design.md         # THIS FILE
├── scoring-system.md
├── job-specific-coding-categories.md
├── external-tool-evaluation.md
└── ...
```

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

# OpenAI
NEXT_PUBLIC_OPENAI_API_KEY="sk-..."

# Vercel Blob (video storage)
BLOB_READ_WRITE_TOKEN="..."

# Feature Flags
NEXT_PUBLIC_DEBUG_MODE="true"
NEXT_PUBLIC_CODE_EVALUATION_THROTTLE_MS="8000"
```

### Testing Strategy

**Unit Tests:**
- Vitest for business logic
- Located in `shared/tests/`
- Coverage target: ≥ 60%

**E2E Tests:**
- Playwright for interview flows
- Located in `e2e/`
- Includes background and coding stages

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

**Document Version:** 1.0.0  
**Last Updated:** January 2026  
**Maintained by:** Sfinx Engineering Team  
**Next Review:** Q2 2026
