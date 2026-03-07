# Blank Answer Handling & OpenAI Context System

**Version:** 1.0.0  
**Date:** January 11, 2026  
**Status:** Implemented

---

## Overview

This document describes the system for handling blank/empty candidate answers during the background interview stage, including the contextual instruction system that guides OpenAI to respond appropriately to different answer types.

The implementation ensures that:
1. Blank answers are preserved as empty strings (no normalization)
2. OpenAI receives explicit instructions on how to handle blank answers
3. The conversation remains natural and human-like
4. Questions never repeat, even after multiple blank answers
5. All logging uses the centralized logger service

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Architecture](#solution-architecture)
3. [Implementation Details](#implementation-details)
4. [OpenAI Prompt Engineering](#openai-prompt-engineering)
5. [Data Flow](#data-flow)
6. [Evaluation System](#evaluation-system)
7. [Debugging & Logging](#debugging--logging)
8. [Known Issues](#known-issues)

---

## Problem Statement

### Initial Issues

**Issue 1: Question Repetition**
- After 6+ consecutive blank/"I don't know" answers, OpenAI would repeat previously asked questions
- This violated the prompt rule: "NEVER ask the exact same question twice"
- The UI correctly detected duplicates and skipped TTS, making it appear frozen

**Issue 2: Non-Contextual Responses**
- OpenAI would ask follow-up questions as if the candidate had provided substantive answers
- Blank answers were not acknowledged, leading to robotic, disconnected conversation flow

**Issue 3: Answer Normalization**
- System was replacing blank answers with "I don't know" before storing
- This masked the actual user behavior and created inconsistency

**Issue 4: Logging Violations**
- Direct `console.log`, `console.error`, `console.warn` calls throughout codebase
- Constitution requires all logging to use the centralized logger service

---

## Solution Architecture

### Core Principles

1. **Preserve Raw Data**: Store blank answers as empty strings, no normalization
2. **Explicit Context**: Send OpenAI specific instructions based on answer type
3. **Human-Like Conversation**: Acknowledge blank answers naturally before pivoting
4. **No Repetition**: Explicitly instruct OpenAI to generate new questions after blanks
5. **Centralized Logging**: All logging through `app/shared/services/logger.ts`

### High-Level Flow

```
User submits answer
    ↓
Detect if blank (answer.trim().length === 0)
    ↓
Store raw answer (no normalization)
    ↓
Build context instruction based on answer type
    ↓
Send to OpenAI with category guidance + answer context
    ↓
OpenAI generates contextual response
    ↓
Parse JSON response (question + targetedCategory)
    ↓
Display to candidate
```

---

## Implementation Details

### File Structure

```
shared/
├── services/
│   └── backgroundInterview/
│       ├── useBackgroundAnswerHandler.ts    # Main answer processing logic
│       └── useBackgroundPreload.ts          # First question generation
├── prompts/
│   └── openAIInterviewerPrompt.ts          # System prompt with behavioral rules
└── state/
    └── slices/
        └── backgroundSlice.ts               # Redux state management
```

### Key Components

#### 1. Answer Handler (`useBackgroundAnswerHandler.ts`)

**Location:** `shared/services/backgroundInterview/useBackgroundAnswerHandler.ts`

**Responsibilities:**
- Detect blank answers
- Store raw answer to Redux and DB
- Trigger evaluation API
- Build contextual instructions for OpenAI
- Parse JSON response
- Update Redux with new question

**Blank Answer Detection:**

```typescript
const isBlankAnswer = answer.trim().length === 0;
```

**No Normalization:**

```typescript
// Store raw answer
dispatch(addMessage({ text: answer, speaker: "user" }));
saveMessageToDb(answer, "user");
```

**Context Building:**

```typescript
let answerContext = "";
if (isBlankAnswer) {
  const previousQuestion = currentQuestion || "the question";
  answerContext = `\n\nINSTRUCTION: The candidate didn't know the answer to: "${previousQuestion}"

1. Acknowledge briefly that they're unsure (e.g., "I understand that's challenging")
2. Generate a completely NEW question on a DIFFERENT angle or aspect
3. Stay within the target category from the guidance above
4. DO NOT repeat any question from the conversation history`;
  log.info("BLANK ANSWER DETECTED - sending special instruction");
} else {
  answerContext = `\n\nCandidate's last answer: "${answer}"
Respond contextually to what they said.`;
}
```

**Full Persona Construction:**

```typescript
const persona = buildOpenAIBackgroundPrompt(
  String(companyName), 
  script?.experienceCategories
) + categoryGuidance + answerContext;
```

#### 2. OpenAI Prompt (`openAIInterviewerPrompt.ts`)

**Location:** `shared/prompts/openAIInterviewerPrompt.ts`

**Key Behavioral Rules:**

```typescript
Evaluation Rules (Background stage)
- ALWAYS acknowledge what the candidate just said before asking your next question. Be contextual, not robotic.
- Your follow-up should respond to their specific answer content, not be generic.
- Vary your approach naturally: probe deeper on their example, explore edge cases, ask about tradeoffs, or acknowledge and pivot to related topic.
- If answer is blank/gibberish/vague: acknowledge briefly ("I notice you're hesitant here") and move to related topic.

Behavioral Rules
7) NEVER ask the exact same question twice. Always vary your questions, even when following up on weak answers.
```

**JSON Response Format:**

```typescript
Response Format
You MUST return your response in JSON format:
{
  "question": "Your question here",
  "targetedCategory": "The category name you're targeting with this question"
}

The targetedCategory MUST be one of: ${categoriesText}.
```

#### 3. Redux State (`backgroundSlice.ts`)

**Location:** `shared/state/slices/backgroundSlice.ts`

**New State Fields:**

```typescript
interface BackgroundState {
  // ... existing fields
  evaluatingAnswer: boolean;           // Tracks if evaluation API is in progress
  currentFocusTopic: string | null;    // Current category being explored
  currentQuestionTarget: {             // Last question + its target category
    question: string;
    category: string;
  } | null;
}
```

**New Actions:**

```typescript
setEvaluatingAnswer: (state, action: PayloadAction<{ evaluating: boolean }>) => {
  state.evaluatingAnswer = action.payload.evaluating;
}

setCurrentFocusTopic: (state, action: PayloadAction<{ topicName: string }>) => {
  state.currentFocusTopic = action.payload.topicName;
}

setCurrentQuestionTarget: (state, action: PayloadAction<{ question: string; category: string }>) => {
  state.currentQuestionTarget = action.payload;
}
```

#### 4. Debug Panel (`BackgroundDebugPanel.tsx`)

**Location:** `app/shared/components/BackgroundDebugPanel.tsx`

**Enhancements:**
- Display loading spinner while `evaluatingAnswer` is true
- Show current question target (question + category) at top of panel
- Initialize categories immediately (not after first contribution)

**Loading State:**

```typescript
{backgroundState.evaluatingAnswer && (
  <div className="flex items-center gap-2 text-purple-600">
    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
    <span className="text-sm font-medium">Evaluating...</span>
  </div>
)}
```

**Current Question Display:**

```typescript
{backgroundState.currentQuestionTarget && (
  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="text-xs font-semibold text-blue-700 mb-1">Current Question Target</div>
    <div className="text-sm text-blue-900">
      <strong>Category:</strong> {backgroundState.currentQuestionTarget.category}
    </div>
    <div className="text-xs text-blue-700 mt-1">
      {backgroundState.currentQuestionTarget.question}
    </div>
  </div>
)}
```

---

## OpenAI Prompt Engineering

### Prompt Structure

The full prompt sent to OpenAI consists of three parts:

1. **Base System Prompt** (`buildOpenAIBackgroundPrompt`)
   - Personality and tone guidelines
   - Evaluation rules
   - Behavioral constraints
   - JSON response format

2. **Category Coverage Guidance** (dynamic, generated per answer)
   - Current contribution counts per category
   - Target category for next question
   - Continuity instructions (stay on topic vs pivot)

3. **Answer Context** (dynamic, based on answer type)
   - For blank answers: Explicit instructions to acknowledge and generate new question
   - For substantive answers: Last answer text + instruction to respond contextually

### Example Full Prompt (Blank Answer)

```
Personality
- You are a female technical interviewer for Meta inside a modern, evidence-based hiring platform.
- Be encouraging but professionally neutral. Acknowledge effort, never teach, hint, or solve.

[... full base prompt ...]

CATEGORY COVERAGE GUIDANCE:
Your goal is to gather evidence for all experience categories through natural conversation.

Current coverage:
- Production Systems and Code Quality: 0 contributions (avg: 0%)
- Software Architecture and Design Patterns: 0 contributions (avg: 0%)
- Open Source and SDK Development: 0 contributions (avg: 0%)

Focus your next question on "Production Systems and Code Quality" - continue building evidence (0/5 contributions).

INSTRUCTION: The candidate didn't know the answer to: "Tell me about a large-scale production system you built or maintained using Python. What were the key challenges?"

1. Acknowledge briefly that they're unsure (e.g., "I understand that's challenging")
2. Generate a completely NEW question on a DIFFERENT angle or aspect
3. Stay within the target category from the guidance above
4. DO NOT repeat any question from the conversation history
```

### JSON Response Parsing

**OpenAI Response:**

```json
{
  "question": "What strategies did you use to ensure code quality in your projects, such as testing or code reviews?",
  "targetedCategory": "Production Systems and Code Quality"
}
```

**Parsing Logic:**

```typescript
const followUpRaw = await askViaChatCompletion(openaiClient, persona, historyMessages);

if (followUpRaw) {
  log.info("Raw OpenAI response:", followUpRaw);
  try {
    const parsed = JSON.parse(followUpRaw);
    const question = parsed.question || followUpRaw;
    const targetedCategory = parsed.targetedCategory || null;

    dispatch(addMessage({ text: question, speaker: "ai" }));
    saveMessageToDb(question, "ai");

    if (targetedCategory) {
      dispatch(setCurrentQuestionTarget({ question, category: targetedCategory }));
    }
  } catch (err) {
    // Fallback if not JSON
    log.error("JSON parse failed:", err);
    log.warn("Using raw text as fallback");
    dispatch(addMessage({ text: followUpRaw, speaker: "ai" }));
    saveMessageToDb(followUpRaw, "ai");
  }
}
```

---

## Data Flow

### Answer Submission Flow

```
┌─────────────────────────────────────────────────────────────┐
│ QuestionCard.tsx                                            │
│  - User clicks submit or presses Enter                     │
│  - Calls handleSubmitAnswer(answer)                        │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ interview/page.tsx                                          │
│  - Receives answer from QuestionCard                       │
│  - Calls submitAnswer from useBackgroundAnswerHandler      │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ useBackgroundAnswerHandler.ts                              │
│  1. Detect if blank (answer.trim().length === 0)          │
│  2. Store raw answer to Redux + DB                         │
│  3. Call /api/interviews/evaluate-answer                   │
│  4. Build category guidance from evaluation response       │
│  5. Build answer context (blank vs substantive)           │
│  6. Construct full persona prompt                          │
│  7. Call OpenAI via askViaChatCompletion                   │
│  8. Parse JSON response                                     │
│  9. Dispatch new question to Redux + DB                    │
│  10. Update currentQuestionTarget                          │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Redux Store (backgroundSlice)                              │
│  - messages array updated with user answer + AI question   │
│  - evaluatingAnswer toggled during API call                │
│  - currentQuestionTarget updated with new question         │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ interview/page.tsx (useEffect)                             │
│  - Detects new AI message in Redux                         │
│  - Updates currentQuestion state                            │
│  - Increments backgroundQuestionNumber                     │
└───────────────────────┬─────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ QuestionCard.tsx                                            │
│  - Receives new question via props                         │
│  - Generates TTS audio (if not muted)                      │
│  - Displays question to candidate                           │
└─────────────────────────────────────────────────────────────┘
```

### Evaluation Flow (Blank Answer)

```
Blank answer submitted
    ↓
POST /api/interviews/evaluate-answer
    {
      sessionId,
      question: "Tell me about...",
      answer: "",  // Empty string, not "I don't know"
      experienceCategories: [...]
    }
    ↓
OpenAI evaluates blank answer
    ↓
Returns evaluations with strength: 0 for all categories
    ↓
No CategoryContribution records created (strength must be > 0)
    ↓
Response: { allEvaluations: [...], updatedCounts: [...] }
    ↓
useBackgroundAnswerHandler receives response
    ↓
Builds category guidance from updatedCounts
    ↓
Detects isBlankAnswer = true
    ↓
Builds special instruction context
    ↓
Sends to OpenAI with full prompt
    ↓
OpenAI generates NEW question (not a repeat)
    ↓
Returns JSON: { question: "...", targetedCategory: "..." }
    ↓
Question displayed to candidate
```

---

## Evaluation System

### Evaluation API

**Endpoint:** `POST /api/interviews/evaluate-answer`

**Request:**

```typescript
{
  sessionId: string;
  question: string;
  answer: string;  // Can be empty string
  timestamp: string;
  experienceCategories: Array<{
    name: string;
    description: string;
    weight: number;
    example?: string;
  }>;
}
```

**Response:**

```typescript
{
  allEvaluations: Array<{
    category: string;
    strength: number;  // 0-100
    accepted: boolean;  // true if strength > 0
    reasoning: string;
    caption?: string;  // Required if strength > 0
  }>;
  updatedCounts: Array<{
    categoryName: string;
    count: number;  // Total contributions for this category
    avgStrength: number;  // Average strength (0-100)
  }>;
}
```

### Blank Answer Evaluation

**OpenAI Prompt (Evaluation):**

```
CRITICAL RULES:
1. Blank or gibberish answers MUST score 0 across all categories
2. caption field is REQUIRED when strength > 0
3. All evaluations must be returned (both accepted and rejected)
```

**Enforcement:**

```typescript
// In evaluate-answer/route.ts
const prompt = `
CRITICAL: If the answer is blank, empty, or gibberish (e.g., "I don't know", "...", or no meaningful content), you MUST score 0 for ALL categories.

For each category where strength > 0, you MUST provide a caption field.
`;
```

**Result for Blank Answer:**

```json
{
  "allEvaluations": [
    {
      "category": "Production Systems and Code Quality",
      "strength": 0,
      "accepted": false,
      "reasoning": "No answer provided",
      "caption": null
    },
    {
      "category": "Software Architecture and Design Patterns",
      "strength": 0,
      "accepted": false,
      "reasoning": "No answer provided",
      "caption": null
    }
  ],
  "updatedCounts": [
    { "categoryName": "Production Systems and Code Quality", "count": 0, "avgStrength": 0 },
    { "categoryName": "Software Architecture and Design Patterns", "count": 0, "avgStrength": 0 }
  ]
}
```

---

## Debugging & Logging

### Logger Service Migration

**Constitution Requirement:**
> ALL logging MUST use the logger service located at `app/shared/services/logger.ts`; direct `console.log`, `console.error`, or other console methods are PROHIBITED.

**Implementation:**

```typescript
// Import logger
import { log } from "app/shared/services/logger";

// Replace all console calls
// Before:
console.log("[answer-handler] Processing answer:", answer);
console.error("[answer-handler] Failed to evaluate:", err);
console.warn("[answer-handler] Using fallback");

// After:
log.info("Processing answer:", answer);
log.error("Failed to evaluate:", err);
log.warn("Using fallback");
```

**Logger Features:**
- Automatic label extraction from call stack
- Configurable log levels (debug, info, warn, error)
- File-based filtering (only log from specific files)
- Consistent formatting across codebase

### Debug Panel Features

**Evaluation Status:**
- Loading spinner shown while `evaluatingAnswer === true`
- "Evaluating..." text displayed
- Spinner appears in top section of debug panel

**Current Question Target:**
- Displays the last question generated by OpenAI
- Shows the targeted category for that question
- Helps verify OpenAI is following category guidance

**Category Breakdown:**
- All categories shown immediately (not after first contribution)
- Contribution counts update in real-time
- Average strength displayed per category

**Evaluation Timeline:**
- All evaluations (accepted + rejected) displayed
- Question/Answer context shown
- Reasoning for each evaluation visible

### Logging Strategy

**Key Log Points:**

1. **Answer Detection:**
   ```typescript
   log.info("BLANK ANSWER DETECTED - sending special instruction");
   ```

2. **OpenAI Interaction:**
   ```typescript
   log.info("Raw OpenAI response:", followUpRaw);
   log.info("Parsed JSON:", parsed);
   log.info("Extracted question:", question);
   log.info("Targeted category:", targetedCategory);
   ```

3. **State Updates:**
   ```typescript
   log.info("Follow-up question generated and dispatched");
   ```

4. **Errors:**
   ```typescript
   log.error("Failed to evaluate answer:", err);
   log.error("JSON parse failed:", err);
   ```

---

## Known Issues

### Issue: OpenAI Repeats Questions After 6+ Blank Answers

**Status:** Known Bug (Documented in Issue Tracker)

**Symptoms:**
- After 6+ consecutive blank/"I don't know" answers, OpenAI ignores the "NEVER repeat" rule
- Questions like "What strategies did you use to ensure code quality" and "Can you describe a situation where you had to debug" repeat 2-3 times
- UI correctly detects duplicates and skips TTS, making it appear frozen

**Root Cause:**
- OpenAI's context window includes full conversation history
- After many blank answers, the model defaults to "polite re-asking" behavior
- The explicit instruction to generate NEW questions is not strong enough after 6+ repetitions

**Evidence:**
```
Log entries showing repeated questions:
- Line 27: "What strategies did you use to ensure code quality"
- Line 47: Same question repeated
- Line 37: "Can you describe a situation where you had to debug"
- Line 57: Same question repeated AGAIN
- Line 87: Same question repeated AGAIN
```

**Potential Solutions:**
1. **Track Asked Questions:** Maintain a set of previously asked questions and filter them from history before sending to OpenAI
2. **Stronger Prompt:** Add more explicit instructions: "CRITICAL: Review the conversation history. If you see any question similar to what you're about to ask, generate a completely different question."
3. **History Truncation:** After N blank answers, truncate older Q&A pairs from history to reduce context pollution
4. **Category Forcing:** After 3 blank answers on a topic, force a category switch regardless of contribution count

**Workaround:**
- Current system works well for 1-5 blank answers
- For interviews with 6+ consecutive blanks, the system will eventually pivot to new questions (just slower)
- Debug panel shows the repetition, making it visible to observers

---

## Future Enhancements

### 1. Question Deduplication System

**Goal:** Prevent OpenAI from repeating questions, even after many blank answers

**Implementation:**
```typescript
// In useBackgroundAnswerHandler.ts
const askedQuestions = new Set<string>();

// Before sending to OpenAI:
const historyMessages = buildControlContextMessages(CONTROL_CONTEXT_TURNS);
const filteredHistory = historyMessages.filter(msg => {
  if (msg.role === 'assistant') {
    const questionHash = hashQuestion(msg.content);
    if (askedQuestions.has(questionHash)) {
      return false; // Remove duplicate from history
    }
    askedQuestions.add(questionHash);
  }
  return true;
});
```

### 2. Adaptive Prompt Strengthening

**Goal:** Increase instruction strength after repeated blank answers

**Implementation:**
```typescript
const blankAnswerCount = messages.filter(m => 
  m.speaker === 'user' && m.text.trim().length === 0
).length;

if (blankAnswerCount >= 3) {
  answerContext += `\n\nCRITICAL: This is the ${blankAnswerCount}th blank answer. You MUST generate a question that is COMPLETELY DIFFERENT from all previous questions. Review the conversation history and ensure your question is unique.`;
}
```

### 3. Category Switch After N Blanks

**Goal:** Force topic change after multiple blank answers on same category

**Implementation:**
```typescript
if (isBlankAnswer && consecutiveBlanksOnTopic >= 3) {
  // Force switch to different category
  const otherCategories = experienceCategories.filter(
    cat => cat.name !== currentFocusTopic
  );
  const nextCategory = otherCategories[0];
  dispatch(setCurrentFocusTopic({ topicName: nextCategory.name }));
}
```

### 4. Enhanced Debug Visualization

**Goal:** Better visibility into blank answer patterns

**Features:**
- Highlight blank answers in evaluation timeline
- Show consecutive blank answer count per category
- Display "question repetition detected" warning
- Add button to manually force category switch

---

## Conclusion

The blank answer handling system successfully addresses the core issues of question repetition and non-contextual responses by:

1. **Preserving raw data** - No normalization, blank answers stay blank
2. **Explicit context** - OpenAI receives clear instructions based on answer type
3. **Natural conversation** - Acknowledgment + pivot pattern maintains human-like flow
4. **Constitution compliance** - All logging through centralized logger service
5. **Transparent debugging** - Debug panel shows evaluation status and question targets

The known issue with question repetition after 6+ blank answers is documented and has clear potential solutions. The current implementation handles 1-5 blank answers gracefully, which covers the majority of real interview scenarios.

---

**Document Version:** 1.0.0  
**Last Updated:** January 11, 2026  
**Maintained by:** Sfinx Engineering Team
