import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import prisma from "lib/prisma";
import OpenAI from "openai";
import { createVideoChapter } from "../shared/createVideoChapter";
import { CONTRIBUTIONS_TARGET } from "shared/constants/interview";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/interviews/evaluate-answer
 * Evaluates background interview answers and creates evidence clips for experience categories
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, question, answer, timestamp, experienceCategories, currentCounts } = body;

        if (!sessionId || !question || answer === undefined || !timestamp || !experienceCategories) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }
        
        if (!currentCounts) {
            throw new Error("currentCounts is required - must be passed from Redux store");
        }

        log.info(LOG_CATEGORY, "[evaluate-answer] Evaluating answer for session:", sessionId);

        // Fetch session with recording data and job
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                telemetryData: true,
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

        if (!session || !session.telemetryData) {
            return NextResponse.json(
                { error: "Session or telemetry data not found" },
                { status: 404 }
            );
        }

        // Get experience categories from job if not provided
        let categoriesToEvaluate = experienceCategories;
        if ((!experienceCategories || experienceCategories.length === 0) && session.application?.job) {
            categoriesToEvaluate = session.application.job.experienceCategories as any[] || [];
        }

        if (!categoriesToEvaluate || categoriesToEvaluate.length === 0) {
            log.info(LOG_CATEGORY, "[evaluate-answer] No experience categories defined for this job - skipping evaluation");
            return NextResponse.json({
                success: true,
                contributionsCount: 0,
                contributions: [],
                message: "No experience categories defined",
            });
        }

        // Build category descriptions for OpenAI with examples
        const categoryList = categoriesToEvaluate
            .map((cat: any) => `- ${cat.name}: ${cat.description}${cat.example ? `\n  Example: ${cat.example}` : ''}`)
            .join("\n");

        // Get company and role context
        const companyName = session.application?.job?.company?.name;
        const jobTitle = session.application?.job?.title;

        if (!companyName || !jobTitle) {
            throw new Error("Company name and job title are required for evaluation");
        }

        // Call OpenAI to evaluate contributions
        const evaluationPrompt = `You are a hiring manager at ${companyName} evaluating a candidate for the ${jobTitle} position.

QUESTION: ${question}

ANSWER: ${answer}

RELEVANCE GATE (MANDATORY):
First determine if the ANSWER directly addresses the QUESTION.
- If the answer does NOT explicitly attempt to answer the question → mark as IRRELEVANT.
- If IRRELEVANT → you MUST return a score of 0 for ALL categories and skip all further evaluation. Do NOT attempt to partially score.
- Irrelevant cases include: answering a previous question, generic experience, aspirational statements, or answering a different topic.
- Do not reward impressive but irrelevant content.

If Relevant → continue with full evaluation.

Definition of Directly Addressing the Question:
The answer must speak to the exact dimension asked (e.g. if asked about design patterns it must name or describe at least one design pattern).
High-level talk about the project, stack, scale, ownership, or company context does NOT count as addressing the question.

Do not assume continuity between questions. Answers must be independently relevant to the current question. Do not infer intent or fix misalignment.

Categories to evaluate:
${categoryList}

Be pedantic: evaluate answer-to-question match, NOT general answer impressiveness.

SCORING GUIDELINES (0-100):
- **0**: Blank answers, gibberish, off-topic, evasive, generic platitudes, or adds ZERO relevant information
  Examples: "", "aergaerg", "I have experience", "I worked on projects", "I'm familiar with that"
  CRITICAL: Blank or gibberish answers MUST ALWAYS be 0, no exceptions.
  
- **1-30**: Weak engagement. Vague or superficial, but shows SOME relevant attempt with real words
  Examples: "I used React hooks" (no details), "I optimized performance once" (no context)
  
- **31-60**: Demonstrates basic competence with limited depth or examples
  
- **61-80**: Clear demonstration with specific examples and depth
  
- **81-100**: Exceptional depth, shows mastery with concrete examples and tradeoffs

EVALUATION:
For EVERY category, return your evaluation in JSON format:
{
  "evaluations": [
    {
      "category": "Category Name",
      "reasoning": "Why this score (be specific about what's missing or strong)",
      "strength": 0-100,
      "caption": "Brief insight summarizing the evidence (REQUIRED when strength > 0, null when 0)"
    }
  ]
}

IF IRRELEVANT:
Return:

{
  "evaluations": [
    {
      "category": "<category>",
      "reasoning": "Answer did not address the question. Automatic zero per Relevance Gate.",
      "strength": 0,
      "caption": null
    },
    ...
  ]
}

After returning zeros DO NOT add explanations, summaries, or additional text.

CRITICAL RULES:
- If strength > 0, you MUST provide a caption. Never return null caption with non-zero strength.
- Blank or gibberish answers MUST be scored 0 across all categories.
- Be strict with 0 scores - use them for noise, blank answers, and gibberish.`;

        log.info(LOG_CATEGORY, "[evaluate-answer] Calling OpenAI for evaluation");

        const evaluationModel = process.env.NEXT_PUBLIC_OPENAI_EVALUATION_MODEL;
        if (!evaluationModel) {
            throw new Error("NEXT_PUBLIC_OPENAI_EVALUATION_MODEL environment variable is not set");
        }

        const messages = [
            {
                role: "system",
                content: `You are a technical interviewer at ${companyName} evaluating candidates for the ${jobTitle} position.`,
            },
            {
                role: "user",
                content: evaluationPrompt,
            },
        ];

        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("→ OpenAI Request [evaluate-answer FULL]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Model:", evaluationModel);
        console.log("\nSystem:", messages[0].content);
        console.log("\nUser Prompt:", evaluationPrompt.substring(0, 500) + "...");

        const completion = await openai.chat.completions.create({
            model: evaluationModel,
            messages,
            response_format: { type: "json_object" },
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
            throw new Error("OpenAI returned empty response");
        }

        const evaluation = JSON.parse(responseText);
        
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("← OpenAI Response [evaluate-answer FULL]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(JSON.stringify(evaluation, null, 2));
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        
        log.info(LOG_CATEGORY, "[evaluate-answer] OpenAI evaluation:", evaluation);

        // Helper: Map contribution strength to normalized points
        const getNormalizedPoints = (strength: number): number => {
            if (strength === 0) return 0;
            if (strength <= 30) return 1;
            if (strength <= 60) return 3;
            if (strength <= 80) return 5;
            return 6; // 81-100
        };
        
        // Calculate updated counts in-memory (no DB read needed)
        const updatedCounts = experienceCategories.map((category: any) => {
            const existing = currentCounts.find((c: any) => c.categoryName === category.name);
            const newEval = evaluation.evaluations.find((e: any) => e.category === category.name);
            
            if (!newEval || newEval.strength === 0) {
                // No new contribution for this category
                return existing || { categoryName: category.name, count: 0, avgStrength: 0 };
            }
            
            const oldCount = existing?.count || 0;
            const oldAdjustedAvg = existing?.avgStrength || 0;
            const newCount = oldCount + 1;
            
            // Check if THIS category has reached full confidence
            const categoryHasFullConfidence = oldCount >= CONTRIBUTIONS_TARGET;
            
            // MODE 1: Averaging with confidence multiplier (before this category reaches full confidence)
            if (!categoryHasFullConfidence) {
                // Back-calculate raw average from adjusted (adjusted = raw * confidence)
                let oldRawAvg = 0;
                if (oldCount > 0 && oldAdjustedAvg > 0) {
                    const oldConfidence = Math.min(1.0, oldCount / CONTRIBUTIONS_TARGET);
                    oldRawAvg = oldConfidence > 0 ? oldAdjustedAvg / oldConfidence : oldAdjustedAvg;
                }
                
                // Calculate new raw average
                const newRawAvg = (oldRawAvg * oldCount + newEval.strength) / newCount;
                
                // Apply confidence multiplier based on sample size
                const confidence = Math.min(1.0, newCount / CONTRIBUTIONS_TARGET);
                const adjustedAvg = Math.round(newRawAvg * confidence);
                
                return {
                    categoryName: category.name,
                    count: newCount,
                    avgStrength: adjustedAvg,
                    rawAverage: Math.round(newRawAvg),
                    confidence: confidence,
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
                };
            }
            
            const points = getNormalizedPoints(newEval.strength);
            const accumulatedScore = Math.min(100, oldAdjustedAvg + points);
            
            return {
                categoryName: category.name,
                count: newCount,
                avgStrength: accumulatedScore,
                rawAverage: accumulatedScore, // In accumulation mode, raw = adjusted
                confidence: 1.0,
            };
        });

        // Process evaluations - batch all DB operations in parallel
        const dbOperations = evaluation.evaluations
            .filter((item: any) => item.strength > 0)
            .map(async (item: any) => {
                // Calculate video offset once
                let videoOffset = 0;
                if (session.recordingStartedAt) {
                    const recordingStart = new Date(session.recordingStartedAt).getTime();
                    const answerTime = new Date(timestamp).getTime();
                    videoOffset = Math.max(0, Math.floor((answerTime - recordingStart) / 1000));
                }

                // Run CategoryContribution and VideoChapter creates in parallel
                // Note: EvidenceClips are created by background-summary (single source of truth)
                await Promise.all([
                    prisma.categoryContribution.create({
                        data: {
                            interviewSessionId: sessionId,
                            categoryName: item.category,
                            timestamp: new Date(timestamp),
                            codeChange: "",
                            explanation: item.reasoning,
                            contributionStrength: item.strength,
                            caption: item.caption || item.category,
                        },
                    }),
                    createVideoChapter({
                        telemetryDataId: session.telemetryData.id,
                        title: item.category,
                        startTime: videoOffset,
                        description: item.reasoning,
                        caption: item.caption,
                    }),
                ]);
            });

        // Fire-and-forget DB operations (async, non-blocking)
        Promise.all(dbOperations).then(() => {
            log.info(LOG_CATEGORY, `[evaluate-answer] ✅ Async DB save complete. ${evaluation.evaluations.filter((e: any) => e.strength > 0).length} contributions saved.`);
        }).catch(err => {
            log.error(LOG_CATEGORY, "[evaluate-answer] ❌ Async DB save failed:", err);
        });

        log.info(LOG_CATEGORY, `[evaluate-answer] Returning updated counts immediately (DB saves in background)`);

        // Return immediately with in-memory calculated counts
        return NextResponse.json({
            success: true,
            contributionsCount: evaluation.evaluations.filter((e: any) => e.strength > 0).length,
            allEvaluations: evaluation.evaluations,
            updatedCounts: updatedCounts,
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[evaluate-answer] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

