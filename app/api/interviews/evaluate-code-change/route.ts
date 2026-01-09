import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import OpenAI from "openai";
import { createVideoChapter } from "../shared/createVideoChapter";

const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

/**
 * POST /api/interviews/evaluate-code-change
 * Evaluates code changes in real-time and creates evidence clips for job-specific categories
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, previousCode, currentCode, diff, timestamp, jobCategories } = body;

        if (!sessionId || !diff || !timestamp || !jobCategories) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        log.info("[evaluate-code-change] Evaluating code change for session:", sessionId);

        // Fetch session with recording data
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                telemetryData: true,
            },
        });

        if (!session || !session.telemetryData) {
            return NextResponse.json(
                { error: "Session or telemetry data not found" },
                { status: 404 }
            );
        }

        // Build category descriptions for OpenAI
        const categoryList = jobCategories
            .map((cat: any) => `- ${cat.name}: ${cat.description}`)
            .join("\n");

        // Call OpenAI to evaluate contributions
        const evaluationPrompt = `You are a strict technical evaluator. 

CODE BEFORE CHANGES:
\`\`\`
${previousCode || ''}
\`\`\`

CHANGES MADE (diff):
\`\`\`diff
${diff}
\`\`\`

CODE AFTER CHANGES (= before + diff applied):
\`\`\`
${currentCode || ''}
\`\`\`

Categories to evaluate:
${categoryList}

SCORING GUIDELINES (0-100):
- **0**: Gibberish, syntax errors, completely off-topic, or adds NO meaningful code
  Examples: random characters, incomplete syntax, trivial whitespace changes
  
- **1-30**: Weak code. Compiles but minimal value or very basic changes
  Examples: single console.log, renaming a variable, copy-paste without understanding
  
- **31-60**: Demonstrates basic competence. Code works but limited sophistication
  
- **61-80**: Clear demonstration of skill with meaningful implementation
  
- **81-100**: Exceptional code showing deep understanding, best practices, or complex solutions

EVALUATION:
- ONLY credit NEW code in the + lines of the diff
- Use "CODE BEFORE" and "CODE AFTER" to understand context

For EVERY category, return:
{
  "evaluations": [
    {
      "category": "Category Name",
      "reasoning": "Why this score - be specific about what's strong or missing",
      "strength": 0-100,
      "caption": "Brief description if strength > 0, otherwise null"
    }
  ]
}

Be strict with 0 scores - use them for noise. But use the full range 1-100 for legitimate code.`;

        log.info("[evaluate-code-change] Calling OpenAI for evaluation");

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are an expert code reviewer evaluating incremental coding progress during technical interviews. Respond in JSON format.",
                },
                {
                    role: "user",
                    content: evaluationPrompt,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
        });

        const responseContent = completion.choices[0]?.message?.content;
        if (!responseContent) {
            throw new Error("OpenAI returned empty response");
        }

        const evaluationResult = JSON.parse(responseContent);
        const allEvaluations = evaluationResult.evaluations || [];
        const contributions = allEvaluations.filter((e: any) => e.strength > 0);

        log.info(`[evaluate-code-change] Found ${contributions.length} contributions with strength > 0 out of ${allEvaluations.length} evaluations`);

        // Calculate video offset
        const changeTimestamp = new Date(timestamp);
        const recordingStart = session.recordingStartedAt;
        let videoOffset = 0;

        if (recordingStart) {
            videoOffset = Math.floor((changeTimestamp.getTime() - recordingStart.getTime()) / 1000);
        }

        // Create evidence clips and contribution records for each contribution with strength > 0
        for (const contribution of contributions) {
            log.info(`[evaluate-code-change] Creating evidence for ${contribution.category} (strength: ${contribution.strength})`);

            // 1. Create CategoryContribution record
            await prisma.categoryContribution.create({
                data: {
                    interviewSessionId: sessionId,
                    categoryName: contribution.category,
                    timestamp: changeTimestamp,
                    codeChange: diff,
                    explanation: contribution.reasoning,
                    contributionStrength: contribution.strength,
                    caption: contribution.caption,
                },
            });

            // 2. Create EvidenceClip for video playback
            await prisma.evidenceClip.create({
                data: {
                    telemetryData: {
                        connect: { id: session.telemetryData.id }
                    },
                    category: "JOB_SPECIFIC_CATEGORY",
                    categoryName: contribution.category,
                    title: contribution.category,
                    description: contribution.reasoning,
                    startTime: videoOffset,
                    duration: 15,
                    contributionStrength: contribution.strength,
                    thumbnailUrl: null,
                },
            });

            // 3. Create VideoChapter + VideoCaption (only if recording exists)
            if (recordingStart) {
                await createVideoChapter({
                    telemetryDataId: session.telemetryData.id,
                    title: `${contribution.category} (+${contribution.strength})`,
                    startTime: videoOffset,
                    description: contribution.reasoning,
                    caption: contribution.caption,
                });
            }

            log.info(`[evaluate-code-change] ✅ Created evidence for ${contribution.category} at ${videoOffset}s`);
        }

        return NextResponse.json({
            message: "Code change evaluated successfully",
            contributionsCount: contributions.length,
            allEvaluations: allEvaluations,
            contributions: contributions.map((c: any) => ({
                category: c.category,
                strength: c.strength,
                explanation: c.reasoning,
            })),
        });
    } catch (error: any) {
        log.error("[evaluate-code-change] Error evaluating code change:", error);
        return NextResponse.json(
            {
                error: "Failed to evaluate code change",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

