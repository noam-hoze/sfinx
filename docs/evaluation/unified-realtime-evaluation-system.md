# Unified Real-Time Evaluation System

**Version:** 1.0.0  
**Date:** January 2026  
**Status:** Implemented

## Overview

The unified real-time evaluation system provides a consistent debugging and monitoring experience across both the **background interview stage** (experience evaluation) and the **coding stage** (technical skills evaluation). Despite evaluating different aspects of candidates through different mechanisms, both stages share a common architectural pattern and UI presentation layer.

This document describes the architecture, implementation, and design principles behind the unified system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Design Principles](#core-design-principles)
3. [Shared Components](#shared-components)
4. [Background Stage Evaluation](#background-stage-evaluation)
5. [Coding Stage Evaluation](#coding-stage-evaluation)
6. [Data Flow](#data-flow)
7. [UI Components](#ui-components)
8. [Implementation Details](#implementation-details)
9. [Testing and Debugging](#testing-and-debugging)

---

## Architecture Overview

### High-Level Structure

```
┌─────────────────────────────────────────────────────────────┐
│                   Debug Panel Layer                          │
│  (BackgroundDebugPanel / CodingEvaluationDebugPanel)        │
│                                                              │
│  ┌────────────────┐        ┌────────────────┐              │
│  │ Data Fetching  │        │  Transformers  │              │
│  │ & State Mgmt   │   →    │  (Stage-Specific)│             │
│  └────────────────┘        └────────────────┘              │
│                                    ↓                         │
│              ┌──────────────────────────────────┐           │
│              │ RealTimeContributionsView        │           │
│              │ (Shared Presentation Component)  │           │
│              └──────────────────────────────────┘           │
│                          ↓                                   │
│              ┌──────────────────────────────────┐           │
│              │   Context Components             │           │
│              │   - QuestionAnswerContext        │           │
│              │   - CodeDiffContext              │           │
│              └──────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Key Layers

1. **Parent Debug Panels** - Stage-specific components that manage data fetching and state
2. **Data Transformers** - Convert stage-specific data into a common format
3. **Shared Presentation Layer** - Pure React components that render evaluation data
4. **Context Components** - Pluggable components that display stage-specific evaluation context

---

## Core Design Principles

### 1. Separation of Concerns

**Data Layer (Parent Components)**
- Responsible for fetching data from APIs or Redux state
- Manages real-time polling and updates
- Handles stage-specific business logic
- Transforms raw data into the common format

**Presentation Layer (Shared Components)**
- Pure presentational components
- No data fetching or business logic
- Accepts normalized props
- Renders consistent UI across stages

### 2. Modular Design

Components are designed to be composable and reusable:
- `RealTimeContributionsView` is stage-agnostic
- Context components are pluggable (Q&A vs Code Diff)
- Transformers encapsulate stage-specific logic

### 3. Data Normalization

Both stages transform their data into a common interface:

```typescript
interface RealTimeContributionsViewProps {
    summaryStats: SummaryStats;
    categoryBreakdown: CategoryBreakdownItem[];
    evaluations: EvaluationItem[];
    emptyStateMessage?: string;
}
```

This allows the same presentation component to render both background and coding evaluations.

---

## Shared Components

### RealTimeContributionsView

**Location:** `app/shared/components/debug/RealTimeContributionsView.tsx`

**Purpose:** Pure presentation component that renders real-time evaluation data in a consistent format.

**Props Interface:**

```typescript
interface SummaryStats {
    totalEvaluations: number;      // Total number of evaluations performed
    totalContributions: number;     // Total accepted contributions
    categoriesHit: number;          // Number of distinct categories with contributions
    nextEvaluation?: string;        // Optional: countdown to next evaluation (coding only)
}

interface CategoryBreakdownItem {
    name: string;                   // Category name
    avgStrength: number;            // Average strength (0-100)
    contributionCount: number;      // Number of contributions
    contributions: Array<{          // Individual contributions
        strength: number;
        explanation: string;
        timestamp: string;
    }>;
}

interface EvaluationItem {
    timestamp: string;              // When evaluation occurred
    contributionsCount: number;     // Accepted contributions count
    contextContent: React.ReactNode; // Stage-specific context (Q&A or Code)
    categoryEvaluations: Array<{    // All evaluations (accepted + rejected)
        category: string;
        strength: number;
        accepted: boolean;
        reasoning: string;
        caption?: string;
    }>;
}
```

**UI Structure:**

1. **Summary Stats (4-card grid)**
   - Total Evaluations (green)
   - Total Contributions (blue)
   - Categories Hit (purple)
   - Next Evaluation (orange, coding only)

2. **Category Breakdown (purple box)**
   - Each category shown with average strength
   - Progress bar visualization
   - Expandable details showing all contributions

3. **Evaluation Timeline (expandable cards)**
   - Chronological list of all evaluations
   - Stage-specific context (Q&A or Code Diff)
   - All category evaluations with accepted/rejected status
   - Full reasoning displayed for each evaluation

---

## Background Stage Evaluation

### Overview

The background stage evaluates candidate **experience** through conversational Q&A. OpenAI evaluates each answer against job-defined experience categories in real-time.

### Data Sources

1. **API Polling:** `/api/interviews/session/[sessionId]/contributions`
   - Fetches aggregated contribution stats every 3 seconds
   - Returns category-level summaries

2. **In-Memory State:** `realtimeEvaluations` array
   - Passed from parent `interview/page.tsx`
   - Contains all raw evaluations from OpenAI
   - Includes question, answer, and evaluation results

### Data Transformer

**Location:** `app/shared/components/debug/transformers/backgroundDataTransformer.tsx`

**Function:** `transformBackgroundDataToRealtime(contributionStats, realtimeEvaluations)`

**Responsibilities:**
- Computes summary stats from API-provided data
- Maps contribution stats to category breakdown format
- Wraps each evaluation with `QuestionAnswerContext` component
- No `nextEvaluation` field (background doesn't throttle)

### Context Component

**QuestionAnswerContext** (`app/shared/components/debug/contexts/QuestionAnswerContext.tsx`)

Displays the interview Q&A in a 2-column layout:
- Left column: Question text
- Right column: Candidate's answer

### Evaluation Flow

```
User answers question
    ↓
useBackgroundAnswerHandler calls /api/interviews/evaluate-answer
    ↓
OpenAI evaluates answer against ALL experience categories
    ↓
Response includes EVERY evaluation (accepted + rejected)
    ↓
Accepted evaluations → CategoryContribution records created
    ↓
All evaluations → Stored in realtimeEvaluations state
    ↓
BackgroundDebugPanel polls /contributions API
    ↓
Transformer combines API stats + in-memory evaluations
    ↓
RealTimeContributionsView renders unified UI
```

### Category Configuration

Experience categories are defined per job:

```typescript
interface ExperienceCategory {
    name: string;          // e.g., "React Application Architecture at Scale"
    description: string;   // What the category measures
    weight: number;        // Relative importance (sums to 100)
    example?: string;      // Example evidence OpenAI should look for
}
```

Stored in `Job.experienceCategories` (JSON field).

### Scoring Algorithm

**Simple Averaging:** All accepted contributions for a category are averaged equally.

```typescript
// For each category:
avgStrength = sum(contributionStrengths) / contributionCount
```

No quality weights are used because there's no objective signal for answer quality separate from the strength score itself.

---

## Coding Stage Evaluation

### Overview

The coding stage evaluates candidate **technical skills** by analyzing code changes in real-time. OpenAI evaluates code diffs against job-specific coding categories.

### Data Sources

1. **Redux State:** `evaluationData.realtimeContributions`
   - Stored in interview Redux slice
   - Contains all code evaluation requests and responses
   - Updated on each evaluation cycle

2. **No API Polling:** All data is already in memory

### Data Transformer

**Location:** `app/(features)/interview/components/debug/transformers/codingDataTransformer.tsx`

**Function:** `transformCodingDataToRealtime(realtimeContributions, nextEvaluationTime, evaluationThrottleMs)`

**Responsibilities:**
- Computes all stats client-side from in-memory data
- Groups contributions by category to build breakdown
- Calculates countdown for next evaluation
- Wraps each evaluation with `CodeDiffContext` component
- Includes `nextEvaluation` countdown string

### Context Component

**CodeDiffContext** (`app/(features)/interview/components/debug/contexts/CodeDiffContext.tsx`)

Displays code evaluation context in a 2-column layout:
- Left column: Code diff sent to OpenAI
- Right column: Full current code sent to OpenAI

### Evaluation Flow

```
User types code (Monaco editor)
    ↓
Throttle: Wait for N seconds of inactivity (configurable)
    ↓
Code evaluation triggered
    ↓
evaluate-code-change API called with diff + full code
    ↓
OpenAI evaluates against ALL coding categories
    ↓
Response includes EVERY evaluation (accepted + rejected)
    ↓
Accepted evaluations → CategoryContribution records created
    ↓
All evaluations → Stored in Redux evaluationData.realtimeContributions
    ↓
Transformer computes stats from Redux data
    ↓
RealTimeContributionsView renders unified UI
```

### Category Configuration

Coding categories are defined per job:

```typescript
interface CodingCategory {
    name: string;          // e.g., "TypeScript Proficiency"
    description: string;   // What the category measures
    weight: number;        // Relative importance (sums to 100)
}
```

Stored in `Job.codingCategories` (JSON field).

### Scoring Algorithm

**Simple Averaging:** All accepted contributions for a category are averaged equally (same as background).

### Throttling

Coding evaluations are throttled to avoid excessive API calls:
- Default: 8 seconds of inactivity
- Configurable via `EVALUATION_THROTTLE_MS`
- Countdown displayed in debug panel

---

## Data Flow

### Background Stage Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ interview/page.tsx                                           │
│  - Stores realtimeEvaluations in state                      │
│  - Passes to BackgroundDebugPanel                           │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ BackgroundDebugPanel                                         │
│  - Polls /contributions API every 3s                         │
│  - Receives contributionStats (aggregated)                   │
│  - Has realtimeEvaluations (detailed)                        │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ backgroundDataTransformer                                    │
│  - Combines API stats + in-memory evaluations               │
│  - Wraps with QuestionAnswerContext                         │
│  - Returns normalized props                                  │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ RealTimeContributionsView                                    │
│  - Renders summary stats                                     │
│  - Renders category breakdown                                │
│  - Renders evaluation timeline                               │
└──────────────────────────────────────────────────────────────┘
```

### Coding Stage Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Redux Store (evaluationData)                                │
│  - Stores realtimeContributions array                       │
│  - Updated on each evaluation cycle                          │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ CodingEvaluationDebugPanel                                   │
│  - Reads from Redux                                          │
│  - Tracks nextEvaluationTime                                 │
│  - Passes to transformer                                     │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ codingDataTransformer                                        │
│  - Computes all stats client-side                           │
│  - Wraps with CodeDiffContext                               │
│  - Calculates countdown                                      │
│  - Returns normalized props                                  │
└───────────────────────┬──────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────────┐
│ RealTimeContributionsView                                    │
│  - Renders summary stats (with countdown)                    │
│  - Renders category breakdown                                │
│  - Renders evaluation timeline                               │
└──────────────────────────────────────────────────────────────┘
```

---

## UI Components

### Summary Stats Cards

**Purpose:** Quick overview of evaluation activity

**Layout:** Grid of 3-4 cards
- Background: 3 cards (no countdown)
- Coding: 4 cards (includes countdown)

**Color Coding:**
- Green: Total Evaluations
- Blue: Total Contributions (accepted only)
- Purple: Categories Hit
- Orange: Next Evaluation (coding only)

### Category Breakdown

**Purpose:** Aggregate view of contributions per category

**Visual Elements:**
- Purple-themed box for consistency
- Category name and average strength score
- Progress bar (0-100%)
- Contribution count
- Expandable details showing all individual contributions

**Interaction:**
- Click "View all contributions" to expand
- Shows timestamp, strength, and explanation for each

### Evaluation Timeline

**Purpose:** Chronological view of every evaluation OpenAI performed

**Structure:**
- Expandable card for each evaluation
- Summary line: Evaluation # + timestamp + contributions count
- Expanded view shows:
  - Context section (Q&A or Code Diff)
  - All category evaluations (both accepted and rejected)

**Accepted vs Rejected Display:**
- Accepted: Green background, "ACCEPTED" badge
- Rejected: Red background, "REJECTED" badge
- Both show: strength score, reasoning, caption (if applicable)

---

## Implementation Details

### File Structure

```
app/
├── shared/
│   └── components/
│       ├── BackgroundDebugPanel.tsx              # Background parent
│       └── debug/
│           ├── RealTimeContributionsView.tsx     # Shared view
│           ├── contexts/
│           │   └── QuestionAnswerContext.tsx     # Background context
│           └── transformers/
│               └── backgroundDataTransformer.tsx # Background transformer
└── (features)/
    └── interview/
        └── components/
            └── debug/
                ├── CodingEvaluationDebugPanel.tsx     # Coding parent
                ├── contexts/
                │   └── CodeDiffContext.tsx             # Coding context
                └── transformers/
                    └── codingDataTransformer.tsx      # Coding transformer
```

### Key Interfaces

**Common Interface (accepted by shared view):**

```typescript
interface RealTimeContributionsViewProps {
    summaryStats: SummaryStats;
    categoryBreakdown: CategoryBreakdownItem[];
    evaluations: EvaluationItem[];
    emptyStateMessage?: string;
}
```

**Background-Specific Types:**

```typescript
interface ContributionStats {
    categoryName: string;
    count: number;
    avgStrength: number;
}

interface BackgroundEvaluation {
    timestamp: string;
    question: string;
    answer: string;
    evaluations: Array<{
        category: string;
        strength: number;
        accepted: boolean;
        reasoning: string;
        caption?: string;
    }>;
}
```

**Coding-Specific Types:**

```typescript
interface CodingContribution {
    timestamp: string;
    request: {
        currentCode: string;
        diff: string;
        jobCategories: Array<{name: string; description: string}>;
    };
    response: {
        contributionsCount: number;
        contributions: Array<{
            category: string;
            strength: number;
            explanation?: string;
            caption?: string;
        }>;
        allEvaluations?: Array<{
            category: string;
            strength: number;
            accepted: boolean;
            reasoning: string;
            caption?: string;
        }>;
    };
}
```

---

## Testing and Debugging

### Debug Mode Activation

Set `NEXT_PUBLIC_DEBUG_MODE=true` in `.env.local` to enable debug panels.

### Background Stage Testing

1. Start an interview as a candidate
2. Answer background questions
3. Open debug panel (toggle button in UI)
4. Verify:
   - Summary stats update after each answer
   - Category breakdown shows correct averages
   - All evaluations (accepted + rejected) appear in timeline
   - Question/Answer displayed correctly

### Coding Stage Testing

1. Proceed to coding stage
2. Start typing code
3. Wait for evaluation throttle period
4. Open debug panel
5. Verify:
   - Countdown shows time until next evaluation
   - Code diffs displayed correctly
   - Contributions accumulate per category
   - Accepted and rejected evaluations both visible

### Common Issues

**Issue:** Categories not showing in debug panel
- **Cause:** Stale localStorage cache
- **Fix:** Bump `SCRIPT_CACHE_VERSION` in `useBackgroundPreload.ts`

**Issue:** Evaluations not appearing
- **Cause:** OpenAI not returning expected format
- **Fix:** Check API logs, verify prompt includes all categories

**Issue:** Stats out of sync
- **Cause:** Background polling interval vs evaluation timing
- **Fix:** Ensure polling interval (3s) < evaluation completion time

---

## Future Enhancements

### Potential Improvements

1. **Real-time WebSocket Updates**
   - Replace polling with WebSocket for background contributions
   - Reduce latency between evaluation and UI update

2. **Export Evaluation Data**
   - Add button to export all evaluations as JSON/CSV
   - Useful for analysis and debugging

3. **Configurable Display Options**
   - Toggle between simplified/detailed views
   - Filter by accepted/rejected/category
   - Adjust polling frequency

4. **Performance Optimizations**
   - Virtualize evaluation timeline for long interviews
   - Memoize expensive computations in transformers
   - Debounce category breakdown calculations

5. **Enhanced Visualizations**
   - Charts showing contribution trends over time
   - Category comparison radar charts
   - Strength distribution histograms

---

## Conclusion

The unified real-time evaluation system demonstrates a successful application of separation of concerns and modular design principles. By identifying the commonalities between background and coding evaluations, we created a reusable presentation layer that provides a consistent debugging experience across both stages.

The key insight was recognizing that despite different evaluation mechanisms (Q&A vs code), the *structure* of the evaluation data is identical:
- Categories with contributions
- Evaluations with accepted/rejected status
- Timestamps and reasoning

By normalizing this data through stage-specific transformers, we enabled the same UI components to render both types of evaluations, reducing code duplication and ensuring consistency.

This architecture is extensible to future evaluation types (e.g., system design, behavioral assessment) by simply creating new transformers and context components while reusing the core presentation layer.

---

**Document Version:** 1.0.0  
**Last Updated:** January 2026  
**Maintained by:** Sfinx Engineering Team
