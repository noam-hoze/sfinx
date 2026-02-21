/**
 * Answer classification types and utilities
 * Used by both split and legacy evaluation modes for OpenAI-based answer classification
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Answer classification result from OpenAI
 */
export type AnswerType =
  | 'clarification_request'  // Candidate asking to clarify/explain the question
  | 'dont_know'              // Candidate expressing uncertainty/lack of knowledge
  | 'substantive';           // Normal answer with content

/**
 * OpenAI response structure for question generation with classification
 */
export interface ClassifiedQuestionResponse {
  detectedAnswerType: AnswerType;
  question: string;  // Natural conversational response with varied acknowledgment
}

/**
 * Parameters for building classification prompt
 */
export interface ClassificationPromptParams {
  lastQuestion: string;
  lastAnswer: string;
  categoryList: string;
  newFocusTopic: string;
  clarificationRetryCount: number;
  clarificationThreshold: number;
  isGibberish: boolean;  // Pre-computed from regex (kept for speed)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROMPT BUILDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build OpenAI prompt for question generation with answer classification
 * Used by both next-question and evaluate-answer-fast endpoints
 */
export function buildClassificationPrompt(params: ClassificationPromptParams): string {
  const {
    lastQuestion,
    lastAnswer,
    categoryList,
    newFocusTopic,
    clarificationRetryCount,
    clarificationThreshold,
    isGibberish
  } = params;

  const retryCount = clarificationRetryCount;
  const atThreshold = retryCount >= clarificationThreshold - 1;

  // Build context-aware instructions
  let answerTypeGuidance = '';

  if (isGibberish) {
    // Gibberish detected by regex - provide appropriate response
    if (atThreshold) {
      answerTypeGuidance = `
GIBBERISH HANDLING (Threshold Reached):
The candidate provided nonsensical input after ${clarificationThreshold} attempts.

1. Set detectedAnswerType: "dont_know"
2. Say: "I understand you might not have experience with this, let's move forward to something else."
3. Then naturally transition to: "${newFocusTopic}"`;
    } else {
      answerTypeGuidance = `
GIBBERISH HANDLING (Attempt ${retryCount + 1} of ${clarificationThreshold}):
The candidate provided a nonsensical or meaningless answer.

1. Set detectedAnswerType: "clarification_request"
2. Say: "I didn't catch that. Could you provide a more detailed answer?"
3. Do NOT advance to a new question.`;
    }
  } else {
    // Normal flow - classify the answer
    answerTypeGuidance = `
ANSWER CLASSIFICATION:
Analyze the candidate's answer and classify it:

1. **clarification_request** - If the candidate is:
   - Asking you to clarify/explain the question ("what do you mean?", "can you explain?", "huh?", "sorry?", "come again?")
   - Expressing confusion about what you're asking
   - Examples: "What do you mean by that?", "Can you rephrase?", "I'm not sure I understand the question"

2. **dont_know** - If the candidate is:
   - Expressing lack of knowledge ("I don't know", "not sure", "no experience")
   - Indicating unfamiliarity with the topic
   - Examples: "I don't know", "I'm not familiar with that", "Haven't worked with it", "No experience there"

3. **substantive** - If the candidate:
   - Provided an actual answer with content (even if brief or weak)
   - Examples: Any answer attempting to address the question

${retryCount > 0 ? `
RETRY CONTEXT:
This is retry attempt ${retryCount + 1} of ${clarificationThreshold}.
${atThreshold ? 'At threshold - if classified as clarification_request, move to next topic instead.' : 'Under threshold - clarification is acceptable.'}
` : ''}

RESPONSE GENERATION:
Based on classification, generate your response:

**If clarification_request:**
${atThreshold ? `
- Set detectedAnswerType: "dont_know" (threshold reached, treat as skip)
- CRITICAL: Use ONLY these COLLABORATIVE phrases (NOT the dont_know pattern below):
  * "You know what, let's move on to something else"
  * "Tell you what, let's try a different topic"
  * "Let's shift gears here"
  * "No worries, let's talk about something else instead"
  * "How about we explore a different area"
  * "Let's pivot to something else"
- DO NOT use "Understood" or "I understand" - be empathetic and collaborative
- Pick a DIFFERENT phrase each time
- Then naturally transition to: "${newFocusTopic}"
` : `
- Set detectedAnswerType: "clarification_request"
- Provide brief clarification (1-2 sentences)
- Rephrase the question using simpler language or concrete example
- Confirm understanding with VARIED phrasing (NEVER repeat the same phrase twice):
  * "Does that help clarify? Can you give it a shot?"
  * "Is that clearer? What are your thoughts?"
  * "Make sense? Can you speak to that?"
  * "Got it? How would you approach it?"
  * "Clear enough? What's your take?"
  * "Understand what I'm asking? Can you address that?"
- Pick a DIFFERENT confirmation phrase each time
`}

**If dont_know:**
- Set detectedAnswerType: "dont_know"
- Use VARIED acknowledgment (CRITICAL: NEVER use the same phrase twice in a row):
  * "Understood. In that case..."
  * "Alright, moving on..."
  * "Got it. Let me ask about..."
  * "Noted. Let's shift to..."
  * "Fair enough. How about..."
  * "Right. Let me ask you about..."
  * "Okay. Shifting gears..."
  * "I see. Let's talk about..."
  * "No problem. Moving to..."
  * "Sounds good. How about..."
- Pick a DIFFERENT acknowledgment each time to sound natural, not robotic
- Then naturally transition to: "${newFocusTopic}"

**If substantive:**
- Set detectedAnswerType: "substantive"
- Acknowledge what they said with VARIED phrasing (be specific to their answer):
  * "I see you used X approach"
  * "So you prioritized Y over Z"
  * "Interesting that you chose A"
  * "You mentioned B was important"
  * "Got it, you went with C"
  * "Right, so you focused on D"
- Then probe deeper with VARIED questions:
  * "What trade-offs did you consider?"
  * "Why that approach?"
  * "What challenges did that create?"
  * "How did you decide on that?"
  * "What alternatives did you explore?"
  * "Walk me through that decision"
- Or ask next question about: "${newFocusTopic}"
`;
  }

  return `Generate next question with answer classification.

Last Question: ${lastQuestion}
Last Answer: ${lastAnswer}

Current status: ${categoryList}

CRITICAL INSTRUCTION - VARIATION REQUIRED:
You MUST vary your acknowledgments and confirmation phrases in EVERY response.
NEVER use the same wording twice. A real interviewer naturally varies their language.
Examples shown below are for guidance - DO NOT copy them verbatim. Create your own variations.

${answerTypeGuidance}

TONE REQUIREMENTS (CRITICAL):
- Professional, engaged, curious
- Natural conversational flow (not robotic)
- NEVER REPEAT THE SAME ACKNOWLEDGMENT OR CONFIRMATION PHRASE
- Each response must use DIFFERENT wording than previous responses
- Vary your vocabulary, sentence structure, and phrasing
- Brief and to the point (≤2 sentences before question)
- Sound like a real human interviewer, not a template

Return JSON:
{
  "detectedAnswerType": "clarification_request" | "dont_know" | "substantive",
  "question": "Your naturally written response with appropriate acknowledgment + question"
}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Detect gibberish using deterministic regex patterns
 * Kept separate from OpenAI classification for speed and cost efficiency
 */
export function isGibberishAnswer(answer: string): boolean {
  const trimmed = answer.trim();

  // Very short (< 3 chars) or only repeating characters
  if (trimmed.length < 3 || /^(.)\1+$/.test(trimmed)) return true;

  // Only special characters/numbers
  if (!/[a-zA-Z]/.test(trimmed)) return true;

  // Repeated patterns like "asdf asdf asdf" or "blah blah blah"
  if (/^(\w{2,4})\s*\1\s*\1/.test(trimmed.toLowerCase())) return true;

  // Random keyboard mashing (5+ consonants in a row, unlikely in legitimate English)
  if (/([bcdfghjklmnpqrstvwxyz]{5,})/gi.test(trimmed) && trimmed.length < 15) return true;

  return false;
}

/**
 * Check if answer is exact "I don't know" for client-side optimization
 * Returns true if answer is literally just "i don't know" (case insensitive)
 */
export function isExactDontKnow(answer: string): boolean {
  return answer.trim().toLowerCase() === "i don't know";
}

/**
 * Determine if retry counter should increment based on answer type
 */
export function shouldIncrementRetryCounter(
  answerType: AnswerType,
  retryCount: number,
  threshold: number
): boolean {
  // Increment for clarification requests (under threshold)
  if (answerType === 'clarification_request' && retryCount < threshold - 1) {
    return true;
  }

  return false;
}

/**
 * Determine if we should move to next question (threshold reached)
 */
export function shouldMoveToNextQuestion(
  answerType: AnswerType,
  retryCount: number,
  threshold: number
): boolean {
  // Move on if threshold reached for clarification
  if (answerType === 'clarification_request' && retryCount >= threshold - 1) {
    return true;
  }

  return false;
}
