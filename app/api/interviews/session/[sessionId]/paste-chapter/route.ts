import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import { createVideoChapter } from "../../../shared/createVideoChapter";

type RouteContext = {
    params: Promise<{ sessionId?: string | string[] }>;
};

function normalizeId(id: string | string[] | undefined) {
    if (Array.isArray(id)) {
        return id[0] ?? "";
    }
    return id ?? "";
}

/**
 * POST /api/interviews/session/[sessionId]/paste-chapter
 * Creates a video chapter when paste is detected (before evaluation).
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeId(rawSessionId);

        if (!sessionId) {
            return NextResponse.json(
                { error: "Session ID is required" },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { timestamp, caption } = body;

        if (!timestamp || !caption) {
            return NextResponse.json(
                { error: "timestamp and caption are required" },
                { status: 400 }
            );
        }

        log.info("[Paste Chapter API] Creating chapter at paste detection");

        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                telemetryData: {
                    include: {
                        workstyleMetrics: true,
                    },
                },
            },
        });

        if (!session?.recordingStartedAt || !session?.telemetryData?.id) {
            return NextResponse.json(
                { error: "Session not ready for chapter creation" },
                { status: 400 }
            );
        }

        const pasteTimestamp = new Date(timestamp);
        const recordingStartTime = session.recordingStartedAt;
        const videoOffset = Math.floor((pasteTimestamp.getTime() - recordingStartTime.getTime()) / 1000);
        
        log.info("🎬 [Paste Chapter API] VideoChapter calculation:");
        log.info("  - Recording started at:", recordingStartTime.toISOString());
        log.info("  - Paste occurred at:", pasteTimestamp.toISOString());
        log.info("  - Calculated video offset (s):", videoOffset);
        
        if (videoOffset < 0) {
            return NextResponse.json(
                { error: "Invalid timestamp: paste occurred before recording started" },
                { status: 400 }
            );
        }

        const videoChapter = await createVideoChapter({
            telemetryDataId: session.telemetryData.id,
            title: "External Tool Usage",
            startTime: videoOffset,
            description: "External tool usage detected",
            caption: caption,
        });

        return NextResponse.json({
            message: "Chapter created successfully",
            chapterId: videoChapter.id,
        });
    } catch (error: any) {
        log.error("[Paste Chapter API] Error creating chapter:", error);
        return NextResponse.json(
            {
                error: "Failed to create chapter",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

