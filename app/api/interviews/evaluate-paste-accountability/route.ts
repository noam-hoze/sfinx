import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { log } from "app/shared/services";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const MAX_PASTE_QUESTIONS = process.env.NEXT_PUBLIC_MAX_PASTE_QUESTIONS;

        if (!MAX_PASTE_QUESTIONS) {
            throw new Error("NEXT_PUBLIC_MAX_PASTE_QUESTIONS is required");
        }

        const questionsLimit = parseInt(MAX_PASTE_QUESTIONS, 10);

        if (isNaN(questionsLimit) || questionsLimit <= 0) {
            throw new Error("NEXT_PUBLIC_MAX_PASTE_QUESTIONS must be a positive integer");
        }

        const body = await request.json();
        const { pastedContent, question, answer, codingTask, questionNumber, currentTopicCoverage } = body;

        if (!pastedContent || !question || !answer) {
            return NextResponse.json(
                { error: "Missing required fields: pastedContent, question, answer" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, `[Paste Accountability] Evaluating Q${questionNumber || '?'} understanding...`);

        // Build prompt based on whether we have topics (Phase 2) or not (Phase 1)
        const hasTopics = currentTopicCoverage && Object.keys(currentTopicCoverage).length > 0;
        
        let systemPrompt;
        if (hasTopics) {
            // Phase 2: Score answer AND update topic coverage
            const topicsList = Object.entries(currentTopicCoverage)
                .map(([name, pct]) => `- ${name}: ${pct}%`)
                .join("\n");
            
            systemPrompt = `You are evaluating a single question-answer exchange about pasted code AND updating topic coverage percentages.

**Context:**
- Coding Task: ${codingTask || "Build a React component"}
- Code Pasted: ${pastedContent}
- Question #${questionNumber || '?'} of ${questionsLimit}: ${question}
- Candidate's Answer: ${answer}

**Current Topic Coverage:**
${topicsList}

**Step 1 – Classify answer INTENT (do this first):**
Determine what the candidate is communicating with their answer:

- "dont_know" → Candidate is explicitly giving up or refusing to engage:
  Examples: "I don't know", "no idea", "pass", "skip", "not sure at all", gibberish, single characters, or any answer that signals they cannot or will not attempt to answer

- "clarification_request" → Candidate is asking for clarification or expressing confusion about the question itself:
  Examples: "what do you mean?", "can you explain?", "I don't understand the question", "could you rephrase?"

- "substantive" → Candidate attempted to actually answer the question (even if the answer is wrong, vague, or poor)
  Examples: Any answer that engages with the content of the question, even partially

IMPORTANT: "understandingLevel" reflects answer QUALITY. "detectedAnswerType" reflects answer INTENT. A candidate can have understandingLevel "none" but still be giving a substantive (even if wrong) answer.

**Step 2 – Score this specific answer (0-100):**
Only score if detectedAnswerType is "substantive". If "dont_know" or "clarification_request", score = 0.
- 90-100: Exceptional - demonstrates deep understanding, mentions edge cases, best practices
- 75-89: Strong - accurate explanation with good detail
- 60-74: Adequate - basic understanding, some gaps
- 40-59: Weak - superficial or partially incorrect
- 0-39: Poor - fundamental misunderstanding

**Step 3 – Identify topics addressed:**
Identify which topics the answer attempts to address. Include even vague or incorrect attempts.

Return ONLY valid JSON with this exact structure:
{
  "detectedAnswerType": "dont_know" | "clarification_request" | "substantive",
  "score": number (0-100),
  "reasoning": "Brief explanation of why this answer received this score",
  "understandingLevel": "full" | "partial" | "none",
  "topicsAddressed": ["Topic Name 1", "Topic Name 2"],
  "questionCount": ${questionNumber || 1},
  "maxQuestions": ${questionsLimit},
  "targetScore": 100
}

IMPORTANT: Include topics even if the answer quality is poor - what matters is WHAT the answer tried to explain, not HOW WELL.`;
        } else {
            // Phase 1: Score only (backward compatible)
            systemPrompt = `You are evaluating a single question-answer exchange about pasted code in a coding interview.

**Context:**
- Coding Task: ${codingTask || "Build a React component"}
- Code Pasted: ${pastedContent}
- Question #${questionNumber || '?'}: ${question}
- Candidate's Answer: ${answer}

**Step 1 – Classify answer INTENT:**
- "dont_know" → Candidate is explicitly giving up or refusing to engage ("I don't know", "pass", "skip", gibberish, etc.)
- "clarification_request" → Candidate is asking for clarification about the question ("what do you mean?", "can you explain?", etc.)
- "substantive" → Candidate attempted to actually answer (even if wrong or vague)

**Step 2 – Score this specific answer (0-100):**
Only score if detectedAnswerType is "substantive". If "dont_know" or "clarification_request", score = 0.
- 80-100: Clear, accurate explanation; demonstrates full understanding
- 50-79: Mostly correct but missing details or shows some confusion
- 20-49: Vague, incomplete, or partially incorrect
- 0-19: Wrong, avoids question, or shows no understanding

Return ONLY valid JSON with this exact structure:
{
  "detectedAnswerType": "dont_know" | "clarification_request" | "substantive",
  "score": number (0-100),
  "reasoning": "Brief explanation of why this answer received this score",
  "understandingLevel": "full" | "partial" | "none"
}`;
        }

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Evaluate this answer and return the result.`,
                },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error("Empty response from OpenAI");
        }

        const result = JSON.parse(content);
        
        // Validate basic fields
        if (
            typeof result.score !== "number" ||
            !result.reasoning ||
            !result.understandingLevel
        ) {
            throw new Error("Invalid response structure from OpenAI");
        }

        // Validate Phase 2 fields if topics were provided
        if (hasTopics) {
            if (!result.topicsAddressed || !Array.isArray(result.topicsAddressed)) {
                throw new Error("Invalid response structure: missing topicsAddressed");
            }
            // Add metadata fields if not present (backward compatible)
            if (typeof result.questionCount !== 'number') {
                result.questionCount = questionNumber || 1;
            }
            if (typeof result.maxQuestions !== 'number') {
                result.maxQuestions = questionsLimit;
            }
            if (typeof result.targetScore !== 'number') {
                result.targetScore = 100;
            }
        }

        log.info(LOG_CATEGORY, `[Paste Accountability] Q${questionNumber || '?'} score: ${result.score}`);

        return NextResponse.json(result);
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[Paste Accountability] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to evaluate paste accountability",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

