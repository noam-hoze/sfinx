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
 * POST /api/interviews/score-answer
 * Pure scoring endpoint (async, ~2-3s) with NO question generation.
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
            question,
            answer,
            experienceCategories,
            currentCounts,
            currentFocusTopic
        } = body;

        if (!sessionId || !question || answer === undefined || !experienceCategories || !currentCounts) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[score-answer] Scoring started");

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

        // Build category list with current counts
        const TARGET = CONTRIBUTIONS_TARGET;

        const categoryList = experienceCategories.map((cat: any) => {
            const stats = currentCounts.find((c: any) => c.categoryName === cat.name);
            return `${cat.name}: ${stats?.count || 0} contributions (avg ${stats?.avgStrength || 0}%)`;
        }).join(', ');

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // OPENAI PROMPT: SCORING ONLY (NO QUESTION GENERATION)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        const scoringPrompt = `Score this answer only (do not generate a question).

Last Question: ${question}
Last Answer: ${answer}

Current status: ${categoryList}

Step 1 - Detect uncertainty:
If the answer says "I don't know" or similar ("not sure", "no experience", "haven't worked with that"), set isDontKnow: true
Otherwise set isDontKnow: false

Step 2 - Score each category 0-100:
0=blank, 1-30=vague, 31-60=basic, 61-80=clear, 81-100=exceptional

Step 3 - Describe evaluation intent:
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
                content: scoringPrompt,
            },
        ];

        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("→ OpenAI Request [score-answer]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Model:", evaluationModel);
        console.log("\nSystem:", messages[0].content);
        console.log("\nUser Prompt:", messages[1].content);

        const startTime = Date.now();
        const completion = await openai.chat.completions.create({
            model: evaluationModel,
            messages,
            response_format: { type: "json_object" },
            temperature: 0.3, // Consistent scoring
        });
        const elapsed = Date.now() - startTime;

        const responseText = completion.choices[0]?.message?.content;
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("← OpenAI Response [score-answer]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Latency: ${elapsed}ms`);
        console.log(JSON.stringify(JSON.parse(responseText || "{}"), null, 2));
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        if (!responseText) {
            throw new Error("OpenAI returned empty response");
        }

        const result = JSON.parse(responseText);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CALCULATE UPDATED COUNTS IN-MEMORY
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
            const existing = currentCounts.find((c: any) => c.categoryName === category.name);
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

        log.info(LOG_CATEGORY, `[score-answer] Scoring complete in ${elapsed}ms`);

        return NextResponse.json({
            success: true,
            scores: result.scores,
            isDontKnow: result.isDontKnow || false,
            updatedCounts,
            evaluationIntent: result.evaluationIntent || "",
            latencyMs: elapsed, // For monitoring
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[score-answer] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
