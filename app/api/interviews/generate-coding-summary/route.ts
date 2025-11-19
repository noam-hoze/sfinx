import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
    try {
        const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            log.error("[Generate Coding Summary] OpenAI API key not configured");
            return NextResponse.json(
                { error: "OpenAI API key not configured" },
                { status: 500 }
            );
        }
        
        const openaiClient = new OpenAI({ apiKey: openaiApiKey });
        
        const body = await request.json();
        const { sessionId, finalCode, codingTask, expectedSolution } = body;

        if (!sessionId) {
            return NextResponse.json(
                { error: "Session ID is required" },
                { status: 400 }
            );
        }

        log.info("[Generate Coding Summary] Starting summary generation for session:", sessionId);

        // Fetch session with application and job to get scoring configuration
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                telemetryData: true,
                application: {
                    include: {
                        job: {
                            include: {
                                scoringConfiguration: true,
                            },
                        },
                    },
                },
            },
        });

        if (!session) {
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 }
            );
        }

        // Get scoring configuration (with defaults if not configured)
        const scoringConfig = session.application?.job?.scoringConfiguration;
        const iterationThresholdModerate = scoringConfig?.iterationSpeedThresholdModerate ?? 5;
        const iterationThresholdHigh = scoringConfig?.iterationSpeedThresholdHigh ?? 10;

        // Fetch all coding session metrics
        const [iterations, externalToolUsages] = await Promise.all([
            prisma.iteration.findMany({
                where: { interviewSessionId: sessionId },
                select: {
                    timestamp: true,
                    evaluation: true,
                    matchPercentage: true,
                    reasoning: true,
                },
                orderBy: { timestamp: "asc" },
            }),
            prisma.externalToolUsage.findMany({
                where: { interviewSessionId: sessionId },
                select: {
                    understanding: true,
                    accountabilityScore: true,
                    pastedContent: true,
                },
            }),
        ]);

        log.info("[Generate Coding Summary] Metrics gathered:", {
            iterations: iterations.length,
            externalToolUsages: externalToolUsages.length,
        });

        // Calculate metrics summary
        const totalIterations = iterations.length;
        const correctIterations = iterations.filter((i) => i.evaluation === "CORRECT").length;
        const successRate = totalIterations > 0 ? (correctIterations / totalIterations) * 100 : 0;
        const firstCorrectIteration = iterations.findIndex((i) => i.evaluation === "CORRECT");
        const timeToSolution = firstCorrectIteration >= 0 ? firstCorrectIteration + 1 : null;

        const totalPastes = externalToolUsages.length;
        const avgAccountabilityScore = totalPastes > 0
            ? externalToolUsages.reduce((sum, e) => sum + e.accountabilityScore, 0) / totalPastes
            : 0;
        const poorUnderstanding = externalToolUsages.filter((e) => e.understanding === "NONE").length;

        // Build comprehensive context for OpenAI
        const metricsContext = {
            iterations: {
                total: totalIterations,
                correct: correctIterations,
                successRate: Math.round(successRate),
                timeToSolution,
                attempts: iterations.map((i) => ({
                    evaluation: i.evaluation,
                    matchPercentage: i.matchPercentage,
                    reasoning: i.reasoning,
                })),
            },
            externalToolUsage: {
                total: totalPastes,
                avgAccountabilityScore: Math.round(avgAccountabilityScore),
                poorUnderstanding,
            },
        };

        // OpenAI prompt for summary generation
        const systemPrompt = `You are a technical interviewer analyzing a candidate's coding session performance.

Based on the candidate's coding session data, provide a comprehensive summary with scores across two dimensions:
1. Code Quality (structure, best practices, readability)
2. Problem Solving (approach, iterations, debugging)

Return a JSON response with this exact structure:
{
  "executiveSummary": "string (2-3 paragraph narrative summary of overall coding performance)",
  "recommendation": "HIRE" | "NO HIRE" | "STRONG HIRE",
  "codeQuality": {
    "score": 0-100,
    "text": "string (detailed assessment of code quality, structure, and best practices)"
  },
  "problemSolving": {
    "score": 0-100,
    "text": "string (analysis of problem-solving approach, iterations, and debugging)"
  }
}

CRITICAL SCORING GUIDELINES:
- **ALWAYS examine the final code carefully** - if it contains ONLY comments, boilerplate, or no functional implementation, scores MUST be 0 or very low
- **Code Quality score = 0** if there is no actual working code, only comments/structure/placeholders
- **Problem Solving score = 0** if there were no iterations, no attempts to solve the problem, or no functional code produced
- If total iterations = 0 AND final code is empty/non-functional, ALL scores should be 0-10 maximum
- A candidate who writes nothing should NOT receive scores above 10 in any category
- "Not doing anything" is NOT the same as "doing something well"
- Be harsh but fair - empty submissions deserve empty scores
- Recommendation should be "NO HIRE" if no meaningful code was produced
- Executive summary should explicitly state when no functional implementation was delivered

PROBLEM SOLVING SCORING - ITERATION EFFICIENCY:
Evaluate based on iteration efficiency and solution quality using these benchmarks:
- 1 iteration to CORRECT = 100 (perfect first-try solution)
- 2-${iterationThresholdModerate} iterations to CORRECT = 75-99 (strong performance, minor adjustments needed)
- ${iterationThresholdModerate + 1}-${iterationThresholdHigh} iterations to CORRECT = 50-74 (acceptable, required moderate debugging)
- >${iterationThresholdHigh} iterations to CORRECT = 0-49 (poor efficiency, excessive trial and error)
- No CORRECT solution achieved: Score based on best attempt and progression quality (PARTIAL better than INCORRECT)
- Consider progression: INCORRECT → PARTIAL → CORRECT shows learning and adaptation
- Factor in matchPercentage trends across iterations to assess improvement trajectory
- No iterations at all = 0 score (no attempt to solve)

Iteration Benchmarks for this role:
- Moderate threshold: ${iterationThresholdModerate} iterations
- High threshold: ${iterationThresholdHigh} iterations`;

        const userPrompt = `Analyze this coding session:

**Task:**
${codingTask || "Not provided"}

**Expected Solution:**
${expectedSolution || "Not provided"}

**Final Code Submitted:**
${finalCode || "Not provided"}

**Performance Metrics:**
${JSON.stringify(metricsContext, null, 2)}

Provide a comprehensive summary and scores for this candidate's coding performance.`;

        log.info("[Generate Coding Summary] Calling OpenAI...");

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
            throw new Error("No response from OpenAI");
        }

        log.info("[Generate Coding Summary] OpenAI response received");

        const parsed = JSON.parse(responseText);

        log.info("[Generate Coding Summary] Parsed summary");

        if (!session?.telemetryData) {
            log.error("[Generate Coding Summary] No telemetry data found for session");
            return NextResponse.json(
                { error: "Telemetry data not found for session" },
                { status: 404 }
            );
        }

        // Delete existing coding summary if it exists
        const existingSummary = await prisma.codingSummary.findUnique({
            where: { telemetryDataId: session.telemetryData.id },
        });

        if (existingSummary) {
            await prisma.codingSummary.delete({
                where: { id: existingSummary.id },
            });
        }

        // Create new coding summary
        await prisma.codingSummary.create({
            data: {
                telemetryDataId: session.telemetryData.id,
                executiveSummary: parsed.executiveSummary,
                recommendation: parsed.recommendation || null,
                codeQualityScore: parsed.codeQuality.score,
                codeQualityText: parsed.codeQuality.text,
                problemSolvingScore: parsed.problemSolving.score,
                problemSolvingText: parsed.problemSolving.text,
                independenceScore: 0,
                independenceText: "Independence metric removed from evaluation",
            },
        });

        log.info("[Generate Coding Summary] Summary saved to database");

        return NextResponse.json({
            message: "Coding summary generated successfully",
            summary: parsed,
        });
    } catch (error: any) {
        log.error("[Generate Coding Summary] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to generate coding summary",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

