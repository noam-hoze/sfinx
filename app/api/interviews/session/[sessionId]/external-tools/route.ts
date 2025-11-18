import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

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
 * POST /api/interviews/session/[sessionId]/external-tools
 * Creates a new external tool usage record.
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
        log.info("[External Tools API] POST request body:", body);

        const {
            timestamp,
            pastedContent,
            characterCount,
            aiQuestion,
            aiQuestionTimestamp,
            userAnswer,
            userAnswerTimestamp,
            understanding,
            accountabilityScore,
            reasoning,
            caption,
        } = body;

        // Validate required fields
        if (
            !timestamp ||
            !pastedContent ||
            !characterCount ||
            !aiQuestion ||
            !aiQuestionTimestamp ||
            !userAnswer ||
            !userAnswerTimestamp ||
            !understanding ||
            typeof accountabilityScore !== "number" ||
            !reasoning ||
            !caption
        ) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Map string understanding to enum
        const understandingMap: Record<string, "FULL" | "PARTIAL" | "NONE"> = {
            full: "FULL",
            partial: "PARTIAL",
            none: "NONE",
        };
        const understandingLevel = understandingMap[understanding.toLowerCase()];

        if (!understandingLevel) {
            return NextResponse.json(
                { error: "Invalid understanding level" },
                { status: 400 }
            );
        }

        log.info("[External Tools API] Creating external tool usage record...");

        // Create the external tool usage record
        const externalToolUsage = await prisma.externalToolUsage.create({
            data: {
                interviewSessionId: sessionId,
                timestamp: new Date(timestamp),
                pastedContent,
                characterCount,
                aiQuestion,
                aiQuestionTimestamp: new Date(aiQuestionTimestamp),
                userAnswer,
                userAnswerTimestamp: new Date(userAnswerTimestamp),
                understanding: understandingLevel,
                accountabilityScore,
                reasoning,
                caption,
            },
        });

        log.info("[External Tools API] External tool usage created:", externalToolUsage.id);

        // Update WorkstyleMetrics.externalToolUsage counter
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

        if (session?.telemetryData?.workstyleMetrics) {
            await prisma.workstyleMetrics.update({
                where: { id: session.telemetryData.workstyleMetrics.id },
                data: {
                    externalToolUsage: {
                        increment: 1,
                    },
                },
            });
            log.info("[External Tools API] WorkstyleMetrics.externalToolUsage incremented");
        }

        // Note: VideoChapter creation moved to /paste-chapter endpoint (called at paste detection)

        return NextResponse.json({
            message: "External tool usage recorded successfully",
            id: externalToolUsage.id,
        });
    } catch (error: any) {
        log.error("[External Tools API] Error creating external tool usage:", error);
        return NextResponse.json(
            {
                error: "Failed to record external tool usage",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/interviews/session/[sessionId]/external-tools
 * Fetches all external tool usage records for a session.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeId(rawSessionId);

        if (!sessionId) {
            return NextResponse.json(
                { error: "Session ID is required" },
                { status: 400 }
            );
        }

        log.info("[External Tools API] Fetching external tool usages for session:", sessionId);

        const externalToolUsages = await prisma.externalToolUsage.findMany({
            where: {
                interviewSessionId: sessionId,
            },
            orderBy: {
                timestamp: "asc",
            },
        });

        log.info("[External Tools API] Found external tool usages:", externalToolUsages.length);

        return NextResponse.json(externalToolUsages);
    } catch (error: any) {
        log.error("[External Tools API] Error fetching external tool usages:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch external tool usages",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

