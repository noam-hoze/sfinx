# Coding Stage Implementation Plan

## Overview
Enable AI responses during coding and implement comprehensive metrics for the CPS page with video evidence.

---

# Step 1: Coding Stage AI Responses

## Problem
When in text mode during the coding stage (`in_coding_session` state), OpenAI stops responding to user messages. The `sendUserMessage` function only handles `greeting_responded_by_user` and `background_answered_by_user` states, but has no handler for the coding stage.

## Solution
Add a handler in `sendUserMessage` to generate AI responses during the coding stage using the appropriate context.

## Context Required for OpenAI
When the user sends a message during coding, OpenAI needs:
- **System Prompt**: Use `buildOpenAICodingPrompt(companyName, codingTask)`
- **Coding Task**: From `scriptRef.current.codingPrompt`
- **Expected Answer**: From `scriptRef.current.codingAnswer`
- **Starting Template**: From `scriptRef.current.codingTemplate`
- **Conversation History**: Last 30 messages using `buildDeltaControlMessages(CONTROL_CONTEXT_TURNS)` - this maintains continuity across the entire interview

## Implementation Details
Location: `app/(features)/interview/components/chat/OpenAITextConversation.tsx`

After the `background_answered_by_user` handler, add:

```typescript
if (ms.state === "in_coding_session") {
  // Get coding context from script
  const codingPrompt = scriptRef.current?.codingPrompt;
  const codingAnswer = scriptRef.current?.codingAnswer;
  const codingTemplate = scriptRef.current?.codingTemplate;
  
  if (!codingPrompt || !codingAnswer || !codingTemplate) {
    console.error("Missing coding context from script");
    return;
  }
  
  // Build system prompt with coding persona
  const companyName = ms.companyName || "Company";
  const codingPersona = buildOpenAICodingPrompt(companyName, codingPrompt);
  
  // Add context about template and expected answer to the system prompt
  const systemPrompt = `${codingPersona}

Reference Information:
Starting Template:
${codingTemplate}

Expected Solution:
${codingAnswer}

The candidate is working on this task. Respond to their question while following the behavioral rules above.`;
  
  // Get conversation history (last 30 messages)
  const { system: roHistory, assistant: lastQ, user: lastA } = buildDeltaControlMessages(CONTROL_CONTEXT_TURNS);
  
  // Generate AI response using chat completions
  const reply = await askViaChatCompletion(
    openaiClient,
    systemPrompt,
    [] // history is already embedded in buildDeltaControlMessages, but we might need to pass it differently
  );
  
  if (reply) {
    post(reply, "ai");
    dispatch(machineAiFinal({ text: reply }));
    setInputLocked?.(false);
  }
  
  return;
}
```

**Note**: Need to verify how `buildDeltaControlMessages` structures the history and potentially create a new helper function that returns the history in the format needed for `askViaChatCompletion`.

## Helper Function Updates
- Use existing `buildDeltaControlMessages(CONTROL_CONTEXT_TURNS)` from `shared/services` to get last 30 messages
- May need to adapt the history format from `buildDeltaControlMessages` to work with `askViaChatCompletion`
- Or create a new helper function specifically for coding stage that properly formats the history

## Files to Modify
1. `app/(features)/interview/components/chat/OpenAITextConversation.tsx`
2. `app/(features)/interview/components/chat/openAITextConversationHelpers.ts`

## Success Criteria
- AI responds to user messages during coding stage
- AI has context of the coding task, template, and expected answer
- Responses follow the coding persona behavioral rules
- Input locks/unlocks correctly during the exchange

---

# Step 2: Iterations Metric

## Definition
A valid iteration = code change → Run → output evaluation against expected result.

## What We Need

### 1. Reference Output in Interview Script
Add to script alongside `codingAnswer`:
- `expectedOutput` or `referencePreview` - what should render in the preview panel
- This is what we'll compare the actual output against

### 2. Capture Actual Output
From `CodePreview` component:
- Capture what actually rendered (DOM snapshot, text description, or screenshot)
- Track when each run happens

### 3. OpenAI Evaluation
Compare `actualOutput` vs `expectedOutput`:
- `expectedOutput` comes from interview script (stored with `codingAnswer` and `codingPrompt`)
- Input to OpenAI: `actualOutput` (captured from preview) + `expectedOutput` (from script) + coding task context
- System prompt: "Evaluate if this output matches the expected behavior for the task. Return STRICT JSON only."
- **Response format:**
```json
{
  "evaluation": "correct" | "partial" | "incorrect",
  "reasoning": "Brief explanation of why the output matches/differs from expected",
  "matchPercentage": 0-100,
  "caption": "Short human-readable description for video evidence (e.g., 'First working solution achieved')"
}
```

## DB Structure
Store in `TelemetryData` or new table:
```typescript
iterations: [
  {
    timestamp: Date,
    codeSnapshot: string,      // Code at time of run
    actualOutput: string,       // What rendered
    expectedOutput: string,     // Reference output
    evaluation: "correct" | "partial" | "incorrect",
    reasoning: string,          // OpenAI's explanation
    matchPercentage: number,    // 0-100
    caption: string             // For video evidence link
  }
]
```

## Video Evidence for CPS
Save timestamps of meaningful iteration moments for video playback:
- **Evaluation changes**: When evaluation transitions (incorrect → partial, partial → correct)
- **First partial success**: Candidate makes initial progress
- **First correct solution**: Breakthrough moment
- **Final submission**: End result

Each evidence link shows:
- Video timestamp linking to recorded session
- Caption from OpenAI (e.g., "First working solution achieved")
- Allows company to see the exact moment in context

## Metrics to Display on CPS
- **Count**: Total meaningful runs with output evaluation
- **Success rate**: Correct vs partial vs incorrect
- **Time to solution**: Duration until first correct
- **Video Evidence** (1-3 citations): Evaluation transitions, first success, breakthrough moments

## Implementation Points
- Track Run button clicks in `EditorPanel`
- Capture output from `CodePreview` after execution
- Call OpenAI evaluation endpoint (returns evaluation + caption)
- Identify meaningful iterations (evaluation transitions) for video evidence
- Store iteration data in DB with timestamps and captions
- Display on CPS: total iterations, successful vs failed, time to first correct solution
- Display video evidence links (1-3 citations) with captions for key moments

## Files to Modify
1. Interview script schema - add `expectedOutput`
2. `EditorPanel.tsx` - track Run clicks
3. `CodePreview.tsx` - capture rendered output
4. New API endpoint: `/api/interviews/evaluate-output` - OpenAI evaluation
5. DB schema - add iteration tracking fields
6. CPS page - display iteration metrics and video evidence

---

# Step 3: Debug Loops Metric

## Definition
A debug loop = consecutive runtime errors before successful execution.

## Example
```
Run 1 → error (loop starts)
Run 2 → error (still in loop)
Run 3 → error (still in loop)
Run 4 → success (loop ends, depth = 3)
```

## What We Track (No OpenAI needed)
- Execution status: `success` | `error`
- Timestamp of each run
- Consecutive error count before success

## DB Structure
Store in `TelemetryData`:
```typescript
debugLoops: [
  {
    startTimestamp: Date,
    endTimestamp: Date,        // Resolution moment (for video link)
    errorCount: number,        // How many consecutive errors
    resolved: boolean,         // Did they eventually succeed?
    caption: string            // For video evidence (e.g., "Resolved 4 consecutive errors")
  }
]
```

## Video Evidence for CPS
Save timestamps of significant debug loops:
- **Resolved loops with high error count** (≥3 errors): Shows persistence and problem-solving
- **Longest debug loop**: Demonstrates where candidate struggled most
- **Resolution moment** (`endTimestamp`): Links to when loop ended successfully

Caption examples (generated programmatically):
- "Resolved 4 consecutive runtime errors"
- "Fixed undefined variable reference after 3 attempts"

## Metrics to Display on CPS
- **Count**: Total consecutive error sequences
- **Average depth**: Errors per loop
- **Longest loop**: Most errors before resolution
- **Unresolved loops**: Still failing at submission
- **Video Evidence** (1-2 citations): Significant resolved loops (≥3 errors)

## Implementation Points
- `CodePreview` already tracks `executionStatus: "idle" | "success" | "error"`
- Add callback `onExecutionResult(status: "success" | "error")` to parent
- Parent tracks consecutive errors and resets on success
- Generate caption programmatically: "Resolved {errorCount} consecutive runtime errors"
- Store each completed loop in DB with timestamps and caption
- Identify significant loops (high error count) for video evidence
- Video links point to `endTimestamp` (resolution moment)

## Files to Modify
1. `CodePreview.tsx` - add execution result callback
2. `EditorPanel.tsx` or `InterviewIDE.tsx` - track consecutive errors
3. DB schema - add debug loop fields
4. CPS page - display debug loop metrics and video evidence

---

# Step 4: External Tool Usage Metric

## Definition
Detects when candidate pastes code from external sources (AI assistants, Stack Overflow, etc.) via burst inserts (≥80 characters at once).

## What We Track
- Each paste event (timestamp + pasted content)
- AI's followup question and candidate's answer
- OpenAI evaluation of candidate's understanding
- Total number of paste events
- Percentage of final solution from external sources

## Current Implementation
`EditorPanel.tsx` already detects burst inserts but only fires once. Need to track ALL paste events.

## DB Structure
Store in `TelemetryData`:
```typescript
externalToolUsage: [
  {
    timestamp: Date,                 // When paste occurred (for video link)
    pastedContent: string,           // What was pasted
    characterCount: number,          // Length of paste
    aiQuestion: string,              // AI's followup question
    aiQuestionTimestamp: Date,       // When AI asked (for video)
    userAnswer: string,              // Candidate's response
    userAnswerTimestamp: Date,       // When user answered (for video)
    evaluation: {
      understanding: "full" | "partial" | "none",
      accountability: number,        // 0-100 score
      reasoning: string,             // Why this score
      caption: string                // For video evidence
    }
  }
]
```

## OpenAI Evaluation Flow
When candidate pastes code:
1. AI asks followup question about the pasted code
2. Candidate answers
3. Send to OpenAI for evaluation:
   - Input: `pastedContent`, `aiQuestion`, `userAnswer`, coding task context
   - System prompt: "Evaluate if the candidate understands the code they pasted. Can they take ownership of it? Return STRICT JSON only."
   - **Response format:**
```json
{
  "understanding": "full" | "partial" | "none",
  "accountability": 0-100,
  "reasoning": "Brief explanation of their understanding level",
  "caption": "Short description for video evidence (e.g., 'Pasted React component with full understanding')"
}
```

## Video Evidence for CPS
Each paste event provides video evidence showing the complete interaction:
- **Paste moment**: Links to exact timestamp when code was pasted
- **AI question**: The followup question AI asked about the pasted code
- **User answer**: Candidate's explanation/justification
- Shows the full context from paste → question → answer

Caption from OpenAI examples:
- "Pasted React component with full understanding"
- "Added external code but struggled to explain functionality"
- "Used AI-generated solution with partial comprehension"

**All paste events** are shown as evidence links (not just selected ones), allowing company to review each external tool usage.

## Metrics to Display on CPS
- **Count**: Total paste events
- **Accountability Score** (0-100): Average understanding/ownership across all pastes
- **Percentage**: How much of solution came from external sources
- **Video Evidence** (all pastes): Each paste event with full context and caption

## Implementation Points
- Remove `usingAITriggeredRef` one-time limit
- Track every burst insert (≥80 chars) with **paste timestamp**
- For each paste: send to AI via `updateKBVariables({ using_ai: true, ai_added_code: insertedSegment })`
- AI interviewer asks relevant question about each paste (not just the first)
- Save **AI question timestamp** when AI asks
- Capture user's answer to the AI's followup question
- Save **user answer timestamp** when user responds
- Send paste context + Q&A to OpenAI evaluation endpoint
- Store evaluation result (understanding, accountability score, reasoning, caption)
- Calculate metrics:
  - Total paste count
  - Average accountability score across all pastes
  - Percentage: (total pasted chars / final code length) × 100
- Store each event with all timestamps, answer, and evaluation in DB
- Generate video evidence links for all paste events

## Files to Modify
1. `EditorPanel.tsx` - remove one-time trigger limit, track all pastes with timestamps
2. Conversation component - detect AI's paste-related question (save timestamp) and capture user's answer (save timestamp)
3. New API endpoint: `/api/interviews/evaluate-paste-accountability` - OpenAI evaluation with caption
4. DB schema - add external tool usage fields with Q&A, timestamps, and evaluation
5. CPS page - display paste count, accountability score, percentage, and video evidence links with captions

---

# Step 5: Gaps Generation from Coding Session

## Overview
After the coding stage completes, analyze all collected metrics and generate a list of gaps (strengths/weaknesses) for the CPS page.

## Input to OpenAI
Send all coding session data:
- **Iterations data**: All evaluations, attempts, time to solution, success rate
- **Debug loops**: Count, depth, patterns, resolution times
- **External tool usage**: Paste count, accountability scores, understanding levels
- **Final code submission**: The candidate's final solution
- **Coding task**: The original task they were solving
- **Expected solution**: The reference answer

## OpenAI Evaluation
System prompt: "Based on the candidate's coding session performance, identify specific gaps (major and minor) in their skills. Return STRICT JSON only."

**Response format:**
```json
{
  "gaps": [
    {
      "title": "string",
      "description": "string",
      "severity": "major" | "minor"
    }
  ]
}
```

## Example Gaps

### Major Gaps
- "Multiple debug loops suggest weak error handling fundamentals"
- "Failed to achieve correct output after 10+ iterations"
- "Heavy reliance on external tools with poor understanding (accountability score: 35/100)"
- "Unable to implement basic React component structure independently"

### Minor Gaps
- "Took longer than average to identify runtime errors"
- "Used external tools but demonstrated partial understanding"
- "Could benefit from better planning before implementation"

## DB Structure
Store in existing gaps tables (maintain current schema):
- Major gaps: `severity: "major"`
- Minor gaps: `severity: "minor"`

## Display on CPS
- **Gaps section**: Major severity gaps
- **Minor gaps section**: Minor severity gaps

## Implementation Points
- Call OpenAI evaluation after coding stage completes (on submission)
- Gather all telemetry data (iterations, debug loops, external tool usage)
- Send comprehensive context to OpenAI
- Parse JSON response and extract gaps array
- Store gaps in DB with appropriate severity classification
- Display in existing gaps sections on CPS page

## Files to Modify
1. New API endpoint: `/api/interviews/generate-coding-gaps` - OpenAI evaluation
2. `InterviewIDE.tsx` or submission handler - trigger gaps generation on coding completion
3. CPS page - ensure gaps are displayed from DB (should already work with existing structure)

---

# Summary: Complete CPS Implementation

## Metrics Overview

### 1. Iterations
- **Count**: Total meaningful runs with output evaluation
- **Success rate**: Correct vs partial vs incorrect
- **Time to solution**: Duration until first correct
- **Video Evidence** (1-3 citations): Evaluation transitions, first success, breakthrough moments

### 2. Debug Loops
- **Count**: Total consecutive error sequences
- **Average depth**: Errors per loop
- **Longest loop**: Most errors before resolution
- **Video Evidence** (1-2 citations): Significant resolved loops (≥3 errors)

### 3. External Tool Usage
- **Count**: Total paste events
- **Accountability Score** (0-100): Average understanding/ownership across all pastes
- **Percentage**: How much of solution came from external sources
- **Video Evidence** (all pastes): Each paste event with full context (paste → AI question → user answer)

### 4. Gaps
- **Major gaps**: Critical skill deficiencies identified from coding performance
- **Minor gaps**: Areas for improvement
- Generated by OpenAI based on all metrics

## Video Evidence System
All evidence links include:
- **Timestamp**: Exact moment in recorded session
- **Caption**: OpenAI-generated or programmatic human-readable description
- **Context**: Relevant code/interaction at that moment

This allows hiring managers to click and see the actual candidate behavior in the video, validating the metrics with real evidence.

## CPS Page Changes
- **Remove from UI**: Insights section (keep in DB, just hide from display)
- **Add**: Iterations, Debug Loops, and External Tool Usage sections with their respective metrics and video evidence links
- **Update**: Gaps sections with AI-generated gaps from coding session analysis
