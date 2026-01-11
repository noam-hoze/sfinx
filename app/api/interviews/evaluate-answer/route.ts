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
        const { sessionId, question, answer, timestamp, experienceCategories } = body;

        if (!sessionId || !question || answer === undefined || !timestamp || !experienceCategories) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        log.info("[evaluate-answer] Evaluating answer for session:", sessionId);

        // Fetch session with recording data and job
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                telemetryData: true,
                application: {
                    include: {
                        job: true,
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

        // Call OpenAI to evaluate contributions
        const evaluationPrompt = `You are a strict interview evaluator.

QUESTION: ${question}

ANSWER: ${answer}

Categories to evaluate:
${categoryList}

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

CRITICAL RULES:
- If strength > 0, you MUST provide a caption. Never return null caption with non-zero strength.
- Blank or gibberish answers MUST be scored 0 across all categories.
- Be strict with 0 scores - use them for noise, blank answers, and gibberish.`;

        log.info("[evaluate-answer] Calling OpenAI for evaluation");

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
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

        // Process evaluations - only create records for non-zero scores
        const contributions: Array<{
            category: string;
            strength: number;
            explanation: string;
            caption: string;
        }> = [];

        for (const item of evaluation.evaluations) {
            if (item.strength > 0) {
                // Create CategoryContribution
                const contribution = await prisma.categoryContribution.create({
                    data: {
                        interviewSessionId: sessionId,
                        categoryName: item.category,
                        timestamp: new Date(timestamp),
                        codeChange: "", // Not applicable for experience
                        explanation: item.reasoning,
                        contributionStrength: item.strength,
                        caption: item.caption || item.category,
                    },
                });

                log.info(`[evaluate-answer] Created contribution for ${item.category}:`, contribution.id);

                // Calculate video offset
                let videoOffset = 0;
                if (session.recordingStartedAt) {
                    const recordingStart = new Date(session.recordingStartedAt).getTime();
                    const answerTime = new Date(timestamp).getTime();
                    videoOffset = Math.max(0, Math.floor((answerTime - recordingStart) / 1000));
                }

                // Create EvidenceClip
                const evidenceClip = await prisma.evidenceClip.create({
                    data: {
                        telemetryData: {
                            connect: { id: session.telemetryData.id }
                        },
                        title: `${item.category}`,
                        description: item.caption,
                        duration: 30, // Default duration
                        startTime: videoOffset,
                        category: "EXPERIENCE_CATEGORY",
                        categoryName: item.category,
                        contributionStrength: item.strength,
                    },
                });

                log.info(`[evaluate-answer] Created evidence clip for ${item.category}:`, evidenceClip.id);

                // Create VideoChapter
                await createVideoChapter({
                    telemetryDataId: session.telemetryData.id,
                    title: item.category,
                    startTime: videoOffset,
                    description: item.reasoning,
                    caption: item.caption,
                });

                contributions.push({
                    category: item.category,
                    strength: item.strength,
                    explanation: item.reasoning,
                    caption: item.caption,
                });
            }
        }

        log.info(`[evaluate-answer] ✅ Evaluation complete. ${contributions.length} contributions with strength > 0.`);

        // Calculate updated category counts
        const updatedCounts = await prisma.categoryContribution.groupBy({
            by: ['categoryName'],
            where: { interviewSessionId: sessionId },
            _count: { id: true },
            _avg: { contributionStrength: true },
        });

        const categoryStats = updatedCounts.map(item => ({
            categoryName: item.categoryName,
            count: item._count.id,
            avgStrength: Math.round(item._avg.contributionStrength || 0),
        }));

        log.info(`[evaluate-answer] Updated category stats:`, categoryStats);

        return NextResponse.json({
            success: true,
            contributionsCount: contributions.length,
            contributions: contributions,
            allEvaluations: evaluation.evaluations,
            updatedCounts: categoryStats,
        });
    } catch (error) {
        log.error("[evaluate-answer] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

