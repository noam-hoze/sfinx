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
 * Validation angle probed by a follow-up question, used to prevent semantic repetition within a topic.
 */
export type ProbeAngle =
  | 'implementation'    // What ran inside it, how it was structured
  | 'sizing'            // How size/capacity/parameters were chosen
  | 'correctness'       // Concurrency, safety guarantees, producer/consumer model
  | 'measurement'       // How latency/throughput/occupancy was validated
  | 'observed_evidence' // What traces/logs/data actually showed
  | 'failure_mode'      // What broke, overflow, race conditions in practice
  | 'tradeoff'          // Why X over Y (must name both options)
  | 'redesign';         // What they would change now

/**
 * OpenAI response structure for question generation with classification
 */
export interface ClassifiedQuestionResponse {
  detectedAnswerType: AnswerType;
  question: string;        // Natural conversational response
  probeAngle?: ProbeAngle; // Angle of the follow-up generated (substantive answers only)
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
  recentHistory?: Array<{ question: string; answer: string }>; // Last ~4 Q+A pairs for context
  coveredAngles?: string[]; // Angles already probed for the current topic
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROMPT BUILDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Format recent Q+A history for injection into the classification prompt. */
function formatRecentHistory(history: Array<{ question: string; answer: string }>): string {
  if (history.length === 0) return '';
  const lines = history.map((h, i) => `Turn ${i + 1}:\nQ: ${h.question}\nA: ${h.answer}`).join('\n\n');
  return `\nRecent conversation (for context — do NOT repeat angles already probed):\n${lines}\n`;
}

/** Format covered angles list for injection into the classification prompt. */
function formatCoveredAngles(angles: string[]): string {
  return angles.length > 0 ? angles.join(', ') : 'none yet';
}

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
    isGibberish,
    recentHistory = [],
    coveredAngles = [],
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
- CONVERSATIONAL MOVES (choose one — do NOT use reflection templates):
  FORBIDDEN openers: "I see you...", "It's clear that...", "You mentioned...", "You highlighted...", "You utilized...", "So you explained..."
  A human interviewer does not echo the answer back. Pick a move that fits naturally:

  Direct zoom-in (start with the question, no preamble):
  * "How did you size that buffer?"
  * "What did you keep out of the ISR?"
  * "What was your overflow policy?"

  Challenge:
  * "Why a ring buffer and not something else?"
  * "What breaks if the consumer falls behind?"
  * "How did you know that margin was enough?"

  Ask for evidence:
  * "How did you actually measure that?"
  * "What did the traces show?"
  * "Did you have occupancy data from the real system?"

  Ask for a real case:
  * "Did you ever hit overflow in testing?"
  * "Walk me through one failure you saw."
  * "Give me one burst scenario you designed for."

  Narrow naturally:
  * "Let's stay on the buffer for a second — how did you size it?"
  * "On the overflow side — what policy did you choose?"
  * "Say more about that ISR path."

  Brief optional opener (non-reflective, only when natural):
  * "Got it." / "Right." / "Okay." / "Interesting." — then question immediately, NO restatement after

- DRILLING RULE (CRITICAL): Before writing a follow-up, scan the answer for the single most specific technical claim — a named data structure, metric, protocol, tool, design decision, concurrency model, or failure mode. Ask ONE targeted question about THAT specific claim.
  Examples of GOOD drilling:
  * Answer mentions "ring buffer" → "How did you size the buffer, and what was your overflow policy?"
  * Answer mentions "ISR" → "What specifically ran inside the ISR, and what did you explicitly keep out?"
  * Answer mentions "layer isolation" → "Give me one concrete bug — how did you prove which layer was responsible?"
  * Answer mentions "latency" → "What was your target latency, and how did you measure whether you hit it?"
  * Answer mentions "synchronization" → "Was this single-producer/single-consumer, and how did you guarantee correctness?"
  * Answer mentions a design choice → "You went with X — what specifically ruled out Y?"
- "What trade-offs did you consider?" is FORBIDDEN as a standalone follow-up. Only ask about trade-offs when you name the specific context: "You chose X over Y — what drove that?"
- Fallback probes (only when no extractable technical detail exists):
  * "Why that approach?"
  * "What alternatives did you explore?"
  * "Walk me through that decision"
- ANGLE TRACKING: Angles already covered for this topic: ${formatCoveredAngles(coveredAngles)}.
  Pick an UNCOVERED angle: implementation | sizing | correctness | measurement | observed_evidence | failure_mode | tradeoff | redesign.
  Set probeAngle in your JSON to the angle you chose.
- Or ask next question about: "${newFocusTopic}"
`;
  }

  return `Generate next question with answer classification.

Last Question: ${lastQuestion}
Last Answer: ${lastAnswer}
${formatRecentHistory(recentHistory)}
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
- FORBIDDEN OPENERS: Never start a follow-up with "I see you...", "It's clear that...", "You mentioned...", "You highlighted...", "You utilized...", or any phrase that echoes the candidate's answer back at them
- Start follow-ups with the question itself, or with a single non-reflective word ("Right.", "Got it.", "Okay.", "Interesting.") immediately followed by the question — never a restatement

Return JSON:
{
  "detectedAnswerType": "clarification_request" | "dont_know" | "substantive",
  "question": "Your naturally written response with appropriate acknowledgment + question",
  "probeAngle": "implementation|sizing|correctness|measurement|observed_evidence|failure_mode|tradeoff|redesign or null for non-substantive answers"
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

  // Random keyboard mashing (3+ consonants in a row, repeated)
  if (/([bcdfghjklmnpqrstvwxyz]{3,})/gi.test(trimmed) && trimmed.length < 15) return true;

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
 * Check if an answer is likely "I don't know" using regex fallback
 * Used for pre-computing exclusions before OpenAI classification
 */
export function isLikelyDontKnow(answer: string): boolean {
  return /\b(I don't know|not sure|no experience|haven't worked with|unfamiliar with|can't recall)\b/i.test(answer);
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
