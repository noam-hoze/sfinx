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

        // Fetch all coding session metrics
        const [iterations, debugLoops, externalToolUsages] = await Promise.all([
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
            prisma.debugLoop.findMany({
                where: { interviewSessionId: sessionId },
                select: {
                    errorCount: true,
                    resolved: true,
                },
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
            debugLoops: debugLoops.length,
            externalToolUsages: externalToolUsages.length,
        });

        // Calculate metrics summary
        const totalIterations = iterations.length;
        const correctIterations = iterations.filter((i) => i.evaluation === "CORRECT").length;
        const successRate = totalIterations > 0 ? (correctIterations / totalIterations) * 100 : 0;
        const firstCorrectIteration = iterations.findIndex((i) => i.evaluation === "CORRECT");
        const timeToSolution = firstCorrectIteration >= 0 ? firstCorrectIteration + 1 : null;

        const totalDebugLoops = debugLoops.length;
        const resolvedDebugLoops = debugLoops.filter((l) => l.resolved).length;
        const avgErrorsPerLoop = totalDebugLoops > 0
            ? debugLoops.reduce((sum, l) => sum + l.errorCount, 0) / totalDebugLoops
            : 0;

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
            debugLoops: {
                total: totalDebugLoops,
                resolved: resolvedDebugLoops,
                avgErrorsPerLoop: Math.round(avgErrorsPerLoop * 10) / 10,
            },
            externalToolUsage: {
                total: totalPastes,
                avgAccountabilityScore: Math.round(avgAccountabilityScore),
                poorUnderstanding,
            },
        };

        // OpenAI prompt for summary generation
        const systemPrompt = `You are a technical interviewer analyzing a candidate's coding session performance.

Based on the candidate's coding session data, provide a comprehensive summary with scores across three dimensions:
1. Code Quality (structure, best practices, readability)
2. Problem Solving (approach, iterations, debugging)
3. Independence (self-sufficiency vs external tool reliance)

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
  },
  "independence": {
    "score": 0-100,
    "text": "string (assessment of self-sufficiency vs external tool reliance)"
  }
}

Guidelines:
- Executive summary should be narrative and specific to this candidate's performance
- Scores should reflect observed behavior (0-100 scale)
- Text assessments should be detailed and reference specific patterns from the metrics
- Recommendation should be based on overall performance across all dimensions`;

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

        // Get telemetry data for this session
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: { telemetryData: true },
        });

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
                independenceScore: parsed.independence.score,
                independenceText: parsed.independence.text,
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

