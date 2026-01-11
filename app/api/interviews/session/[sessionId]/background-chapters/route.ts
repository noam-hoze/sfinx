import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import { createVideoChapter } from "../../../shared/createVideoChapter";
import { CHAPTER_TYPES } from "../../../shared/chapterTypes";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

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
        log.info(LOG_CATEGORY, "[background-chapters/POST] ========== START ==========");

        const url = new URL(request.url);
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        const session = await getServerSession(authOptions);
        log.info(LOG_CATEGORY, "[background-chapters/POST] Session:", session ? `Found (user: ${(session.user as any)?.email})` : "Not found");
        log.info(LOG_CATEGORY, "[background-chapters/POST] Skip auth:", skipAuth);

        const body = await request.json();
        const { userId: requestUserId } = body;

        let userId: string;

        if (skipAuth) {
            if (!requestUserId) {
                log.warn(LOG_CATEGORY, "[background-chapters/POST] ❌ skip-auth mode but no userId provided in request");
                return NextResponse.json(
                    { error: "userId required when skip-auth=true" },
                    { status: 400 }
                );
            }
            userId = requestUserId;
            log.info(LOG_CATEGORY, "[background-chapters/POST] ✅ Skip auth - User ID from request:", userId);
        } else {
            if (!session?.user) {
                log.warn(LOG_CATEGORY, "[background-chapters/POST] ❌ Unauthorized request");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            userId = (session.user as any).id;
            log.info(LOG_CATEGORY, "[background-chapters/POST] ✅ User ID from session:", userId);
        }

        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);
        log.info(LOG_CATEGORY, "[background-chapters/POST] sessionId:", sessionId);

        if (!sessionId) {
            log.warn(LOG_CATEGORY, "[background-chapters/POST] ❌ Interview session id was not provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        // Verify the interview session exists and belongs to the user
        log.info(LOG_CATEGORY, "[background-chapters/POST] Looking up interview session...");
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
            log.warn(LOG_CATEGORY, "[background-chapters/POST] ❌ Interview session not found or doesn't belong to user");
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        if (!interviewSession.telemetryData) {
            log.warn(LOG_CATEGORY, "[background-chapters/POST] ❌ No telemetry data found for session");
            return NextResponse.json(
                { error: "Telemetry data not found" },
                { status: 404 }
            );
        }

        if (!interviewSession.recordingStartedAt) {
            log.warn(LOG_CATEGORY, "[background-chapters/POST] ❌ No recording start time found");
            return NextResponse.json(
                { error: "Recording start time not found" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[background-chapters/POST] ✅ Interview session found:", interviewSession.id);
        const telemetryDataId = interviewSession.telemetryData.id;
        const recordingStartTime = interviewSession.recordingStartedAt;

        // Fetch background conversation messages
        log.info(LOG_CATEGORY, "[background-chapters/POST] Fetching conversation messages...");
        const messages = await prisma.conversationMessage.findMany({
            where: {
                interviewSessionId: sessionId,
                stage: "background",
            },
            orderBy: {
                timestamp: "asc",
            },
        });

        log.info(LOG_CATEGORY, "[background-chapters/POST] Found", messages.length, "background messages");

        if (messages.length === 0) {
            log.warn(LOG_CATEGORY, "[background-chapters/POST] ❌ No background messages found");
            return NextResponse.json(
                { error: "No background conversation found" },
                { status: 400 }
            );
        }

        // Fetch background evidence
        log.info(LOG_CATEGORY, "[background-chapters/POST] Fetching background evidence...");
        const evidenceLinks = await prisma.backgroundEvidence.findMany({
            where: {
                telemetryDataId,
            },
            orderBy: {
                timestamp: "asc",
            },
        });

        log.info(LOG_CATEGORY, "[background-chapters/POST] Found", evidenceLinks.length, "evidence links");

        // Determine chapter start time
        let chapterStartTimestamp: Date;
        if (evidenceLinks.length > 0) {
            chapterStartTimestamp = evidenceLinks[0].timestamp;
            log.info(LOG_CATEGORY, "[background-chapters/POST] Using first evidence timestamp:", chapterStartTimestamp.toISOString());
        } else {
            chapterStartTimestamp = messages[0].timestamp;
            log.info(LOG_CATEGORY, "[background-chapters/POST] Using first message timestamp:", chapterStartTimestamp.toISOString());
        }

        // Calculate start time in seconds from recording start
        const startTimeSeconds = (chapterStartTimestamp.getTime() - recordingStartTime.getTime()) / 1000;
        log.info(LOG_CATEGORY, "[background-chapters/POST] Chapter start time:", startTimeSeconds, "seconds");

        // Create chapter without caption (captions will be created by background-summary based on analysis)
        await createChapterWithCaption(telemetryDataId, startTimeSeconds);

        return NextResponse.json(
            { message: "Background chapter created successfully" },
            { status: 202 }
        );
    } catch (error) {
        log.error(LOG_CATEGORY, "❌ Error generating background chapters:", error);
        return NextResponse.json(
            { error: "Failed to generate background chapters" },
            { status: 500 }
        );
    }
}

/**
 * Helper function to create the Background chapter
 */
async function createChapterWithCaption(
    telemetryDataId: string,
    startTimeSeconds: number
) {
    log.info(LOG_CATEGORY, "[createChapterWithCaption] Creating Background chapter...");
    
    await createVideoChapter({
        telemetryDataId,
        title: CHAPTER_TYPES.BACKGROUND,
        startTime: startTimeSeconds,
        description: "Background interview and experience discussion",
        // No caption initially - will be populated by background-summary with analysis results
    });
    
    log.info(LOG_CATEGORY, "[createChapterWithCaption] ✅ Background chapter created");
}
