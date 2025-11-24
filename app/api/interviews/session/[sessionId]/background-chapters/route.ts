import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import OpenAI from "openai";
import prisma from "lib/prisma";
import { createVideoChapter } from "../../../shared/createVideoChapter";
import { CHAPTER_TYPES } from "../../../shared/chapterTypes";

type RouteContext = {
    params: Promise<{ sessionId?: string | string[] }>;
};

function normalizeSessionId(sessionId: string | string[] | undefined) {
    if (Array.isArray(sessionId)) {
        return sessionId[0] ?? "";
    }
    return sessionId ?? "";
}

/**
 * POST /api/interviews/session/[sessionId]/background-chapters
 * Generates a single "Background" chapter with caption for the background interview
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        log.info("[background-chapters/POST] ========== START ==========");

        const url = new URL(request.url);
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        const session = await getServerSession(authOptions);
        log.info("[background-chapters/POST] Session:", session ? `Found (user: ${(session.user as any)?.email})` : "Not found");
        log.info("[background-chapters/POST] Skip auth:", skipAuth);

        const body = await request.json();
        const { userId: requestUserId } = body;

        let userId: string;

        if (skipAuth) {
            if (!requestUserId) {
                log.warn("[background-chapters/POST] ❌ skip-auth mode but no userId provided in request");
                return NextResponse.json(
                    { error: "userId required when skip-auth=true" },
                    { status: 400 }
                );
            }
            userId = requestUserId;
            log.info("[background-chapters/POST] ✅ Skip auth - User ID from request:", userId);
        } else {
            if (!session?.user) {
                log.warn("[background-chapters/POST] ❌ Unauthorized request");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            userId = (session.user as any).id;
            log.info("[background-chapters/POST] ✅ User ID from session:", userId);
        }

        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);
        log.info("[background-chapters/POST] sessionId:", sessionId);

        if (!sessionId) {
            log.warn("[background-chapters/POST] ❌ Interview session id was not provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        // Verify the interview session exists and belongs to the user
        log.info("[background-chapters/POST] Looking up interview session...");
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                candidateId: userId,
            },
            include: {
                telemetryData: true,
            },
        });

        if (!interviewSession) {
            log.warn("[background-chapters/POST] ❌ Interview session not found or doesn't belong to user");
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        if (!interviewSession.telemetryData) {
            log.warn("[background-chapters/POST] ❌ No telemetry data found for session");
            return NextResponse.json(
                { error: "Telemetry data not found" },
                { status: 404 }
            );
        }

        if (!interviewSession.recordingStartedAt) {
            log.warn("[background-chapters/POST] ❌ No recording start time found");
            return NextResponse.json(
                { error: "Recording start time not found" },
                { status: 400 }
            );
        }

        log.info("[background-chapters/POST] ✅ Interview session found:", interviewSession.id);
        const telemetryDataId = interviewSession.telemetryData.id;
        const recordingStartTime = interviewSession.recordingStartedAt;

        // Fetch background conversation messages
        log.info("[background-chapters/POST] Fetching conversation messages...");
        const messages = await prisma.conversationMessage.findMany({
            where: {
                interviewSessionId: sessionId,
                stage: "background",
            },
            orderBy: {
                timestamp: "asc",
            },
        });

        log.info("[background-chapters/POST] Found", messages.length, "background messages");

        if (messages.length === 0) {
            log.warn("[background-chapters/POST] ❌ No background messages found");
            return NextResponse.json(
                { error: "No background conversation found" },
                { status: 400 }
            );
        }

        // Fetch background evidence
        log.info("[background-chapters/POST] Fetching background evidence...");
        const evidenceLinks = await prisma.backgroundEvidence.findMany({
            where: {
                telemetryDataId,
            },
            orderBy: {
                timestamp: "asc",
            },
        });

        log.info("[background-chapters/POST] Found", evidenceLinks.length, "evidence links");

        // Determine chapter start time
        let chapterStartTimestamp: Date;
        if (evidenceLinks.length > 0) {
            chapterStartTimestamp = evidenceLinks[0].timestamp;
            log.info("[background-chapters/POST] Using first evidence timestamp:", chapterStartTimestamp.toISOString());
        } else {
            chapterStartTimestamp = messages[0].timestamp;
            log.info("[background-chapters/POST] Using first message timestamp:", chapterStartTimestamp.toISOString());
        }

        // Calculate start time in seconds from recording start
        const startTimeSeconds = (chapterStartTimestamp.getTime() - recordingStartTime.getTime()) / 1000;
        log.info("[background-chapters/POST] Chapter start time:", startTimeSeconds, "seconds");

        // Generate caption using OpenAI
        log.info("[background-chapters/POST] Generating caption with OpenAI...");
        const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            log.error("[background-chapters/POST] ❌ OpenAI API key not configured");
            // Use fallback caption
            const fallbackCaption = "Background interview and candidate experience discussion";
            log.info("[background-chapters/POST] Using fallback caption:", fallbackCaption);
            
            // Create chapter with fallback caption
            await createChapterWithCaption(telemetryDataId, startTimeSeconds, fallbackCaption);
            
            return NextResponse.json(
                { message: "Background chapter created with fallback caption" },
                { status: 202 }
            );
        }

        const openai = new OpenAI({ apiKey: openaiApiKey });

        // Build conversation summary for OpenAI
        const conversationSummary = messages
            .map(m => `${m.speaker}: ${m.text}`)
            .join('\n')
            .substring(0, 2000); // Limit to 2000 chars

        const prompt = `You are creating a video caption for a background interview segment.

Conversation Summary:
${conversationSummary}

Task: Create a single engaging caption (50-100 characters) that summarizes this background interview conversation.

Output JSON:
{
  "caption": "..."
}`;

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                temperature: 0.7,
                messages: [
                    {
                        role: "system",
                        content: prompt,
                    },
                ],
            });

            const responseText = completion.choices[0]?.message?.content;
            log.info("[background-chapters/POST] OpenAI response length:", responseText?.length || 0);

            if (!responseText) {
                throw new Error("Empty response from OpenAI");
            }

            // Parse response
            let cleanedResponse = responseText.trim();
            if (cleanedResponse.startsWith("```json")) {
                cleanedResponse = cleanedResponse.replace(/^```json\s*/, "").replace(/\s*```$/, "");
            } else if (cleanedResponse.startsWith("```")) {
                cleanedResponse = cleanedResponse.replace(/^```\s*/, "").replace(/\s*```$/, "");
            }

            const captionData = JSON.parse(cleanedResponse);
            const caption = captionData.caption || "Background interview discussion";
            log.info("[background-chapters/POST] ✅ Generated caption:", caption);

            // Create chapter
            await createChapterWithCaption(telemetryDataId, startTimeSeconds, caption);

            return NextResponse.json(
                { message: "Background chapter created successfully" },
                { status: 202 }
            );
        } catch (error) {
            log.error("[background-chapters/POST] ❌ OpenAI error:", error);
            // Use fallback caption
            const fallbackCaption = "Background interview and candidate experience discussion";
            log.info("[background-chapters/POST] Using fallback caption due to error:", fallbackCaption);
            
            await createChapterWithCaption(telemetryDataId, startTimeSeconds, fallbackCaption);
            
            return NextResponse.json(
                { message: "Background chapter created with fallback caption" },
                { status: 202 }
            );
        }
    } catch (error) {
        log.error("❌ Error generating background chapters:", error);
        return NextResponse.json(
            { error: "Failed to generate background chapters" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}

/**
 * Helper function to create the Background chapter with caption
 */
async function createChapterWithCaption(
    telemetryDataId: string,
    startTimeSeconds: number,
    caption: string
) {
    log.info("[createChapterWithCaption] Creating Background chapter...");
    
    await createVideoChapter({
        telemetryDataId,
        title: CHAPTER_TYPES.BACKGROUND,
        startTime: startTimeSeconds,
        description: "Background interview and experience discussion",
        caption,
    });
    
    log.info("[createChapterWithCaption] ✅ Background chapter created");
}
