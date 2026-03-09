# Dynamic Category Prioritization System

**Version:** 1.0.0  
**Date:** January 11, 2026  
**Status:** Implemented

---

## Overview

The Dynamic Category Prioritization System is a sophisticated question selection algorithm that guides the OpenAI interviewer to systematically gather evidence across all experience categories while maintaining natural conversational flow. The system implements a "continuity-first strategy" that prioritizes depth over breadth in the early stages, then pivots intelligently to ensure comprehensive coverage.

This document describes the complete architecture, implementation, and design principles behind the system.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Core Design Principles](#core-design-principles)
3. [Architecture Overview](#architecture-overview)
4. [Three-Phase Strategy](#three-phase-strategy)
5. [Implementation Details](#implementation-details)
6. [Data Flow](#data-flow)
7. [Race Condition Fix](#race-condition-fix)
8. [Debug Panel Integration](#debug-panel-integration)
9. [OpenAI Integration](#openai-integration)
10. [Angle-Based Repetition Prevention](#angle-based-repetition-prevention)
11. [Edge Cases](#edge-cases)

---

## Problem Statement

### Initial Issues

**Issue 1: Obsessive Topic Switching**
- OpenAI was too focused on "covering all topics" from a rigid checklist
- Switched topics after every answer, losing conversational context
- Felt robotic and disconnected - not like a real interviewer

**Issue 2: Topic Starvation**
- Some categories would get 0-1 contributions while others got 10+
- No systematic way to ensure balanced coverage
- Manual tracking required to identify gaps

**Issue 3: Stale Data**
- Category guidance was based on stale DB data (race condition)
- Evaluation API was non-blocking
- Separate DB fetch happened too early, missing latest contributions

**Issue 4: Lack of Transparency**
- No visibility into which topic OpenAI was targeting
- Difficult to verify if system was following guidance
- Debugging required manual inspection of conversation transcripts

### Requirements

1. **Natural Conversation**: Stay on a topic long enough to build depth
2. **Systematic Coverage**: Eventually cover all categories thoroughly
3. **Fresh Data**: Use real-time evaluation results for guidance
4. **Transparency**: Show current focus topic and question target
5. **Predictability**: Clear rules for when and why topic switches occur

---

## Core Design Principles

### 1. Continuity-First Strategy

**Principle**: Depth before breadth. Stay on a single topic until sufficient evidence is gathered (`CONTRIBUTIONS_TARGET` contributions, currently 3), then pivot to the next topic with the most existing evidence.

**Rationale**:
- Mimics human interviewer behavior (follow-up questions on same topic)
- Allows candidate to demonstrate expertise through related examples
- Builds rapport through coherent conversation flow
- More authentic assessment of depth vs surface-level knowledge

### 2. Data-Driven Pivoting

**Principle**: Topic switches are triggered by contribution counts reaching target threshold (`CONTRIBUTIONS_TARGET`, currently 3), not arbitrary turn counts or time limits.

**Rationale**:
- Contributions represent actual evidence gathered (strength > 0)
- Some answers may not generate contributions (irrelevant or weak responses)
- Ensures quality over quantity - need 5 strong pieces of evidence per category

### 3. Explicit State Management

**Principle**: Track current focus topic explicitly in Redux state, don't infer from conversation history.

**Rationale**:
- Single source of truth for which topic is active
- Enables debugging and visualization
- Allows manual override if needed
- Prevents drift between OpenAI's understanding and system's intent

### 4. Real-Time Evaluation Integration

**Principle**: Build category guidance immediately after each evaluation completes, using the fresh response data.

**Rationale**:
- Eliminates race conditions with separate DB fetches
- Guarantees guidance reflects latest contributions
- Reduces API calls and latency
- Simplifies data flow

---

## Architecture Overview

### High-Level Flow

```
Candidate submits answer
    ↓
Evaluate answer (await completion)
    ↓
Receive evaluation response with updated category counts
    ↓
Analyze current focus topic contribution count
    ↓
Determine phase (Continue / Pivot / Depth-Building)
    ↓
Build category guidance for OpenAI
    ↓
Add answer context (blank vs substantive)
    ↓
Send full prompt to OpenAI
    ↓
Parse JSON response (question + targetedCategory)
    ↓
Update Redux (message, currentFocusTopic, currentQuestionTarget)
    ↓
Display question to candidate
```

### Key Components

```
┌─────────────────────────────────────────────────────────────┐
│ useBackgroundAnswerHandler.ts                              │
│  - Answer submission orchestrator                          │
│  - Evaluation API integration                              │
│  - Category guidance builder                               │
│  - Focus topic state manager                               │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ /api/interviews/evaluate-answer                            │
│  - Evaluates answer against all categories                 │
│  - Returns allEvaluations + updatedCounts                  │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ backgroundSlice.ts (Redux)                                 │
│  - currentFocusTopic: string | null                        │
│  - currentQuestionTarget: {question, category}             │
│  - evaluatingAnswer: boolean                               │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ BackgroundDebugPanel.tsx                                   │
│  - Displays current focus topic                            │
│  - Shows question target with category                     │
│  - Real-time contribution counts per category              │
└─────────────────────────────────────────────────────────────┘
```

---

## Three-Phase Strategy

### Constants

```typescript
// shared/constants/interview.ts
export const CONTRIBUTIONS_TARGET = 3;  // Threshold for "sufficient evidence"
```

> **Note**: This constant is shared across backend and frontend. See [Contributions Target & Transition Logic](./contributions-target-and-transition-logic.md) for details.

### Phase 1: Topic Continuity (Most Common)

**Condition**: `currentTopicInfo.contributionsCount < CONTRIBUTIONS_TARGET`

**Behavior**: Stay on current topic, continue building evidence

**Guidance Sent to OpenAI**:
```
Focus your next question on "Production Systems and Code Quality" - continue building evidence (2/3 contributions).
```

**Example Scenario**:
- Current topic: "Production Systems and Code Quality"
- Contributions: 2
- Action: Ask another question on production systems

### Phase 2: Intelligent Pivot

**Condition**: `currentTopicInfo.contributionsCount >= CONTRIBUTIONS_TARGET AND underSaturated.length > 0`

**Behavior**: Switch to the topic with highest contribution count among those still below `CONTRIBUTIONS_TARGET`

**Guidance Sent to OpenAI**:
```
"Production Systems and Code Quality" has sufficient evidence (3 contributions).

Focus your next question on "Software Architecture and Design Patterns" - it needs more evidence (2/3 contributions). Transition naturally to this new topic.
```

**Why Highest of Remaining?**
- Prioritizes topics where candidate has already shown some strength
- Avoids "cold start" on completely unexplored topics
- Maintains momentum - builds on existing evidence

**Example Scenario**:
- Topic A: 3 contributions (saturated)
- Topic B: 2 contributions (highest of remaining)
- Topic C: 1 contribution
- Topic D: 0 contributions
- Action: Switch to Topic B (not D, even though D has lowest count)

### Phase 3: Depth Building (All Topics Saturated)

**Condition**: `allSaturated === true` (all topics have >= `CONTRIBUTIONS_TARGET`)

**Behavior**: Pick topic with lowest average strength score EACH round (don't persist focus topic)

**Guidance Sent to OpenAI**:
```
All topics have strong coverage.

Focus your next question on "Open Source and SDK Development" - build more depth (5 contributions, avg: 62%).
```

**Why Lowest Score?**
- All categories have sufficient volume (5+ contributions)
- Now optimize for quality - strengthen weak areas
- Re-evaluating each round allows dynamic response to new scores

**Example Scenario**:
- All topics have 5+ contributions
- Topic A: avg 85%
- Topic B: avg 72%
- Topic C: avg 68% (lowest)
- Action: Ask question on Topic C to pull up the average

---

## Implementation Details

### File: `useBackgroundAnswerHandler.ts`

**Location**: `shared/services/backgroundInterview/useBackgroundAnswerHandler.ts`

#### 1. Evaluation Integration (Race Condition Fix)

**Old Approach** (Race Condition):
```typescript
// Non-blocking evaluation
fetch(`/api/interviews/evaluate-answer`, {...});

// Separate DB fetch (too early!)
const contributionsRes = await fetch(`/api/interviews/session/${sessionId}/contributions`);
```

**New Approach** (Correct):
```typescript
// AWAIT evaluation completion
const evalResponse = await fetch(`/api/interviews/evaluate-answer`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sessionId,
    question: currentQuestion,
    answer,
    timestamp: evalTimestamp,
    experienceCategories,
  })
});

const evalData = await evalResponse.json();

// Use direct response for updated counts
categoryStats = evalData.updatedCounts || [];
```

#### 2. Coverage Analysis

```typescript
// Build coverage map from fresh evaluation data
const coverageInfo = experienceCategories.map((cat: any) => {
  const stats = categoryStats?.find((s: any) => s.categoryName === cat.name);
  return {
    name: cat.name,
    contributionsCount: stats?.count || 0,
    avgStrength: stats?.avgStrength || 0,
  };
});

const underSaturated = coverageInfo.filter((c: any) => 
  c.contributionsCount < CONTRIBUTIONS_TARGET
);
const allSaturated = underSaturated.length === 0;
```

#### 3. Focus Topic Selection

**Initial State (After First Answer)**:
```typescript
if (!currentFocusTopicName && coverageInfo.length > 0) {
  // Pick topic with HIGHEST contributions (the one that just got evidence)
  currentFocusTopicName = coverageInfo
    .sort((a: any, b: any) => b.contributionsCount - a.contributionsCount)[0]
    .name;
  dispatch(setCurrentFocusTopic({ topicName: currentFocusTopicName }));
}
```

**Phase 1 (Continuity)**:
```typescript
if (currentTopicInfo && currentTopicInfo.contributionsCount < CONTRIBUTIONS_TARGET) {
  focusGuidance = `Focus your next question on "${currentTopicInfo.name}" - continue building evidence (${currentTopicInfo.contributionsCount}/${CONTRIBUTIONS_TARGET} contributions).`;
}
```

**Phase 2 (Pivot)**:
```typescript
if (currentTopicInfo && currentTopicInfo.contributionsCount >= CONTRIBUTIONS_TARGET) {
  const nextTopic = underSaturated
    .sort((a: any, b: any) => b.contributionsCount - a.contributionsCount)[0];
  
  focusGuidance = `"${currentTopicInfo.name}" has sufficient evidence (${currentTopicInfo.contributionsCount} contributions).

Focus your next question on "${nextTopic.name}" - it needs more evidence (${nextTopic.contributionsCount}/${CONTRIBUTIONS_TARGET} contributions). Transition naturally to this new topic.`;
  
  dispatch(setCurrentFocusTopic({ topicName: nextTopic.name }));
}
```

**Phase 3 (Depth Building)**:
```typescript
if (allSaturated) {
  const lowestScoreTopic = coverageInfo
    .sort((a: any, b: any) => a.avgStrength - b.avgStrength)[0];
  
  focusGuidance = `All topics have strong coverage.

Focus your next question on "${lowestScoreTopic.name}" - build more depth (${lowestScoreTopic.contributionsCount} contributions).`;
  
  // Note: Do NOT persist currentFocusTopic - recalculate each round
}
```

#### 4. Category Guidance Construction

```typescript
const coverageList = coverageInfo.map((c: any) => 
  `- ${c.name}: ${c.contributionsCount} contribution${c.contributionsCount !== 1 ? 's' : ''} (avg: ${c.avgStrength}%)`
).join('\n');

categoryGuidance = `\n\nCATEGORY COVERAGE GUIDANCE:
Your goal is to gather evidence for all experience categories through natural conversation.

Current coverage:
${coverageList}

${focusGuidance}`;
```

**Example Output**:
```
CATEGORY COVERAGE GUIDANCE:
Your goal is to gather evidence for all experience categories through natural conversation.

Current coverage:
- Production Systems and Code Quality: 2 contributions (avg: 75%)
- Software Architecture and Design Patterns: 1 contribution (avg: 80%)
- Open Source and SDK Development: 0 contributions (avg: 0%)
- Quantum Computing Domain Knowledge: 0 contributions (avg: 0%)
- Leadership and Technical Ownership: 0 contributions (avg: 0%)

Focus your next question on "Production Systems and Code Quality" - continue building evidence (2/3 contributions).
```

#### 5. JSON Response Parsing

```typescript
const followUpRaw = await askViaChatCompletion(openaiClient, persona, historyMessages);

if (followUpRaw) {
  log.info("Raw OpenAI response:", followUpRaw);
  try {
    const parsed = JSON.parse(followUpRaw);
    const question = parsed.question || followUpRaw;
    const targetedCategory = parsed.targetedCategory || null;

    log.info("Extracted question:", question);
    log.info("Targeted category:", targetedCategory);

    dispatch(addMessage({ text: question, speaker: "ai" }));
    saveMessageToDb(question, "ai");

    if (targetedCategory) {
      dispatch(setCurrentQuestionTarget({ question, category: targetedCategory }));
    }
  } catch (err) {
    // Fallback if not JSON
    log.error("JSON parse failed:", err);
    dispatch(addMessage({ text: followUpRaw, speaker: "ai" }));
    saveMessageToDb(followUpRaw, "ai");
  }
}
```

---

## Data Flow

### Complete Answer Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Candidate submits answer                                │
│    - QuestionCard → interview/page.tsx → handleSubmit      │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Store raw answer                                         │
│    - dispatch(addMessage({ text: answer, speaker: "user" }))│
│    - saveMessageToDb(answer, "user")                        │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Evaluate answer (AWAIT)                                  │
│    - POST /api/interviews/evaluate-answer                   │
│    - dispatch(setEvaluatingAnswer({ evaluating: true }))   │
│    - OpenAI evaluates against all categories                │
│    - Returns: { allEvaluations, updatedCounts }            │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Extract updated category stats                          │
│    - categoryStats = evalData.updatedCounts                 │
│    - dispatch(setEvaluatingAnswer({ evaluating: false }))  │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Build coverage analysis                                  │
│    - Map experienceCategories to coverageInfo               │
│    - Identify underSaturated categories (< 5 contributions) │
│    - Determine phase (Continue / Pivot / Depth)             │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Update focus topic (if needed)                          │
│    - Phase 1: Keep currentFocusTopic (continuity)           │
│    - Phase 2: Dispatch new currentFocusTopic (pivot)        │
│    - Phase 3: Don't persist (recalculate each round)        │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Construct category guidance                             │
│    - Coverage list (all categories with counts)             │
│    - Focus guidance (phase-specific instructions)           │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Add answer context                                       │
│    - Blank answer: Special instructions                     │
│    - Substantive answer: Last answer text                   │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. Build full prompt                                        │
│    - Base system prompt (personality, rules)                │
│    - Category guidance                                      │
│    - Answer context                                         │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. Call OpenAI                                             │
│    - askViaChatCompletion(openaiClient, persona, history)  │
│    - Response format: { question, targetedCategory }        │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 11. Parse JSON response                                     │
│    - Extract question and targetedCategory                  │
│    - Fallback to raw text if parsing fails                  │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 12. Update Redux state                                      │
│    - dispatch(addMessage({ text: question, speaker: "ai" }))│
│    - dispatch(setCurrentQuestionTarget({ question, category }))│
│    - saveMessageToDb(question, "ai")                        │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 13. Display new question                                    │
│    - interview/page.tsx useEffect detects new AI message    │
│    - Updates currentQuestion state                          │
│    - QuestionCard receives new question prop                │
│    - Generates TTS audio (if not muted)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Race Condition Fix

### The Problem

**Old Flow**:
```
Submit answer
    ↓
[FIRE AND FORGET] POST /evaluate-answer
    ↓
[IMMEDIATELY] GET /contributions  ← Too early! Evaluation not complete yet
    ↓
Build guidance with STALE data
    ↓
[EVENTUALLY] Evaluation completes (but we already moved on)
```

**Symptoms**:
- Category guidance showed 0 contributions when 1 was just added
- Focus topic selection based on outdated counts
- Inconsistent behavior - sometimes worked (if evaluation was fast), sometimes didn't

### The Solution

**New Flow**:
```
Submit answer
    ↓
[AWAIT] POST /evaluate-answer
    ↓
Evaluation completes
    ↓
Extract updatedCounts from response (no separate DB fetch!)
    ↓
Build guidance with FRESH data
```

**Benefits**:
- Guaranteed consistency - guidance always reflects latest evaluation
- Reduced API calls - one instead of two
- Lower latency - no waiting for second request
- Simpler code - single source of truth

### Code Comparison

**Before**:
```typescript
// Non-blocking evaluation
fetch(`/api/interviews/evaluate-answer`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({...})
})
.then(res => res.json())
.then(evalData => {
  if (evalData.allEvaluations && onEvaluationReceived) {
    onEvaluationReceived({...});
  }
})
.catch(err => console.error("Failed to evaluate:", err));

// Separate fetch (race condition!)
const contributionsRes = await fetch(`/api/interviews/session/${sessionId}/contributions`);
const { categoryStats } = await contributionsRes.json();
```

**After**:
```typescript
dispatch(setEvaluatingAnswer({ evaluating: true }));

try {
  // AWAIT evaluation
  const evalResponse = await fetch(`/api/interviews/evaluate-answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      question: currentQuestion,
      answer,
      timestamp: evalTimestamp,
      experienceCategories,
    })
  });
  
  const evalData = await evalResponse.json();
  
  if (evalData.allEvaluations && onEvaluationReceived) {
    onEvaluationReceived({
      timestamp: evalTimestamp,
      question: currentQuestion,
      answer,
      evaluations: evalData.allEvaluations,
    });
  }
  
  // Use updated counts from response (no separate fetch!)
  categoryStats = evalData.updatedCounts || [];
} catch (err) {
  log.error("Failed to evaluate answer:", err);
} finally {
  dispatch(setEvaluatingAnswer({ evaluating: false }));
}
```

---

## Debug Panel Integration

### New State Fields

**File**: `shared/state/slices/backgroundSlice.ts`

```typescript
export type BackgroundState = {
  messages: Message[];
  transitioned: boolean;
  transitionedAt?: number;
  reason?: "timebox";
  
  // New fields for dynamic prioritization
  evaluatingAnswer: boolean;                    // Loading state during evaluation
  currentFocusTopic: string | null;             // Active category being explored
  currentQuestionTarget: {                      // Last question + its category
    question: string;
    category: string;
  } | null;
};
```

### Debug Panel Display

**File**: `app/shared/components/BackgroundDebugPanel.tsx`

#### Current Question Target

```tsx
{backgroundState.currentQuestionTarget && (
  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="text-xs font-semibold text-blue-700 mb-1">
      Current Question Target
    </div>
    <div className="text-sm text-blue-900">
      <strong>Category:</strong> {backgroundState.currentQuestionTarget.category}
    </div>
    <div className="text-xs text-blue-700 mt-1">
      {backgroundState.currentQuestionTarget.question}
    </div>
  </div>
)}
```

#### Evaluation Loading State

```tsx
{backgroundState.evaluatingAnswer && (
  <div className="flex items-center gap-2 text-purple-600">
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
    <span className="text-sm font-medium">Evaluating...</span>
  </div>
)}
```

#### Category Initialization (No Polling)

```tsx
// Initialize categories immediately on mount
useEffect(() => {
  if (!experienceCategories) return;
  
  const initialStats = experienceCategories.map(cat => ({
    categoryName: cat.name,
    count: 0,
    avgStrength: 0,
    latestContribution: null
  }));
  setContributionStats(initialStats);
}, [experienceCategories]);

// Fetch contributions after each evaluation (triggered by realtimeEvaluations change)
useEffect(() => {
  if (!debugEnabled || !sessionId) return;
  
  const fetchContributions = async () => {
    try {
      const res = await fetch(`/api/interviews/session/${sessionId}/contributions`);
      if (res.ok) {
        const data = await res.json();
        setContributionStats(data.categoryStats || []);
      }
    } catch (err) {
      console.error("[debug] Failed to fetch contributions:", err);
    }
  };

  fetchContributions();
}, [debugEnabled, sessionId, realtimeEvaluations]);  // Trigger on evaluation, not time
```

---

## OpenAI Integration

### JSON Response Format

**OpenAI Prompt**:
```
Response Format
You MUST return your response in JSON format:
{
  "question": "Your question here",
  "targetedCategory": "The category name you're targeting with this question"
}

The targetedCategory MUST be one of: Production Systems and Code Quality, Software Architecture and Design Patterns, Open Source and SDK Development.
```

**Example Response**:
```json
{
  "question": "Can you describe the design patterns you used in that system? For example, did you implement any creational patterns like Factory or Singleton?",
  "targetedCategory": "Software Architecture and Design Patterns"
}
```

### Full Prompt Construction

```typescript
const persona = buildOpenAIBackgroundPrompt(companyName, experienceCategories)
  + categoryGuidance
  + answerContext;
```

**Component 1: Base System Prompt** (`buildOpenAIBackgroundPrompt`)
- Personality (encouraging, professional, female interviewer)
- Tone (concise, clear, ≤2 sentences)
- Evaluation rules (ALWAYS acknowledge candidate's answer, be contextual)
- Behavioral rules (NEVER repeat questions)
- JSON response format

**Component 2: Category Guidance** (dynamic, from this system)
- Current coverage list (all categories with counts and avg scores)
- Focus guidance (phase-specific instructions for next question)

**Component 3: Answer Context** (from blank answer handling system)
- Blank answer: Special instructions to acknowledge and generate new question
- Substantive answer: Last answer text + instruction to respond contextually

---

## Edge Cases

### Edge Case 1: No Contributions After First Answer

**Scenario**: Candidate's first answer doesn't generate any contributions (weak/irrelevant response)

**Behavior**:
- `coverageInfo` shows all categories with 0 contributions
- `currentFocusTopicName` is null
- Initial state selection picks first category (highest of all zeros)

**Code**:
```typescript
if (!currentFocusTopicName && coverageInfo.length > 0) {
  // All zeros - pick first one
  currentFocusTopicName = coverageInfo
    .sort((a, b) => b.contributionsCount - a.contributionsCount)[0]
    .name;
  dispatch(setCurrentFocusTopic({ topicName: currentFocusTopicName }));
}
```

### Edge Case 2: Multiple Topics Reach 5 Simultaneously

**Scenario**: A strong answer generates contributions for multiple categories, pushing 2+ topics to 5 contributions in one shot

**Behavior**:
- `currentTopicInfo` still shows < 5 (outdated)
- Phase 1 continues on current topic
- Next answer will trigger Phase 2 pivot

**Why This Works**:
- Conservative approach - one more question on current topic won't hurt
- Ensures smooth transition, avoids jarring topic switch

### Edge Case 3: All Topics Saturated on First Answer

**Scenario**: Extremely comprehensive answer generates 5+ contributions across all categories (unlikely but possible)

**Behavior**:
- `allSaturated === true` immediately
- Phase 3 activates: pick lowest score topic
- System gracefully handles this edge case

### Edge Case 4: OpenAI Ignores Category Guidance

**Scenario**: OpenAI generates question on different category than guidance specified

**Behavior**:
- `targetedCategory` in JSON response shows actual category chosen
- Redux stores this in `currentQuestionTarget`
- Debug panel displays the discrepancy
- System continues normally - guidance is advisory, not enforced

**Mitigation**:
- Prompt explicitly states: "Focus your next question on [category]"
- JSON format requires `targetedCategory` field
- Strong language: "Your goal is to gather evidence for..."

### Edge Case 5: Evaluation API Returns Empty updatedCounts

**Scenario**: API error or unexpected response format

**Behavior**:
```typescript
categoryStats = evalData.updatedCounts || [];

// If empty, coverageInfo will show all zeros
const coverageInfo = experienceCategories.map((cat: any) => {
  const stats = categoryStats?.find((s: any) => s.categoryName === cat.name);
  return {
    name: cat.name,
    contributionsCount: stats?.count || 0,  // Fallback to 0
    avgStrength: stats?.avgStrength || 0,
  };
});
```

**Fallback**: All categories treated as having 0 contributions, system picks first one

---

## Future Enhancements

### 1. Adaptive Target Contributions

**Current**: Shared constant `CONTRIBUTIONS_TARGET = 3` for all categories (see [Contributions Target & Transition Logic](./contributions-target-and-transition-logic.md))

**Proposal**: Vary target based on category weight

```typescript
const getTargetContributions = (category: any): number => {
  // Higher weight = more contributions required
  return Math.ceil(CONTRIBUTIONS_TARGET * (category.weight / 20));  // Assuming typical weight is 20
};
```

**Example** (if `CONTRIBUTIONS_TARGET = 3`):
- Must-have category (weight: 30): 5 contributions
- Strong advantage (weight: 20): 3 contributions  
- Nice-to-have (weight: 10): 2 contributions

### 2. Time-Aware Pivoting

**Current**: Pure contribution-count based

**Proposal**: Factor in time spent on current topic

```typescript
const shouldPivot = (
  contributionsCount: number,
  timeOnTopicMs: number
): boolean => {
  // Force pivot if:
  // - Reached target contributions, OR
  // - Spent > 2 minutes and have >= CONTRIBUTIONS_TARGET - 1
  return contributionsCount >= CONTRIBUTIONS_TARGET ||
         (timeOnTopicMs > 120000 && contributionsCount >= CONTRIBUTIONS_TARGET - 1);
};
```

### 3. Quality Threshold

**Current**: Any contribution (strength > 0) counts toward target

**Proposal**: Require minimum average strength before pivoting

```typescript
const canPivot = (contributionsCount: number, avgStrength: number): boolean => {
  return contributionsCount >= CONTRIBUTIONS_TARGET && avgStrength >= 60;
};
```

### 4. Manual Override

**Proposal**: Allow interviewer/system admin to force topic switch

```tsx
<button onClick={() => dispatch(setCurrentFocusTopic({ topicName: "Other Topic" }))}>
  Force Switch to Other Topic
</button>
```

**Use Case**: Testing, debugging, or handling edge cases where system gets "stuck"

---

## Angle-Based Repetition Prevention

### Problem

The category selection algorithm ensures all topics get covered. But within a single topic, the interviewer can loop semantically — asking "what was your target latency?" and then "how did you measure whether you hit the latency requirement?" and then "what latency goal were you targeting?" These questions have different wording but identical informational intent. Additionally, questions asked more than ~4 turns back were invisible to the deduplication rule, so early-session questions could be verbatim-repeated in later turns.

### Solution: Three-Layer Deduplication

#### Layer 1 — Angle tracking (within-topic)

Each follow-up question is assigned a `ProbeAngle` — the validation dimension it probes. The system tracks which angles have been used per topic and passes them to the classification prompt, which is instructed to pick an uncovered angle.

**Angle taxonomy** (`ProbeAngle` type in `answerClassification.ts`):

| Angle | What it probes |
|-------|---------------|
| `implementation` | What ran inside it, how it was structured |
| `sizing` | How size, capacity, or parameters were chosen |
| `correctness` | Concurrency, safety guarantees, producer/consumer model |
| `measurement` | How latency, throughput, or occupancy was validated |
| `observed_evidence` | What traces, logs, or data actually showed |
| `failure_mode` | What broke, overflow, race conditions in practice |
| `tradeoff` | Why X over Y (must name both options) |
| `redesign` | What they would change now |

#### Layer 2 — Full-session banned-questions list (text + fingerprint)

Every substantive probe question is stored in Redux as a `SubstantiveProbe`:

```typescript
type SubstantiveProbe = {
  question: string;  // Full question text (raw text deduplication)
  topic: string;     // Focus topic at time of generation
  angle: string;     // ProbeAngle value
  slot: string;      // Constrained slot label (semantic deduplication)
};
```

The full `substantiveProbeHistory` array is sent on every request as `allPreviousProbes`. The classification prompt bans any question that matches by raw text equivalence **or** by fingerprint (`topic + angle + slot`). This catches "buffer size" vs "maximum capacity" — different phrasing, same slot, same ban.

**Slot vocabulary** (model is constrained to these labels only — no free-form invention):

| Slot | Meaning |
|------|---------|
| `actual_number` | A specific measured or designed-for quantity |
| `sizing_method` | How size/capacity/parameters were determined |
| `overflow_policy` | What happens when capacity is exceeded |
| `observed_result` | What the data/traces/logs actually showed |
| `instrumentation_tool` | The tool or mechanism used to measure |
| `failure_case` | A specific thing that broke or misbehaved |
| `concurrency_model` | Producer/consumer structure, thread ownership |
| `ownership_rule` | What code owns what memory/resource |
| `deferred_work` | Work pushed out of the hot path |
| `payload_shape` | Structure of enqueued/transmitted data |
| `tradeoff_choice` | The specific X-over-Y decision and why |
| `redesign_point` | What they would change now |

**Only substantive probes are stored** — clarification rephrases, gibberish retries, and topic-transition lines are excluded. This prevents over-constraining the model on non-informational turns.

#### Layer 3 — Recent history context

The classification prompt also receives the last 4 Q+A pairs as `recentHistory` for local conversational continuity. This is separate from the banned-questions list and is not used for deduplication.

### Data Flow

1. OpenAI generates the next question and returns `probeAngle` and `fingerprint` in the JSON response.
2. The client dispatches `addCoveredAngle` (angle tracking) and, when `detectedAnswerType === 'substantive'`, `addSubstantiveProbe` (full-session deduplication).
3. `backgroundSlice` stores both in `coveredAnglesPerTopic` and `substantiveProbeHistory`.
4. On the next submission, the client sends `coveredAngles` (current topic angles) and `allPreviousProbes` (full history) in the request body.
5. `buildClassificationPrompt` injects both lists: angles for cluster-slot progression, all-probes as the banned list.

### Relationship to Category Selection

All three deduplication layers are **orthogonal to and do not affect** category selection:
- `coveredAnglesPerTopic` and `substantiveProbeHistory` are advisory prompt context only.
- The two-mode topic selection algorithm (MODE 1 / MODE 2) reads only `currentCounts` and `excludedTopics`.
- `newFocusTopic` is still determined entirely server-side by contribution counts.

---

## Conclusion

The Dynamic Category Prioritization System successfully balances two competing goals:

1. **Natural Conversation**: Maintaining continuity through the "stay on topic until 5 contributions" rule creates coherent, human-like interview flow
2. **Comprehensive Coverage**: Systematic pivoting ensures all categories eventually receive sufficient evidence

The three-phase strategy (Continuity → Pivot → Depth Building) provides clear, predictable behavior while remaining flexible enough to handle edge cases. By integrating real-time evaluation data and explicit state management, the system eliminates race conditions and provides full transparency through the debug panel.

Key achievements:
- ✅ Eliminated robotic topic-switching behavior
- ✅ Achieved balanced coverage across all categories
- ✅ Fixed race condition with fresh evaluation data
- ✅ Full transparency via currentQuestionTarget display
- ✅ Predictable, rule-based topic selection
- ✅ Angle-based repetition prevention prevents semantic looping within a topic
- ✅ Full-session banned-questions list (text + fingerprint) prevents cross-turn repetition across the entire interview
- ✅ Constrained slot vocabulary ensures stable fingerprint matching (no model drift)

The system is production-ready and has been validated through extensive testing with multiple candidate scenarios.

---

**Document Version:** 1.2.0
**Last Updated:** March 9, 2026
**Maintained by:** Sfinx Engineering Team
