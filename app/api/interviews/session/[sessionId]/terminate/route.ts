import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

function normalizeSessionId(sessionId: string | string[] | undefined) {
    if (Array.isArray(sessionId)) {
        return sessionId[0];
    }
    return sessionId ?? "";
}

/**
 * Terminate an interview session.
 * Unsubmitted sessions are deleted so they are not visible to companies.
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        log.info(LOG_CATEGORY, "[Session TERMINATE] === TERMINATE REQUEST RECEIVED ===");

        const skipAuth = request.nextUrl.searchParams.get("skip-auth") === "true";
        const shouldSkipAuth = skipAuth;

        const session = await getServerSession(authOptions);
        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);

        if (!sessionId) {
            log.error(LOG_CATEGORY, "[Session TERMINATE] ❌ No session ID provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[Session TERMINATE] Session ID:", sessionId);

        const userId = shouldSkipAuth ? null : (session?.user as any)?.id;

        if (!shouldSkipAuth && !userId) {
            log.error(LOG_CATEGORY, "[Session TERMINATE] ❌ No user ID found");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Verify session exists and belongs to user
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                ...(shouldSkipAuth ? {} : { candidateId: userId }),
            },
        });

        if (!interviewSession) {
            log.error(LOG_CATEGORY, "[Session TERMINATE] ❌ Session not found");
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        if (interviewSession.status === "PROCESSING" || interviewSession.status === "COMPLETED") {
            log.info(
                LOG_CATEGORY,
                "[Session TERMINATE] ℹ️ Keeping submitted session:",
                interviewSession.id,
                "status:",
                interviewSession.status
            );
            return NextResponse.json({
                message: "Interview session already submitted; preserved",
                interviewSession,
            });
        }

        await prisma.interviewSession.delete({
            where: {
                id: sessionId,
            },
        });

        log.info(LOG_CATEGORY, "[Session TERMINATE] ✅ Unsubmitted session deleted:", sessionId);

        return NextResponse.json({
            message: "Interview session discarded",
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[Session TERMINATE] ❌ ERROR:", error);
        return NextResponse.json(
            { error: "Failed to terminate interview session" },
            { status: 500 }
        );
    }
}

