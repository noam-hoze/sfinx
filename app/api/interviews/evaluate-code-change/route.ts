import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import fs from "fs";
import prisma from "lib/prisma";
import OpenAI from "openai";
import { createVideoChapter } from "../shared/createVideoChapter";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/interviews/evaluate-code-change
 * Evaluates code changes in real-time and creates evidence clips for job-specific categories
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, previousCode, currentCode, diff, timestamp, jobCategories, referenceCode, expectedOutput } = body;

        // #region agent log
        try { fs.appendFileSync('/Users/noonejoze/Projects/sfinx/.cursor/debug-08ebcb.log', JSON.stringify({sessionId:'08ebcb',location:'evaluate-code-change/route.ts:entry',message:'API called',data:{hasSessionId:!!sessionId,hasDiff:!!diff,diffLen:diff?.length,hasJobCategories:!!jobCategories,categoriesCount:jobCategories?.length,diffPreview:diff?.slice(0,120)},timestamp:Date.now(),hypothesisId:'H-API'})+'\n'); } catch(_){}
        // #endregion

        if (!sessionId || !diff || !timestamp || !jobCategories) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[evaluate-code-change] Evaluating code change for session:", sessionId);
        log.info(LOG_CATEGORY, "[evaluate-code-change] Has reference code:", !!referenceCode);

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

        // Add reference solution context if available (for Problem Solving evaluation)
        const referenceSolutionContext = referenceCode ? `
REFERENCE SOLUTION (for Problem Solving evaluation):
\`\`\`
${referenceCode}
\`\`\`

${expectedOutput ? `EXPECTED OUTPUT:\n${expectedOutput}\n` : ''}` : '';

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
${referenceSolutionContext}
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
${referenceCode ? `
**SPECIAL INSTRUCTIONS FOR "Problem Solving" CATEGORY:**
- Compare the FULL "CODE AFTER CHANGES" to the "REFERENCE SOLUTION"
- If they are IDENTICAL or implement the EXACT SAME logic/algorithm/structure, give 100/100
- If they differ in approach or implementation details, score proportionally: 80-95 for very close, 60-79 for similar approach, 40-59 for different approach but working, below 40 for incorrect approach
- DO NOT penalize for matching the reference - that's the goal!

**FOR OTHER CATEGORIES:**
- ONLY credit NEW code in the + lines of the diff
- Use "CODE BEFORE" and "CODE AFTER" to understand context
` : `- ONLY credit NEW code in the + lines of the diff
- Use "CODE BEFORE" and "CODE AFTER" to understand context`}

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

        log.info(LOG_CATEGORY, "[evaluate-code-change] Calling OpenAI for evaluation");

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
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

        // #region agent log
        try { fs.appendFileSync('/Users/noonejoze/Projects/sfinx/.cursor/debug-08ebcb.log', JSON.stringify({sessionId:'08ebcb',location:'evaluate-code-change/route.ts:afterOpenAI',message:'OpenAI result',data:{totalEvals:allEvaluations.length,positiveContributions:contributions.length,evaluations:allEvaluations.map((e:any)=>({category:e.category,strength:e.strength}))},timestamp:Date.now(),hypothesisId:'H-API'})+'\n'); } catch(_){}
        // #endregion

        log.info(LOG_CATEGORY, `[evaluate-code-change] Found ${contributions.length} contributions with strength > 0 out of ${allEvaluations.length} evaluations`);

        // Calculate video offset — clamp to 0 when contribution predates recording
        const changeTimestamp = new Date(timestamp);
        const recordingStart = session.recordingStartedAt;
        let videoOffset = 0;

        if (recordingStart) {
            videoOffset = Math.floor((changeTimestamp.getTime() - recordingStart.getTime()) / 1000);
        }

        // Create evidence clips and contribution records for each contribution with strength > 0
        for (const contribution of contributions) {
            log.info(LOG_CATEGORY, `[evaluate-code-change] Creating evidence for ${contribution.category} (strength: ${contribution.strength})`);

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

            log.info(LOG_CATEGORY, `[evaluate-code-change] ✅ Created evidence for ${contribution.category} at ${videoOffset}s`);
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
        log.error(LOG_CATEGORY, "[evaluate-code-change] Error evaluating code change:", error);
        return NextResponse.json(
            {
                error: "Failed to evaluate code change",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

