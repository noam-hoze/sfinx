import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import prisma from "lib/prisma";
import OpenAI from "openai";
import { requireBackgroundContributionsTarget } from "shared/constants/interview";
import {
    buildClassificationPrompt,
    isGibberishAnswer,
    isLikelyDontKnow,
    type AnswerType
} from "shared/services/backgroundInterview/answerClassification";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
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
                                scoringConfiguration: true,
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
        const TARGET = requireBackgroundContributionsTarget(
            session.application.job.scoringConfiguration,
            `interview session ${sessionId}`
        );
        
        const categoryList = activeCategories.map((cat: any) => {
            const stats = currentCounts.find((c: any) => c.categoryName === cat.name);
            return `${cat.name}: ${stats?.count || 0} contributions (avg ${stats?.avgStrength || 0}%)`;
        }).join(', ');

        // GIBBERISH DETECTION: Check if answer is nonsensical or meaningless
        const isGibberish = isGibberishAnswer(answer);

        // Note: Clarification and "I don't know" detection moved to OpenAI classification
        // (more accurate, handles creative phrasings like "huh?", "sorry?", etc.)

        // DETERMINISTIC ROUTING: Pick next topic based on current counts
        let activeCategoryNames = activeCategories.map((cat: any) => cat.name);
        let countsForSelection = currentCounts.filter((c: any) => activeCategoryNames.includes(c.categoryName));

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

        // Build classification prompt (shared with next-question endpoint)
        const classificationPrompt = buildClassificationPrompt({
            lastQuestion: question,
            lastAnswer: answer,
            categoryList,
            newFocusTopic,
            clarificationRetryCount: retryCount,
            clarificationThreshold: CLARIFICATION_THRESHOLD,
            isGibberish,
        });

        // Extend classification prompt with scoring and evaluation intent
        const fastPrompt = `${classificationPrompt}

ADDITIONAL SCORING TASK:
After classifying the answer and generating the question, also provide scores.

Step 1 - Score each category 0-100:
0=blank, 1-30=vague, 31-60=basic, 61-80=clear, 81-100=exceptional

Step 2 - Describe evaluation intent:
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
  "detectedAnswerType": "clarification_request" | "dont_know" | "substantive",
  "question": "Your naturally written next question",
  "scores": [{"category": "Name", "strength": 0-100}],
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

        // Validate response structure
        if (!result.detectedAnswerType || !result.question || !result.scores) {
            throw new Error("OpenAI response missing required fields");
        }

        const isClarificationRequest = result.detectedAnswerType === 'clarification_request';

        // Helper: Map contribution strength to normalized points
        const getNormalizedPoints = (strength: number): number => {
            if (strength === 0) return 0;
            if (strength <= 30) return 1;
            if (strength <= 60) return 3;
            if (strength <= 80) return 5;
            return 6; // 81-100
        };
        
        // Calculate updated counts in-memory
        const updatedCountsFromScores = experienceCategories.map((category: any) => {
            // Use countsForSelection which has updated dontKnowCount if "I don't know" was detected
            const existing = currentCounts.find((c: any) => c.categoryName === category.name); // Use currentCounts as base
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

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // "I DON'T KNOW" DETECTION & HANDLING
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const isDontKnow = result.detectedAnswerType === "dont_know" || isLikelyDontKnow(answer);
        
        let finalCounts = updatedCountsFromScores;
        
        // If "I don't know" detected, increment dontKnowCount for current focus topic
        if (isDontKnow && currentFocusTopic) {
            finalCounts = updatedCountsFromScores.map((c: any) => {
                if (c.categoryName === currentFocusTopic) {
                    return { ...c, dontKnowCount: (c.dontKnowCount || 0) + 1 };
                }
                return c;
            });
            log.info(LOG_CATEGORY, `[evaluate-answer-fast] Server-side increment for "${currentFocusTopic}"`);
        }

        log.info(LOG_CATEGORY, `[evaluate-answer-fast] Classification: ${result.detectedAnswerType}, Fast evaluation complete`);

        return NextResponse.json({
            success: true,
            question: result.question,
            isGibberish: isGibberish,
            isClarificationRequest: isClarificationRequest,
            isDontKnow: isDontKnow,
            scores: result.scores,
            evaluationIntent: result.evaluationIntent || "",
            updatedCounts: finalCounts,
            newFocusTopic,
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[evaluate-answer-fast] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
