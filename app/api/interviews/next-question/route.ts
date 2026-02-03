import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import prisma from "lib/prisma";
import OpenAI from "openai";
import { CONTRIBUTIONS_TARGET } from "shared/constants/interview";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

/**
 * POST /api/interviews/next-question
 * Ultra-fast question generation (target <500ms) with NO scoring logic.
 * Part of split evaluation architecture for improved user experience.
 */
export async function POST(request: NextRequest) {
    try {
        // Feature flag check
        const useSplitEvaluation = process.env.NEXT_PUBLIC_USE_SPLIT_EVALUATION === 'true';
        if (!useSplitEvaluation) {
            return NextResponse.json(
                { error: "Split evaluation not enabled" },
                { status: 503 }
            );
        }

        const body = await request.json();
        const {
            sessionId,
            lastQuestion,
            lastAnswer,
            experienceCategories,
            currentCounts,
            currentFocusTopic,
            excludedTopics,
            clarificationRetryCount
        } = body;

        if (!sessionId || !lastQuestion || lastAnswer === undefined || !experienceCategories || !currentCounts) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        if (!Array.isArray(excludedTopics)) {
            return NextResponse.json(
                { error: "excludedTopics must be an array" },
                { status: 400 }
            );
        }

        const CLARIFICATION_THRESHOLD = parseInt(
            process.env.NEXT_PUBLIC_CLARIFICATION_THRESHOLD || '3',
            10
        );
        const retryCount = clarificationRetryCount || 0;

        log.info(LOG_CATEGORY, "[next-question] Question generation started");

        // Fetch session to get company/job context (minimal fetch for speed)
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                application: {
                    include: {
                        job: {
                            include: {
                                company: true,
                            },
                        },
                    },
                },
            },
        });

        if (!session?.application?.job) {
            throw new Error("Session or job not found");
        }

        const companyName = session.application.job.company?.name;
        const jobTitle = session.application.job.title;

        const evaluationModel = process.env.NEXT_PUBLIC_OPENAI_EVALUATION_MODEL;
        if (!evaluationModel) {
            throw new Error("NEXT_PUBLIC_OPENAI_EVALUATION_MODEL environment variable is not set");
        }

        // Filter out excluded categories
        let activeCategories = experienceCategories.filter(
            (cat: any) => !excludedTopics.includes(cat.name)
        );

        // Check if all categories excluded
        if (activeCategories.length === 0) {
            log.info(LOG_CATEGORY, "[next-question] All categories excluded - ending interview");
            return NextResponse.json({
                success: true,
                allCategoriesExcluded: true,
                question: null,
                newFocusTopic: null,
                isGibberish: false,
                isClarificationRequest: false,
                isDontKnow: false,
                shouldIncrementRetry: false,
                shouldMoveOn: false,
            });
        }

        // Build category list with current counts (using active categories only)
        const TARGET = CONTRIBUTIONS_TARGET;

        const categoryList = activeCategories.map((cat: any) => {
            const stats = currentCounts.find((c: any) => c.categoryName === cat.name);
            return `${cat.name}: ${stats?.count || 0} contributions (avg ${stats?.avgStrength || 0}%)`;
        }).join(', ');

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // FAST DETECTION: Regex-based patterns (no AI call needed)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        // GIBBERISH DETECTION: Check if answer is nonsensical or meaningless
        const isGibberish = (() => {
            const trimmed = lastAnswer.trim();
            // Very short (< 3 chars) or only repeating characters
            if (trimmed.length < 3 || /^(.)\1+$/.test(trimmed)) return true;
            // Only special characters/numbers
            if (!/[a-zA-Z]/.test(trimmed)) return true;
            // Repeated patterns like "asdf" or "blah blah blah"
            if (/^(\w{2,4})\s*\1\s*\1/.test(trimmed.toLowerCase())) return true;
            // Random keyboard mashing (3+ consonants in a row, repeated)
            if (/([bcdfghjklmnpqrstvwxyz]{3,})/gi.test(trimmed) && trimmed.length < 15) return true;
            return false;
        })();

        // CLARIFICATION DETECTION: Check if candidate is asking for clarification
        const isClarificationRequest = !isGibberish && /\b(what do you mean|can you explain|could you clarify|I don't understand|what does that mean|can you rephrase|could you repeat)\b/i.test(lastAnswer);

        // ACKNOWLEDGMENT DETECTION: Check if candidate appears to be asking a general question
        const appearsToBeQuestion = !isGibberish && !isClarificationRequest && /\b(why|can you|could you|how come|tell me more about|explain)\b/i.test(lastAnswer);

        // "I DON'T KNOW" QUICK DETECTION (regex-based, for flow control)
        const isDontKnowQuick = /\b(I don't know|not sure|no experience|haven't worked with|unfamiliar with|can't recall)\b/i.test(lastAnswer);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // DETERMINISTIC TOPIC SELECTION
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const activeCategoryNames = activeCategories.map((cat: any) => cat.name);
        let countsForSelection = currentCounts.filter((c: any) => activeCategoryNames.includes(c.categoryName));

        // If "I don't know" detected, increment dontKnowCount for current focus topic
        if (isDontKnowQuick && currentFocusTopic) {
            countsForSelection = countsForSelection.map((c: any) => {
                if (c.categoryName === currentFocusTopic) {
                    return { ...c, dontKnowCount: c.dontKnowCount + 1 };
                }
                return c;
            });

            // Re-compute exclusions with incremented count
            if (!process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD) {
                throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD environment variable is not set");
            }
            const threshold = parseInt(process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD, 10);
            if (!Number.isFinite(threshold) || threshold < 1) {
                throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD must be a positive integer");
            }

            const newExcludedTopics = countsForSelection
                .filter((c: any) => c.dontKnowCount >= threshold)
                .map((c: any) => c.categoryName);

            if (newExcludedTopics.length > 0) {
                // Re-filter active categories
                const newActiveCategories = experienceCategories.filter(
                    (cat: any) => !newExcludedTopics.includes(cat.name)
                );

                // Check if all categories now excluded
                if (newActiveCategories.length === 0) {
                    log.info(LOG_CATEGORY, "[next-question] All categories excluded after 'I don't know' increment");
                    return NextResponse.json({
                        success: true,
                        allCategoriesExcluded: true,
                        question: null,
                        newFocusTopic: null,
                        isGibberish: false,
                        isClarificationRequest: false,
                        isDontKnow: isDontKnowQuick,
                        shouldIncrementRetry: false,
                        shouldMoveOn: false,
                    });
                }

                // Update activeCategories for topic selection below
                activeCategories = newActiveCategories;

                // Re-calculate countsForSelection with updated exclusions
                const activeCategoryNames = activeCategories.map((cat: any) => cat.name);
                countsForSelection = countsForSelection.filter((c: any) =>
                    activeCategoryNames.includes(c.categoryName)
                );
            }
        }

        // Partition: active (count < TARGET) vs inactive (count >= TARGET)
        const active = countsForSelection.filter((c: any) => c.count < TARGET);

        let newFocusTopic: string;
        if (active.length > 0) {
            // MODE 1: Contribution collection - prefer higher count, tie-break by higher strength
            newFocusTopic = active.sort((a: any, b: any) =>
                b.count - a.count || b.avgStrength - a.avgStrength
            )[0].categoryName;
        } else {
            // MODE 2: Rebalance - pick weakest category (lowest avgStrength)
            newFocusTopic = countsForSelection.sort((a: any, b: any) =>
                a.avgStrength - b.avgStrength
            )[0].categoryName;
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // BUILD FOCUS INSTRUCTION FOR OPENAI PROMPT
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        let focusInstruction = `Ask your next question about: "${newFocusTopic}"`;
        let clarificationHandling = "";
        let shouldIncrementRetry = false;
        let shouldMoveOn = false;

        if (isGibberish) {
            if (retryCount < CLARIFICATION_THRESHOLD - 1) {
                // Under threshold: prompt for real answer
                clarificationHandling = `
GIBBERISH DETECTED (Attempt ${retryCount + 1} of ${CLARIFICATION_THRESHOLD}):
The candidate provided a nonsensical or meaningless answer (e.g., random characters, very short response, keyboard mashing).

Say: "I didn't catch that. Could you provide a more detailed answer?"

Do NOT advance to a new question. Give them another chance to provide a meaningful response.`;
                shouldIncrementRetry = true;
            } else {
                // At threshold: politely move on
                clarificationHandling = `
RETRY THRESHOLD REACHED (${CLARIFICATION_THRESHOLD} attempts):
The candidate has not provided meaningful answers after multiple attempts. It's time to move forward.

Say: "I understand you might not have experience with this, so let's move forward to something else."

Then naturally transition to your next question about: "${newFocusTopic}"`;
                focusInstruction = ""; // Don't repeat the focus instruction
                shouldMoveOn = true;
            }
        } else if (isClarificationRequest) {
            if (retryCount < CLARIFICATION_THRESHOLD - 1) {
                // Under threshold: clarify and confirm understanding
                clarificationHandling = `
CLARIFICATION REQUEST DETECTED (Attempt ${retryCount + 1} of ${CLARIFICATION_THRESHOLD}):
The candidate is asking for clarification about your previous question.

1. Provide a brief, clear explanation of what you meant (1-2 sentences)
2. Rephrase the question using simpler or more concrete language
3. Confirm understanding by asking: "Does that make sense? Can you try answering now?"

Do NOT advance to a new question. Do NOT treat this as a failed answer.`;
                shouldIncrementRetry = true;
            } else {
                // At threshold: politely move on
                clarificationHandling = `
RETRY THRESHOLD REACHED (${CLARIFICATION_THRESHOLD} attempts):
The candidate has asked for clarification multiple times. It's time to move forward.

Say: "I understand you might not have experience with this, so let's move forward to something else."

Then naturally transition to your next question about: "${newFocusTopic}"`;
                focusInstruction = ""; // Don't repeat the focus instruction
                shouldMoveOn = true;
            }
        } else if (isDontKnowQuick) {
            // "I don't know" / Skip response - ensure acknowledgment
            focusInstruction = `
SKIP DETECTED:
The candidate indicated they don't know or have no experience with this topic.

Acknowledge briefly with transition (VARY your response, don't repeat the same phrase):
- "Understood. In that case..."
- "Alright, moving on..."
- "Got it. Let me ask about..."
- "Noted. Let's shift to..."
- "Fair enough. How about..."
- "I see. Let me ask you about..."

Pick a DIFFERENT acknowledgment each time to maintain natural conversation flow.

Then naturally transition to your next question about: "${newFocusTopic}"`;
        } else if (appearsToBeQuestion) {
            focusInstruction = `
ACKNOWLEDGMENT INSTRUCTION:
The candidate appears to have asked a question. Provide a brief (1 sentence) response that addresses their question without over-explaining, then continue to your next question naturally.

${focusInstruction}`;
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // OPENAI PROMPT: QUESTION GENERATION ONLY (NO SCORING)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const quickPrompt = `Generate next question only.

Last Question: ${lastQuestion}
Last Answer: ${lastAnswer}

Current status: ${categoryList}

${clarificationHandling || focusInstruction}

RESPONSE PATTERNS (maintain conversational flow):

When candidate says "I don't know" / Skip:
- Brief acknowledgment + transition: "Understood. In that case...", "Alright, moving on...", "Got it. Let me ask about..."
- Do NOT say: "That's fine", "No worries", "Perfectly fine", "No problem", "Not every role requires..."
- Then ask your next question naturally

When answer is substantive/detailed:
- Acknowledge what they said: "I see you used X approach.", "So you prioritized Y over Z.", "You mentioned A was a constraint."
- Then probe deeper: "What trade-offs did you consider?", "Why that approach?", "What made that difficult?"
- Show you're listening, then dive deeper

When answer is vague/weak:
- Brief neutral acknowledgment: "Got it.", "I see."
- Then probe for specifics or move to next question

When candidate asks clarification:
- Rephrase the question with context/example
- Do NOT over-explain or provide hints
- Wait for their answer

Tone: Professional, engaged, curious. Not comforting, not robotic. Like a real technical interviewer who's listening.

Return JSON:
{
  "question": "Your naturally written next question"
}`;

        const messages = [
            {
                role: "system" as const,
                content: companyName && jobTitle
                    ? `You are a technical interviewer at ${companyName} evaluating candidates for the ${jobTitle} position. Return valid JSON only.`
                    : "You are a technical interviewer. Return valid JSON only.",
            },
            {
                role: "user" as const,
                content: quickPrompt,
            },
        ];

        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("→ OpenAI Request [next-question]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Model:", evaluationModel);
        console.log("\nSystem:", messages[0].content);
        console.log("\nUser Prompt:", messages[1].content);

        const startTime = Date.now();
        const completion = await openai.chat.completions.create({
            model: evaluationModel,
            messages,
            response_format: { type: "json_object" },
            temperature: 0.7, // More natural for question generation
            max_tokens: 150, // Keep questions short
        });
        const elapsed = Date.now() - startTime;

        const responseText = completion.choices[0]?.message?.content;
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("← OpenAI Response [next-question]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Latency: ${elapsed}ms`);
        console.log(JSON.stringify(JSON.parse(responseText || "{}"), null, 2));
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        if (!responseText) {
            throw new Error("OpenAI returned empty response");
        }

        const result = JSON.parse(responseText);

        log.info(LOG_CATEGORY, `[next-question] Question generated in ${elapsed}ms`);

        return NextResponse.json({
            success: true,
            question: result.question,
            newFocusTopic,
            isGibberish,
            isClarificationRequest,
            isDontKnow: isDontKnowQuick,
            shouldIncrementRetry,
            shouldMoveOn,
            latencyMs: elapsed, // For monitoring
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[next-question] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
