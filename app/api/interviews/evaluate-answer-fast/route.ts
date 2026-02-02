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
 * POST /api/interviews/evaluate-answer-fast
 * Fast evaluation: returns only category scores and next question (no reasoning/captions/DB saves)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, question, answer, experienceCategories, currentCounts, currentFocusTopic, conversationHistory, excludedTopics, answerHistory, clarificationRetryCount } = body;

        if (!sessionId || !question || answer === undefined || !experienceCategories || !currentCounts) {
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

        log.info(LOG_CATEGORY, "[evaluate-answer-fast] Fast evaluation started");

        // Fetch session to get company/job context
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
            log.info(LOG_CATEGORY, "[evaluate-answer-fast] All categories excluded - ending interview");
            return NextResponse.json({
                success: true,
                allCategoriesExcluded: true,
                scores: [],
                question: null,
                isDontKnow: false,
                updatedCounts: currentCounts,
                newFocusTopic: null,
            });
        }

        // Build category list with current counts (using active categories only)
        const TARGET = CONTRIBUTIONS_TARGET;
        
        const categoryList = activeCategories.map((cat: any) => {
            const stats = currentCounts.find((c: any) => c.categoryName === cat.name);
            return `${cat.name}: ${stats?.count || 0} contributions (avg ${stats?.avgStrength || 0}%)`;
        }).join(', ');

        // GIBBERISH DETECTION: Check if answer is nonsensical or meaningless
        const isGibberish = (() => {
            const trimmed = answer.trim();
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
        const isClarificationRequest = !isGibberish && /\b(what do you mean|can you explain|could you clarify|I don't understand|what does that mean|can you rephrase|could you repeat)\b/i.test(answer);

        // ACKNOWLEDGMENT DETECTION: Check if candidate appears to be asking a general question
        const appearsToBeQuestion = !isGibberish && !isClarificationRequest && /\b(why|can you|could you|how come|tell me more about|explain)\b/i.test(answer);

        // DETERMINISTIC ROUTING: Pick next topic based on current counts
        const activeCategoryNames = activeCategories.map((cat: any) => cat.name);
        const countsForSelection = currentCounts.filter((c: any) => activeCategoryNames.includes(c.categoryName));

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

        // Build focus instruction based on gibberish, clarification status, and retry count
        let focusInstruction = `Ask your next question about: "${newFocusTopic}"`;
        let clarificationHandling = "";

        if (isGibberish) {
            if (retryCount < CLARIFICATION_THRESHOLD - 1) {
                // Under threshold: prompt for real answer
                clarificationHandling = `
GIBBERISH DETECTED (Attempt ${retryCount + 1} of ${CLARIFICATION_THRESHOLD}):
The candidate provided a nonsensical or meaningless answer (e.g., random characters, very short response, keyboard mashing).

Say: "I didn't catch that. Could you provide a more detailed answer?"

Do NOT advance to a new question. Give them another chance to provide a meaningful response.`;
            } else {
                // At threshold: politely move on
                clarificationHandling = `
RETRY THRESHOLD REACHED (${CLARIFICATION_THRESHOLD} attempts):
The candidate has not provided meaningful answers after multiple attempts. It's time to move forward.

Say: "I understand you might not have experience with this, so let's move forward to something else."

Then naturally transition to your next question about: "${newFocusTopic}"`;
                focusInstruction = ""; // Don't repeat the focus instruction
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
            } else {
                // At threshold: politely move on
                clarificationHandling = `
RETRY THRESHOLD REACHED (${CLARIFICATION_THRESHOLD} attempts):
The candidate has asked for clarification multiple times. It's time to move forward.

Say: "I understand you might not have experience with this, so let's move forward to something else."

Then naturally transition to your next question about: "${newFocusTopic}"`;
                focusInstruction = ""; // Don't repeat the focus instruction
            }
        } else if (appearsToBeQuestion) {
            focusInstruction = `
ACKNOWLEDGMENT INSTRUCTION:
The candidate appears to have asked a question. Provide a brief (1 sentence) response that addresses their question without over-explaining, then continue to your next question naturally.

${focusInstruction}`;
        }

        const fastPrompt = `Score this answer and generate next question.

Last Question: ${question}
Last Answer: ${answer}

Current status: ${categoryList}

Step 1 - Detect uncertainty:
If the answer says "I don't know" or similar ("not sure", "no experience", "haven't worked with that"), set isDontKnow: true
Otherwise set isDontKnow: false

Step 2 - Score each category 0-100:
0=blank, 1-30=vague, 31-60=basic, 61-80=clear, 81-100=exceptional

Step 3 - Generate next question:
${clarificationHandling || focusInstruction}

ACKNOWLEDGMENT GUIDANCE:
When you detected isDontKnow=true in Step 1:
- Start with a brief, natural acknowledgment (1 sentence) such as:
  * "That's perfectly fine - not every role requires that experience"
  * "No worries, let's explore a different angle"
  * "I understand - that's a specialized area"
  * "Thanks for being direct about that"
- Then transition smoothly to your next question

When the answer received low scores (1-30 range, vague tier) in Step 2:
- Acknowledge it naturally (1 sentence) such as:
  * "I appreciate you sharing that perspective"
  * "Thanks for that context"
  * "That gives me a starting point"
- Then transition to your next question

Otherwise, write your next question naturally - you may acknowledge their answer if appropriate, or go direct to the next question. Use the curiosity tools from your system prompt. Vary your phrasing to avoid repetition.

Step 4 - Describe evaluation intent:
Write one natural, calm sentence describing the lens or perspective the interviewer is listening through for this answer.

The sentence must NOT restate or paraphrase the question.

Focus on HOW the interviewer is listening, not WHAT is being asked.

Write in a conversational interviewer voice.

Do NOT list skills, tools, categories, scores, or bullets.

Do NOT sound evaluative, instructional, or judgmental.

The intent should add meta-context (e.g. depth, trade-offs, habits, constraints, reasoning style), not duplicate content already in the question.

Example style (do not copy verbatim):
"What I'm paying attention to here is how you translate principles into consistent practices as systems and teams grow."

Return JSON:
{
  "isDontKnow": true/false,
  "scores": [{"category": "Name", "strength": 0-100}],
  "question": "Your naturally written next question",
  "evaluationIntent": "Single natural sentence describing listening focus"
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
                content: fastPrompt,
            },
        ];
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("→ OpenAI Request [evaluate-answer-fast]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Model:", evaluationModel);
        console.log("\nSystem:", messages[0].content);
        console.log("\nUser Prompt:", messages[1].content);

        const completion = await openai.chat.completions.create({
            model: evaluationModel,
            messages,
            response_format: { type: "json_object" },
            temperature: 0.3,
        });

        const responseText = completion.choices[0]?.message?.content;
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("← OpenAI Response [evaluate-answer-fast]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(JSON.stringify(JSON.parse(responseText || "{}"), null, 2));
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        
        if (!responseText) {
            throw new Error("OpenAI returned empty response");
        }

        const result = JSON.parse(responseText);

        // If this is an "I don't know" answer, increment dontKnowCount in-memory for the topic being evaluated
        let countsForTopicSelection = currentCounts;
        // Use newFocusTopic (the topic being evaluated) instead of currentFocusTopic (which may be null on first question)
        if (result.isDontKnow && newFocusTopic) {
            countsForTopicSelection = currentCounts.map((c: any) => {
                if (c.categoryName === newFocusTopic) {
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
            const newExcludedTopics = countsForTopicSelection
                .filter((c: any) => c.dontKnowCount >= threshold)
                .map((c: any) => c.categoryName);
            
            if (newExcludedTopics.length > 0) {
                // Re-filter active categories
                const newActiveCategories = experienceCategories.filter(
                    (cat: any) => !newExcludedTopics.includes(cat.name)
                );
                
                // Check if all categories now excluded
                if (newActiveCategories.length === 0) {
                    log.info(LOG_CATEGORY, "[evaluate-answer-fast] All categories excluded after increment");
                    return NextResponse.json({
                        success: true,
                        allCategoriesExcluded: true,
                        scores: [],
                        question: null,
                        isDontKnow: false,
                        updatedCounts: currentCounts,
                        newFocusTopic: null,
                    });
                }
                
                // Update activeCategories for topic selection below
                activeCategories = newActiveCategories;

                // Re-calculate newFocusTopic with updated exclusions
                const activeCategoryNames = activeCategories.map((cat: any) => cat.name);
                const countsForReselection = countsForTopicSelection.filter((c: any) =>
                    activeCategoryNames.includes(c.categoryName)
                );

                const activeForReselection = countsForReselection.filter((c: any) => c.count < TARGET);

                if (activeForReselection.length > 0) {
                    // MODE 1: Contribution collection
                    newFocusTopic = activeForReselection.sort((a: any, b: any) =>
                        b.count - a.count || b.avgStrength - a.avgStrength
                    )[0].categoryName;
                } else {
                    // MODE 2: Rebalance
                    newFocusTopic = countsForReselection.sort((a: any, b: any) =>
                        a.avgStrength - b.avgStrength
                    )[0].categoryName;
                }
            }
        }

        // Helper: Map contribution strength to normalized points
        const getNormalizedPoints = (strength: number): number => {
            if (strength === 0) return 0;
            if (strength <= 30) return 1;
            if (strength <= 60) return 3;
            if (strength <= 80) return 5;
            return 6; // 81-100
        };
        
        // Calculate updated counts in-memory
        const updatedCounts = experienceCategories.map((category: any) => {
            // Use countsForTopicSelection which has updated dontKnowCount if "I don't know" was detected
            const existing = countsForTopicSelection.find((c: any) => c.categoryName === category.name);
            const newScore = result.scores.find((s: any) => s.category === category.name);

            if (!newScore || newScore.strength === 0) {
                return existing || { categoryName: category.name, count: 0, avgStrength: 0, dontKnowCount: 0 };
            }
            
            const oldCount = existing?.count || 0;
            const oldAdjustedAvg = existing?.avgStrength || 0;
            const newCount = oldCount + 1;
            
            // Check if THIS category has reached full confidence
            const categoryHasFullConfidence = oldCount >= TARGET;
            
            // MODE 1: Averaging with confidence multiplier (before this category reaches full confidence)
            if (!categoryHasFullConfidence) {
                // Back-calculate raw average from adjusted (adjusted = raw * confidence)
                let oldRawAvg = 0;
                if (oldCount > 0 && oldAdjustedAvg > 0) {
                    const oldConfidence = Math.min(1.0, oldCount / TARGET);
                    oldRawAvg = oldConfidence > 0 ? oldAdjustedAvg / oldConfidence : oldAdjustedAvg;
                }
                
                // Calculate new raw average
                const newRawAvg = (oldRawAvg * oldCount + newScore.strength) / newCount;
                
                // Apply confidence multiplier based on sample size
                const confidence = Math.min(1.0, newCount / TARGET);
                const adjustedAvg = Math.round(newRawAvg * confidence);
                
                return {
                    categoryName: category.name,
                    count: newCount,
                    avgStrength: adjustedAvg,
                    rawAverage: Math.round(newRawAvg),
                    confidence: confidence,
                    dontKnowCount: existing?.dontKnowCount || 0,
                };
            }
            
            // MODE 2: Point accumulation (after THIS category reaches full confidence)
            // Cap at 100 - once reached, no more points added
            if (oldAdjustedAvg >= 100) {
                return {
                    categoryName: category.name,
                    count: newCount,
                    avgStrength: 100,
                    rawAverage: 100,
                    confidence: 1.0,
                    dontKnowCount: existing?.dontKnowCount || 0,
                };
            }

            const points = getNormalizedPoints(newScore.strength);
            const accumulatedScore = Math.min(100, oldAdjustedAvg + points);

            return {
                categoryName: category.name,
                count: newCount,
                avgStrength: accumulatedScore,
                rawAverage: accumulatedScore, // In accumulation mode, raw = adjusted
                confidence: 1.0,
                dontKnowCount: existing?.dontKnowCount || 0,
            };
        });

        log.info(LOG_CATEGORY, "[evaluate-answer-fast] Fast evaluation complete");

        return NextResponse.json({
            success: true,
            scores: result.scores,
            question: result.question,
            isDontKnow: result.isDontKnow || false,
            isClarificationRequest,
            isGibberish,
            updatedCounts,
            newFocusTopic,
            evaluationIntent: result.evaluationIntent || "",
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[evaluate-answer-fast] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
