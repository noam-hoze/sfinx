# Appendix: External Tool Usage - Conversation Flow & Confidence Mechanism

## Overview

When a candidate pastes code from an external source, the AI must engage in a **multi-turn conversation** to evaluate their understanding. This is similar to the background stage confidence mechanism, where the AI gradually builds confidence about whether it has enough data to make a judgment.

---

## The Problem

Unlike simple metrics (iterations, debug loops), external tool usage evaluation requires **conversational intelligence**:

1. **User might not answer directly**: "Let me think about that", "Can you clarify?", "What do you mean?"
2. **Conversation might drift**: User changes topic, asks unrelated questions
3. **Multiple turns needed**: AI may need to probe deeper with follow-up questions
4. **Confidence is gradual**: AI needs to determine "I have enough data now" vs "I need more"

---

## State Machine: Paste Evaluation Flow

### States

```typescript
type PasteEvaluationState = 
  | "idle"                          // No active paste evaluation
  | "pending_user_answer"           // AI asked about paste, waiting for answer
  | "evaluating_confidence"         // AI analyzing if answer is sufficient
  | "ready_to_evaluate"             // AI has enough data, trigger evaluation
  | "evaluation_complete"           // Evaluation sent to DB
  | "evaluation_abandoned"          // Conversation drifted, cancel evaluation
```

### State Transitions

```
PASTE DETECTED
  ↓
idle → pending_user_answer
  ↓ (user responds)
evaluating_confidence
  ↓
  ├─→ [confidence < 70%] → pending_user_answer (ask follow-up)
  ├─→ [confidence >= 70%] → ready_to_evaluate
  └─→ [topic_drift = true] → evaluation_abandoned
```

---

## Confidence Scoring (Similar to Background Stage)

The AI must output a **hidden CONTROL message** after each user response during paste evaluation:

### CONTROL Message Format

```json
{
  "type": "PASTE_EVAL_CONTROL",
  "pasteEvaluationId": "uuid-of-pending-paste",
  "confidence": 75,  // 0-100
  "topicRelevance": 90,  // 0-100 - is user still talking about the paste?
  "readyToEvaluate": true,  // true when confidence >= 70 AND topicRelevance >= 60
  "needsFollowup": false,  // true if AI wants to ask another question
  "conversationDrifted": false  // true if topicRelevance < 40
}
```

### Confidence Criteria

**High Confidence (70-100):**
- User clearly explains what the code does
- User can modify or extend the code conceptually
- User identifies key functions/concepts correctly

**Medium Confidence (40-69):**
- User gives vague but somewhat relevant answers
- User understands surface-level but struggles with details
- User asks clarifying questions (shows engagement)

**Low Confidence (0-39):**
- User avoids the question ("I don't know", "Let me think")
- User gives completely incorrect explanations
- User changes subject

### Topic Relevance

**High Relevance (70-100):**
- User directly addresses the pasted code
- User references specific parts of the paste

**Medium Relevance (40-69):**
- User talks about related concepts but not the paste itself
- User asks tangential questions

**Low Relevance (0-39):**
- User changes topic entirely
- User talks about unrelated code

---

## AI System Prompt for Paste Evaluation

```typescript
const pasteEvaluationPersona = `You are a technical interviewer evaluating whether a candidate understands code they pasted from an external source.

**Current Context:**
- Candidate pasted: ${pastedContent}
- You asked: ${previousAIQuestion}
- Candidate answered: ${userAnswer}
- Previous confidence: ${previousConfidence}%

**Your Task:**
1. Determine if candidate understands the pasted code
2. If unclear, ask ONE follow-up question (max 2 sentences)
3. If confident in your assessment, indicate readyToEvaluate=true
4. If conversation has drifted off-topic, indicate conversationDrifted=true

**Response Format:**
First line: CONTROL: {CONTROL_JSON_HERE}
Second line onward: Your spoken/text response to the candidate

**CONTROL JSON Structure:**
{
  "type": "PASTE_EVAL_CONTROL",
  "pasteEvaluationId": "${pasteId}",
  "confidence": 0-100,
  "topicRelevance": 0-100,
  "readyToEvaluate": boolean,
  "needsFollowup": boolean,
  "conversationDrifted": boolean
}

**Rules:**
- Ask follow-ups if confidence < 70% AND topicRelevance >= 60%
- Set readyToEvaluate=true when confidence >= 70%
- Set conversationDrifted=true when topicRelevance < 40%
- Keep questions short and natural
- Don't teach or give hints
`;
```

---

## Data Structure: Pending Paste Evaluation

Store in Redux/React state:

```typescript
interface PendingPasteEvaluation {
  id: string;  // uuid
  pasteTimestamp: number;
  pastedContent: string;
  characterCount: number;
  
  // AI's first question
  aiInitialQuestion: string;
  aiInitialQuestionTimestamp: number;
  
  // Conversation history
  conversationTurns: Array<{
    speaker: "ai" | "user";
    text: string;
    timestamp: number;
  }>;
  
  // Confidence tracking
  confidenceHistory: Array<{
    confidence: number;
    topicRelevance: number;
    timestamp: number;
  }>;
  
  currentConfidence: number;
  currentTopicRelevance: number;
  
  // State
  state: PasteEvaluationState;
  
  // Final evaluation (when ready)
  finalUserAnswer?: string;
  finalAnswerTimestamp?: number;
}
```

---

## Implementation Flow

### 1. Paste Detected (EditorPanel)

```typescript
// EditorPanel detects paste
onPasteDetected?.(pastedContent, timestamp);

// InterviewIDE creates pending evaluation
const pendingEvaluation: PendingPasteEvaluation = {
  id: uuid(),
  pasteTimestamp: timestamp,
  pastedContent,
  characterCount: pastedContent.length,
  conversationTurns: [],
  confidenceHistory: [],
  currentConfidence: 0,
  currentTopicRelevance: 100,
  state: "idle",
};

// Store in state
setPendingPasteEvaluations(prev => [...prev, pendingEvaluation]);
```

### 2. AI Asks Initial Question (OpenAITextConversation)

```typescript
// Trigger AI to ask about paste
const aiQuestion = await askViaChatCompletion(
  openaiClient,
  pasteEvaluationPersona,
  historyMessages
);

// Update pending evaluation
updatePendingEvaluation(evaluationId, {
  aiInitialQuestion: aiQuestion,
  aiInitialQuestionTimestamp: Date.now(),
  state: "pending_user_answer",
  conversationTurns: [
    { speaker: "ai", text: aiQuestion, timestamp: Date.now() }
  ],
});
```

### 3. User Responds (ChatPanel → OpenAITextConversation)

```typescript
// User sends message
onUserMessage(userText);

// Add to conversation turns
updatePendingEvaluation(evaluationId, {
  conversationTurns: [
    ...turns,
    { speaker: "user", text: userText, timestamp: Date.now() }
  ],
  state: "evaluating_confidence",
});

// AI processes response with CONTROL output
const aiResponse = await askViaChatCompletion(
  openaiClient,
  pasteEvaluationPersona,
  conversationHistory
);

// Parse CONTROL message
const [controlLine, ...responseLinesconst controlJSON = JSON.parse(controlLine.replace("CONTROL: ", ""));
const aiText = responseLines.join("\n");

// Update confidence
updatePendingEvaluation(evaluationId, {
  currentConfidence: controlJSON.confidence,
  currentTopicRelevance: controlJSON.topicRelevance,
  confidenceHistory: [
    ...history,
    {
      confidence: controlJSON.confidence,
      topicRelevance: controlJSON.topicRelevance,
      timestamp: Date.now(),
    }
  ],
  conversationTurns: [
    ...turns,
    { speaker: "ai", text: aiText, timestamp: Date.now() }
  ],
});
```

### 4. Check Evaluation Readiness

```typescript
if (controlJSON.readyToEvaluate) {
  // Trigger evaluation
  updatePendingEvaluation(evaluationId, {
    state: "ready_to_evaluate",
    finalUserAnswer: lastUserMessage,
    finalAnswerTimestamp: lastUserTimestamp,
  });
  
  // Call evaluation API
  await evaluateAndSavePasteAccountability(evaluationId);
  
} else if (controlJSON.conversationDrifted) {
  // Abandon evaluation
  updatePendingEvaluation(evaluationId, {
    state: "evaluation_abandoned",
  });
  
  // Remove from pending list (don't save to DB)
  removePendingEvaluation(evaluationId);
  
} else if (controlJSON.needsFollowup) {
  // AI will ask another question in next turn
  updatePendingEvaluation(evaluationId, {
    state: "pending_user_answer",
  });
}
```

### 5. Final Evaluation (When Ready)

```typescript
async function evaluateAndSavePasteAccountability(evaluationId: string) {
  const evaluation = getPendingEvaluation(evaluationId);
  
  // Combine all conversation turns into context
  const conversationContext = evaluation.conversationTurns
    .map(t => `${t.speaker}: ${t.text}`)
    .join("\n");
  
  // Call OpenAI evaluation endpoint
  const result = await fetch("/api/interviews/evaluate-paste-accountability", {
    method: "POST",
    body: JSON.stringify({
      pastedContent: evaluation.pastedContent,
      aiQuestion: evaluation.aiInitialQuestion,
      userAnswer: evaluation.finalUserAnswer,
      fullConversation: conversationContext,  // Optional: full context
      codingTask: interviewScript.codingPrompt,
    }),
  });
  
  const { understanding, accountabilityScore, reasoning, caption } = await result.json();
  
  // Save to DB
  await fetch(`/api/interviews/session/${sessionId}/external-tools`, {
    method: "POST",
    body: JSON.stringify({
      timestamp: evaluation.pasteTimestamp,
      pastedContent: evaluation.pastedContent,
      characterCount: evaluation.characterCount,
      aiQuestion: evaluation.aiInitialQuestion,
      aiQuestionTimestamp: evaluation.aiInitialQuestionTimestamp,
      userAnswer: evaluation.finalUserAnswer,
      userAnswerTimestamp: evaluation.finalAnswerTimestamp,
      understanding,
      accountabilityScore,
      reasoning,
      caption,
    }),
  });
  
  // Mark complete
  updatePendingEvaluation(evaluationId, {
    state: "evaluation_complete",
  });
  
  // Remove from pending list
  removePendingEvaluation(evaluationId);
}
```

---

## Edge Cases

### Case 1: Multiple Pastes Before First Evaluation Completes

**Problem:** User pastes code, AI asks question, user pastes again before answering.

**Solution:** Maintain **array** of pending evaluations, each with unique ID.

```typescript
const [pendingPasteEvaluations, setPendingPasteEvaluations] = 
  useState<PendingPasteEvaluation[]>([]);
```

### Case 2: User Never Answers

**Problem:** AI asks about paste, user ignores and continues coding.

**Solution:** 
- Set timeout (e.g., 5 minutes)
- If no user response, mark as `evaluation_abandoned`
- Don't save to DB

### Case 3: User Pastes Mid-Conversation

**Problem:** User is answering background question when they paste code.

**Solution:**
- Only track pastes during `in_coding_session` state
- Ignore pastes in other stages

### Case 4: AI Asks Unrelated Question First

**Problem:** User already has pending paste evaluation, but AI asks about something else.

**Solution:**
- AI should prioritize paste evaluation questions
- Update system prompt to say: "First address the pending paste evaluation"
- If AI switches topics, mark paste evaluation as drifted

---

## Files to Modify

### 1. `InterviewIDE.tsx`
- Add `pendingPasteEvaluations` state
- Handle `onPasteDetected` with timestamp
- Create pending evaluation object
- Trigger evaluation when ready

### 2. `OpenAITextConversation.tsx`
- Update `handlePasteDetected` to use confidence mechanism
- Parse CONTROL messages for paste evaluation
- Track conversation turns
- Check readiness after each user response

### 3. `app/api/interviews/evaluate-paste-accountability/route.ts`
- Already created (✅)
- Optionally accept `fullConversation` parameter for richer context

### 4. `app/api/interviews/session/[sessionId]/external-tools/route.ts`
- Already created (✅)

---

## Testing Checklist

### Happy Path
- [ ] Paste detected → AI asks question
- [ ] User answers directly → Evaluation triggered → Saved to DB
- [ ] Confidence reaches 70% → Evaluation triggered

### Multi-Turn Conversations
- [ ] User asks clarifying question → AI answers → User then explains paste
- [ ] User gives vague answer → AI asks follow-up → User explains better
- [ ] Confidence builds gradually (30% → 50% → 75%)

### Edge Cases
- [ ] User pastes multiple times → Each tracked separately
- [ ] User ignores AI question → Timeout → Abandoned
- [ ] User changes topic mid-evaluation → Drifted → Abandoned
- [ ] Topic relevance drops below 40% → Abandoned

### DB Verification
- [ ] `ExternalToolUsage` record created with all timestamps
- [ ] `WorkstyleMetrics.externalToolUsage` incremented
- [ ] Caption matches understanding level
- [ ] Accountability score within 0-100

---

## Summary

The external tool usage evaluation is a **stateful, multi-turn conversation process** that:

1. **Tracks pending evaluations** as state objects
2. **Uses AI confidence scoring** (like background stage) to determine readiness
3. **Detects conversation drift** and abandons irrelevant evaluations
4. **Saves complete context** (paste, question, answer, timestamps) to DB
5. **Handles edge cases** (multiple pastes, timeouts, topic changes)

This ensures we only evaluate pastes where the candidate genuinely engaged with the AI's questions, providing high-quality accountability scores.

