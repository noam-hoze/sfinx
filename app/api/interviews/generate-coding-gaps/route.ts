import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
    try {
        const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            log.error("[Generate Coding Gaps] OpenAI API key not configured");
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

        log.info("[Generate Coding Gaps] Starting gap generation for session:", sessionId);

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

        log.info("[Generate Coding Gaps] Metrics gathered:", {
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

        // OpenAI prompt for gap generation
        const systemPrompt = `You are a technical interviewer analyzing a candidate's coding session performance.

Based on the candidate's coding session data, identify specific gaps (major and minor) in their skills.

Return a JSON response with this exact structure:
{
  "gaps": [
    {
      "title": "string",
      "description": "string",
      "severity": "major" | "minor"
    }
  ]
}

CRITICAL GUIDELINES:
- **ALWAYS examine the final code** - if it's empty, only comments, or non-functional, this is a MAJOR gap
- **No implementation = Major Gap**: If the candidate submitted no functional code, this MUST be identified as "Complete Lack of Implementation" or "No Working Code Delivered"
- Major gaps: Critical skill deficiencies (e.g., no code written, multiple failed attempts, heavy reliance on external tools with poor understanding, unable to debug effectively, no problem-solving attempts)
- Minor gaps: Areas for improvement (e.g., slower than average, could benefit from better planning, suboptimal code structure)
- Be specific and actionable
- Focus on patterns, not isolated incidents
- If candidate wrote NO functional code, there should be at least one major gap describing this
- If performance is strong across all metrics AND actual working code exists, return an empty gaps array`;

        const userPrompt = `Analyze this coding session:

**Task:**
${codingTask || "Not provided"}

**Expected Solution:**
${expectedSolution || "Not provided"}

**Final Code Submitted:**
${finalCode || "Not provided"}

**Performance Metrics:**
${JSON.stringify(metricsContext, null, 2)}

Identify gaps in the candidate's skills based on this data.`;

        log.info("[Generate Coding Gaps] Calling OpenAI...");

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

        log.info("[Generate Coding Gaps] OpenAI response received");

        const parsed = JSON.parse(responseText);
        const gaps = parsed.gaps || [];

        log.info("[Generate Coding Gaps] Parsed gaps:", gaps.length);

        // Get telemetry data for this session
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: { telemetryData: { include: { gapAnalysis: true } } },
        });

        if (!session?.telemetryData?.gapAnalysis) {
            log.error("[Generate Coding Gaps] No gap analysis found for session");
            return NextResponse.json(
                { error: "Gap analysis not found for session" },
                { status: 404 }
            );
        }

        // Delete existing gaps for this session
        await prisma.gap.deleteMany({
            where: { gapAnalysisId: session.telemetryData.gapAnalysis.id },
        });

        // Create new gaps
        for (const gap of gaps) {
            const severity = gap.severity.toUpperCase() as "MAJOR" | "MINOR";
            const color = severity === "MAJOR" ? "red" : "yellow";
            
            await prisma.gap.create({
                data: {
                    gapAnalysisId: session.telemetryData.gapAnalysis.id,
                    description: `${gap.title}: ${gap.description}`,
                    severity,
                    color,
                    evidenceLinks: [],
                },
            });
        }

        log.info("[Generate Coding Gaps] Gaps saved to database");

        return NextResponse.json({
            message: "Gaps generated successfully",
            gapsCount: gaps.length,
            gaps,
        });
    } catch (error: any) {
        log.error("[Generate Coding Gaps] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to generate gaps",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

