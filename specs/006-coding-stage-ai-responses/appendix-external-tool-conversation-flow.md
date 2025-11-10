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
```

**Note:** We NEVER abandon evaluations. All paste events are saved to DB, even if conversation quality is poor (they just get low accountability scores).

### State Transitions

```
PASTE DETECTED
  ↓
idle → pending_user_answer
  ↓ (user responds)
evaluating_confidence
  ↓
  ├─→ [confidence < 70% AND turnCount < 3] → pending_user_answer (ask follow-up)
  └─→ [confidence >= 70% OR turnCount >= 3] → ready_to_evaluate
```

---

## Confidence Scoring (Similar to Background Stage)

The AI must output a **hidden CONTROL message** after each user response during paste evaluation:

### CONTROL Message Format

```json
{
  "type": "PASTE_EVAL_CONTROL",
  "pasteEvaluationId": "uuid-of-pending-paste",
  "confidence": 75,  // 0-100 - how well does AI understand what candidate knows
  "turnCount": 2,  // How many questions asked so far
  "readyToEvaluate": true  // true when confidence >= 70 OR turnCount >= 3
}
```

**Simplified Logic:**
- Ask up to 3 questions maximum
- Stop early if confidence >= 70%
- After 3 turns, evaluate with whatever data we have
- Even poor conversations (user drifted/didn't engage) get saved with low scores

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
- User changes subject / talks about unrelated things

**Note:** Even if confidence stays low (user drifted or didn't engage), we still evaluate after 3 turns. The final evaluation will reflect poor understanding with a low accountability score.

---

## AI System Prompt for Paste Evaluation

```typescript
const pasteEvaluationPersona = `You are a technical interviewer evaluating whether a candidate understands code they pasted from an external source.

**Current Context:**
- Candidate pasted: ${pastedContent}
- Conversation so far: ${conversationHistory}
- Current turn: ${turnCount}/3

**Your Task:**
1. Determine if candidate understands the pasted code (confidence 0-100)
2. If confidence < 70% and turnCount < 3, ask ONE follow-up question (1-2 sentences)
3. If confidence >= 70% OR turnCount >= 3, set readyToEvaluate=true
4. Vary your phrasing naturally - don't repeat exact same questions

**Response Format:**
First line: CONTROL: {CONTROL_JSON_HERE}
Second line onward: Your spoken/text response to the candidate

**CONTROL JSON Structure:**
{
  "type": "PASTE_EVAL_CONTROL",
  "pasteEvaluationId": "${pasteId}",
  "confidence": 0-100,
  "turnCount": ${turnCount},
  "readyToEvaluate": boolean
}

**Rules:**
- Set readyToEvaluate=true when confidence >= 70% OR turnCount >= 3
- Keep questions short and conversational
- If user avoids question, rephrase naturally
- Don't teach or give hints
- On turn 3, accept whatever answer you have
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
    timestamp: number;
  }>;
  
  currentConfidence: number;
  turnCount: number;
  
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
  turnCount: 0,
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

// Update confidence and turn count
updatePendingEvaluation(evaluationId, {
  currentConfidence: controlJSON.confidence,
  turnCount: controlJSON.turnCount,
  confidenceHistory: [
    ...history,
    {
      confidence: controlJSON.confidence,
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
  // Confidence >= 70% OR turnCount >= 3
  // Trigger evaluation (even if low confidence after 3 turns)
  updatePendingEvaluation(evaluationId, {
    state: "ready_to_evaluate",
    finalUserAnswer: lastUserMessage,
    finalAnswerTimestamp: lastUserTimestamp,
  });
  
  // Call evaluation API
  await evaluateAndSavePasteAccountability(evaluationId);
  
} else {
  // Continue conversation (confidence < 70% and turnCount < 3)
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
- If no user response, trigger evaluation with empty answer
- Save to DB with low accountability score (0-20)
- This shows candidate pasted but didn't engage

### Case 3: User Pastes Mid-Conversation

**Problem:** User is answering background question when they paste code.

**Solution:**
- Only track pastes during `in_coding_session` state
- Ignore pastes in other stages

### Case 4: User Changes Topic While Being Evaluated

**Problem:** User is being evaluated about a paste but changes topic.

**Solution:**
- Continue up to 3 turns regardless
- Final evaluation will see the irrelevant answers
- Low confidence + poor answers = low accountability score
- Still saves to DB (shows paste + disengagement)

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
- [ ] User ignores AI question → Timeout → Evaluated with empty answer → Low score
- [ ] User changes topic mid-evaluation → Continue 3 turns → Low score
- [ ] User gives irrelevant answers → Evaluated after 3 turns → Low score

### DB Verification
- [ ] `ExternalToolUsage` record created with all timestamps
- [ ] `WorkstyleMetrics.externalToolUsage` incremented
- [ ] Caption matches understanding level
- [ ] Accountability score within 0-100

---

## Message Tagging & History Isolation

### Problem

Paste evaluation creates a mini-conversation within the main interview:

```
AI: "Tell me about your background"
User: "I worked at Google"
--- PASTE DETECTED ---
AI: "Can you explain useEffect in this code?" ← paste eval
User: "No" ← paste eval
AI: "What about useState?" ← paste eval
User: "No" ← paste eval
--- PASTE EVAL ENDS ---
User: "Should I add error handling?"
AI: [sees "No, No" in history] "How can I help?" ← WRONG PERSONA
```

**Root cause:** Paste eval messages pollute the main interview context, confusing the AI's persona.

### Solution: Tag & Filter

**1. Tag messages during paste evaluation:**

```typescript
// When adding message during paste eval
post(message, speaker, { isPasteEval: true });
```

**2. Filter when building history for normal coding:**

```typescript
// In buildControlContextMessages or equivalent
const historyMessages = interviewChatStore.getState().messages
  .filter(m => !m.isPasteEval)  // Exclude paste eval messages
  .slice(-30)
  .map(m => ({
    role: m.speaker === "user" ? "user" : "assistant",
    content: m.text,
  }));
```

**Result:** Clean separation. Paste eval is a "side quest" that doesn't pollute the main interview narrative.

### Implementation

**Modify `interviewChatStore.ts`:**

```typescript
interface Message {
  text: string;
  speaker: "user" | "ai";
  timestamp: number;
  isPasteEval?: boolean;  // NEW: tag for paste evaluation messages
}
```

**Modify `post()` function signature:**

```typescript
post(text: string, speaker: "user" | "ai", metadata?: { isPasteEval?: boolean })
```

**Modify `buildControlContextMessages()`:**

```typescript
export function buildControlContextMessages(k: number) {
  const { messages } = interviewChatStore.getState();
  const filtered = messages.filter(m => !m.isPasteEval);  // NEW
  const slice = filtered.slice(-Math.max(1, k));
  return slice.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    content: m.text,
  }));
}
```

---

## Summary

The external tool usage evaluation is a **stateful, multi-turn conversation process** that:

1. **Tracks pending evaluations** as state objects (one per paste)
2. **Uses AI confidence scoring** (like background stage) to determine readiness
3. **3-turn maximum** - asks up to 3 questions, then evaluates regardless
4. **Never abandons** - all paste events saved to DB (even poor conversations)
5. **Saves complete context** (paste, question, answer, timestamps) to DB
6. **Handles edge cases** (multiple pastes, timeouts, topic changes, disengagement)
7. **Isolates paste eval messages** - tagged and filtered from main interview history

This ensures **complete transparency** - companies see ALL external tool usage with accountability scores reflecting engagement quality (high scores = good understanding, low scores = disengagement/poor understanding).

