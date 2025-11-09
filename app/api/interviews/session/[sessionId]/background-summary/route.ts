import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import OpenAI from "openai";
import {
    buildBackgroundSummaryPrompt,
    SUMMARY_MODEL,
    SUMMARY_TEMPERATURE,
    type SummaryOutput,
} from "@/shared/prompts/backgroundSummaryPrompt";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

type RouteContext = {
    params: Promise<{ sessionId?: string | string[] }>;
};

function normalizeSessionId(sessionId: string | string[] | undefined) {
    if (Array.isArray(sessionId)) {
        return sessionId[0] ?? "";
    }
    return sessionId ?? "";
}

// GET: Retrieve existing background summary
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        log.info("Background summary retrieval API called");

        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);

        if (!sessionId) {
            log.warn("❌ Interview session id was not provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        // Verify the interview session exists
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
            },
            include: {
                telemetryData: {
                    include: {
                        backgroundSummary: true,
                    },
                },
            },
        });

        if (!interviewSession) {
            log.warn("❌ Interview session not found");
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        const summary = interviewSession.telemetryData?.backgroundSummary;

        if (!summary) {
            log.info("No background summary found for session");
            return NextResponse.json(
                { error: "Background summary not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            summary: {
                id: summary.id,
                executiveSummary: summary.executiveSummary,
                recommendation: summary.recommendation,
                adaptability: {
                    score: summary.adaptabilityScore,
                    text: summary.adaptabilityText,
                },
                creativity: {
                    score: summary.creativityScore,
                    text: summary.creativityText,
                },
                reasoning: {
                    score: summary.reasoningScore,
                    text: summary.reasoningText,
                },
                conversationJson: summary.conversationJson,
                evidenceJson: summary.evidenceJson,
                generatedAt: summary.generatedAt,
            },
        });
    } catch (error) {
        log.error("❌ Error retrieving background summary:", error);
        return NextResponse.json(
            { error: "Failed to retrieve background summary" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}

// POST: Generate background summary
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        log.info("[background-summary/POST] ========== START ==========");

        const session = await getServerSession(authOptions);
        log.info("[background-summary/POST] Session:", session ? `Found (user: ${(session.user as any)?.email})` : "Not found");
        if (!session?.user) {
            log.warn("[background-summary/POST] ❌ Unauthorized request");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any).id;
        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);
        log.info("[background-summary/POST] userId:", userId);
        log.info("[background-summary/POST] sessionId (raw):", rawSessionId);
        log.info("[background-summary/POST] sessionId (normalized):", sessionId);

        if (!sessionId) {
            log.warn("[background-summary/POST] ❌ Interview session id was not provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        // Verify the interview session exists and belongs to the user
        log.info("[background-summary/POST] Looking up interview session...");
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                candidateId: userId,
            },
            include: {
                telemetryData: {
                    include: {
                        backgroundSummary: true,
                    },
                },
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

        if (!interviewSession) {
            log.warn("[background-summary/POST] ❌ Interview session not found or doesn't belong to user");
            log.warn("[background-summary/POST] Searched for: sessionId=", sessionId, "candidateId=", userId);
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        log.info("[background-summary/POST] ✅ Interview session found:", interviewSession.id);
        log.info("[background-summary/POST] Has telemetryData:", !!interviewSession.telemetryData);
        log.info("[background-summary/POST] Has backgroundSummary:", !!interviewSession.telemetryData?.backgroundSummary);

        // Check if summary already exists
        if (interviewSession.telemetryData?.backgroundSummary) {
            log.info("[background-summary/POST] ⚠️ Background summary already exists for session, skipping generation");
            return NextResponse.json(
                { message: "Background summary already exists" },
                { status: 200 }
            );
        }

        // Ensure telemetry data exists
        if (!interviewSession.telemetryData) {
            log.warn("[background-summary/POST] ❌ No telemetry data found for session");
            return NextResponse.json(
                { error: "Telemetry data not found" },
                { status: 404 }
            );
        }

        log.info("[background-summary/POST] TelemetryData ID:", interviewSession.telemetryData.id);

        const body = await request.json();
        const { scores, rationales, companyName, roleName } = body;
        log.info("[background-summary/POST] Request body:", { scores, rationales, companyName, roleName });

        if (!scores || typeof scores.adaptability !== "number") {
            log.warn("[background-summary/POST] ❌ Invalid scores provided:", scores);
            return NextResponse.json(
                { error: "Valid trait scores are required" },
                { status: 400 }
            );
        }

        // Fetch background messages
        log.info("[background-summary/POST] Fetching conversation messages...");
        const messages = await prisma.conversationMessage.findMany({
            where: {
                interviewSessionId: sessionId,
                stage: "background",
            },
            orderBy: {
                timestamp: "asc",
            },
        });

        log.info("[background-summary/POST] Found", messages.length, "background messages");

        if (messages.length === 0) {
            log.warn("[background-summary/POST] ❌ No background messages found in DB");
            return NextResponse.json(
                { error: "No background conversation found" },
                { status: 400 }
            );
        }

        log.info(`[background-summary/POST] Generating summary from ${messages.length} messages...`);

        // Build prompt
        const prompt = buildBackgroundSummaryPrompt({
            messages: messages.map((m) => ({
                speaker: m.speaker,
                text: m.text,
                timestamp: m.timestamp.getTime(),
            })),
            scores: {
                adaptability: scores.adaptability,
                creativity: scores.creativity,
                reasoning: scores.reasoning,
            },
            rationales,
            companyName:
                companyName || interviewSession.application.job.company.name,
            roleName: roleName || interviewSession.application.job.title,
        });

        // Call OpenAI
        log.info("[background-summary/POST] Checking OpenAI API key...");
        const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            log.error("[background-summary/POST] ❌ OpenAI API key not configured");
            return NextResponse.json(
                { error: "OpenAI API key not configured" },
                { status: 500 }
            );
        }

        log.info("[background-summary/POST] Calling OpenAI with model:", SUMMARY_MODEL, "temperature:", SUMMARY_TEMPERATURE);
        const openai = new OpenAI({ apiKey: openaiApiKey });

        const completion = await openai.chat.completions.create({
            model: SUMMARY_MODEL,
            temperature: SUMMARY_TEMPERATURE,
            messages: [
                {
                    role: "system",
                    content: prompt,
                },
            ],
        });

        const responseText = completion.choices[0]?.message?.content;
        log.info("[background-summary/POST] OpenAI response length:", responseText?.length || 0);
        
        if (!responseText) {
            log.error("[background-summary/POST] ❌ Empty response from OpenAI");
            return NextResponse.json(
                { error: "Failed to generate summary" },
                { status: 500 }
            );
        }

        log.info("[background-summary/POST] Parsing OpenAI response...");

        // Strip markdown code block wrapper if present
        let cleanedResponse = responseText.trim();
        if (cleanedResponse.startsWith("```json")) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (cleanedResponse.startsWith("```")) {
            cleanedResponse = cleanedResponse.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }

        // Parse response
        let summaryData: SummaryOutput;
        try {
            summaryData = JSON.parse(cleanedResponse);
            log.info("[background-summary/POST] ✅ Successfully parsed summary JSON");
        } catch (parseError) {
            log.error("[background-summary/POST] ❌ Failed to parse OpenAI response:", parseError);
            log.error("[background-summary/POST] Original response:", responseText.substring(0, 500));
            log.error("[background-summary/POST] Cleaned response:", cleanedResponse.substring(0, 500));
            return NextResponse.json(
                { error: "Failed to parse summary response" },
                { status: 500 }
            );
        }

        // Store in database
        log.info("[background-summary/POST] Saving summary to database...");
        const backgroundSummary = await prisma.backgroundSummary.create({
            data: {
                telemetryDataId: interviewSession.telemetryData.id,
                executiveSummary: summaryData.executiveSummary,
                recommendation: summaryData.recommendation,
                adaptabilityScore: summaryData.adaptability.score,
                adaptabilityText: summaryData.adaptability.assessment,
                creativityScore: summaryData.creativity.score,
                creativityText: summaryData.creativity.assessment,
                reasoningScore: summaryData.reasoning.score,
                reasoningText: summaryData.reasoning.assessment,
                conversationJson: messages.map((m) => ({
                    speaker: m.speaker,
                    text: m.text,
                    timestamp: m.timestamp.getTime(),
                })),
                evidenceJson: {
                    adaptability: summaryData.adaptability.evidence,
                    creativity: summaryData.creativity.evidence,
                    reasoning: summaryData.reasoning.evidence,
                },
            },
        });

        log.info("[background-summary/POST] ✅ Background summary created successfully. ID:", backgroundSummary.id);

        return NextResponse.json(
            {
                message: "Background summary generated successfully",
                summaryId: backgroundSummary.id,
            },
            { status: 202 }
        );
    } catch (error) {
        log.error("❌ Error generating background summary:", error);
        return NextResponse.json(
            { error: "Failed to generate background summary" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}

