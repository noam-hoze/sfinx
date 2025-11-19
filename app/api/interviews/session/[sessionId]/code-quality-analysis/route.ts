import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import OpenAI from "openai";

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { sessionId } = await context.params;
        
        log.info("[Code Quality Analysis GET] Fetching analysis for session:", sessionId);

        // Fetch session with coding summary
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                telemetryData: {
                    include: {
                        codingSummary: true,
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

        const codingSummary = session.telemetryData?.codingSummary;
        if (!codingSummary) {
            return NextResponse.json(
                { error: "No coding summary found for this session" },
                { status: 404 }
            );
        }

        if (!codingSummary.codeQualityAnalysis) {
            return NextResponse.json(
                { error: "Code quality analysis not yet generated" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            analysis: codingSummary.codeQualityAnalysis,
            finalCode: codingSummary.finalCode,
        });
    } catch (error: any) {
        log.error("[Code Quality Analysis GET] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch code quality analysis",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            log.error("[Code Quality Analysis] OpenAI API key not configured");
            return NextResponse.json(
                { error: "OpenAI API key not configured" },
                { status: 500 }
            );
        }
        
        const openaiClient = new OpenAI({ apiKey: openaiApiKey });
        
        const { sessionId } = await context.params;
        
        log.info("[Code Quality Analysis] Starting analysis for session:", sessionId);

        // Fetch session with coding summary
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                telemetryData: {
                    include: {
                        codingSummary: true,
                    },
                },
                application: {
                    include: {
                        job: {
                            include: {
                                interviewContent: true,
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

        const codingSummary = session.telemetryData?.codingSummary;
        if (!codingSummary || !codingSummary.finalCode) {
            return NextResponse.json(
                { error: "No final code available for analysis" },
                { status: 404 }
            );
        }

        const finalCode = codingSummary.finalCode;
        const codingPrompt = session.application?.job?.interviewContent?.codingPrompt || "";
        const codingAnswer = session.application?.job?.interviewContent?.codingAnswer || "";

        // OpenAI prompt for structured code quality analysis
        const systemPrompt = `You are a senior software engineer performing a detailed code quality review.

Analyze the provided code and return a structured JSON report with the following format:

{
  "positives": [
    {
      "category": "string (e.g., 'Clean Code', 'Best Practices', 'Performance', 'Security')",
      "description": "string (what was done well)",
      "codeSegment": "string (exact code snippet from submission)",
      "lineStart": number (starting line number, 1-indexed),
      "lineEnd": number (ending line number, 1-indexed)
    }
  ],
  "improvements": [
    {
      "category": "string (e.g., 'Error Handling', 'Code Structure', 'Naming', 'Edge Cases')",
      "severity": "minor" | "moderate" | "major",
      "description": "string (what could be improved)",
      "suggestion": "string (how to improve it)",
      "codeSegment": "string (exact code snippet that needs improvement)",
      "lineStart": number (starting line number, 1-indexed),
      "lineEnd": number (ending line number, 1-indexed)
    }
  ],
  "summary": "string (1-2 sentence overall assessment)"
}

IMPORTANT:
- Provide 3-5 positives and 3-5 improvements
- Be specific with line numbers - count from line 1
- Code segments must be EXACT matches from the submitted code
- Focus on practical, actionable feedback
- Consider: readability, maintainability, best practices, error handling, edge cases, performance`;

        const userPrompt = `Review this code submission:

**Coding Challenge:**
${codingPrompt}

**Reference Solution:**
${codingAnswer}

**Candidate's Submitted Code:**
${finalCode}

Provide a detailed code quality analysis with specific line numbers and code segments.`;

        log.info("[Code Quality Analysis] Calling OpenAI...");

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

        log.info("[Code Quality Analysis] OpenAI response received");

        const analysis = JSON.parse(responseText);

        log.info("[Code Quality Analysis] Parsed analysis, saving to database...");

        // Update the coding summary with the analysis
        await prisma.codingSummary.update({
            where: { telemetryDataId: session.telemetryData.id },
            data: {
                codeQualityAnalysis: analysis,
            },
        });

        log.info("[Code Quality Analysis] Analysis saved to database");

        return NextResponse.json({
            message: "Code quality analysis generated and saved successfully",
            analysis,
        });
    } catch (error: any) {
        log.error("[Code Quality Analysis] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to generate code quality analysis",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

