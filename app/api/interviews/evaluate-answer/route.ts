import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import OpenAI from "openai";
import { createVideoChapter } from "../shared/createVideoChapter";

const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
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

        log.info("[evaluate-answer] Evaluating answer for session:", sessionId);

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
            log.info("[evaluate-answer] No experience categories defined for this job - skipping evaluation");
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

        log.info("[evaluate-answer] Calling OpenAI for evaluation");

        const evaluationModel = process.env.NEXT_PUBLIC_OPENAI_EVALUATION_MODEL;
        if (!evaluationModel) {
            throw new Error("NEXT_PUBLIC_OPENAI_EVALUATION_MODEL environment variable is not set");
        }

        const completion = await openai.chat.completions.create({
            model: evaluationModel,
            messages: [
                {
                    role: "system",
                    content: "You are an expert recruiter evaluating candidate responses during technical interviews.",
                },
                {
                    role: "user",
                    content: evaluationPrompt,
                },
            ],
            response_format: { type: "json_object" },
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
            throw new Error("OpenAI returned empty response");
        }

        const evaluation = JSON.parse(responseText);
        log.info("[evaluate-answer] OpenAI evaluation:", evaluation);

        // Calculate updated counts in-memory (no DB read needed)
        const updatedCounts = experienceCategories.map((category: any) => {
            const existing = currentCounts.find((c: any) => c.categoryName === category.name);
            const newEval = evaluation.evaluations.find((e: any) => e.category === category.name);
            
            if (!newEval || newEval.strength === 0) {
                // No new contribution for this category
                return existing || { categoryName: category.name, count: 0, avgStrength: 0 };
            }
            
            // Calculate new average with new contribution
            const oldCount = existing?.count || 0;
            const oldAvg = existing?.avgStrength || 0;
            const newCount = oldCount + 1;
            const newAvg = Math.round((oldAvg * oldCount + newEval.strength) / newCount);
            
            return {
                categoryName: category.name,
                count: newCount,
                avgStrength: newAvg,
            };
        });

        // Process evaluations - batch all DB operations in parallel
        const contributions: Array<{
            category: string;
            strength: number;
            explanation: string;
            caption: string;
        }> = [];

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

                // Run all 3 creates in parallel for this item
                const [contribution, evidenceClip] = await Promise.all([
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
                    prisma.evidenceClip.create({
                        data: {
                            telemetryData: { connect: { id: session.telemetryData.id } },
                            title: `${item.category}`,
                            description: item.caption,
                            duration: 30,
                            startTime: videoOffset,
                            category: "EXPERIENCE_CATEGORY",
                            categoryName: item.category,
                            contributionStrength: item.strength,
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

                return {
                    category: item.category,
                    strength: item.strength,
                    explanation: item.reasoning,
                    caption: item.caption,
                };
            });

        // Fire-and-forget DB operations (async, non-blocking)
        Promise.all(dbOperations).then(results => {
            log.info(`[evaluate-answer] ✅ Async DB save complete. ${results.length} contributions saved.`);
        }).catch(err => {
            log.error("[evaluate-answer] ❌ Async DB save failed:", err);
        });

        log.info(`[evaluate-answer] Returning updated counts immediately (DB saves in background)`);

        // Return immediately with in-memory calculated counts
        return NextResponse.json({
            success: true,
            contributionsCount: evaluation.evaluations.filter((e: any) => e.strength > 0).length,
            allEvaluations: evaluation.evaluations,
            updatedCounts: updatedCounts,
        });
    } catch (error) {
        log.error("[evaluate-answer] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

