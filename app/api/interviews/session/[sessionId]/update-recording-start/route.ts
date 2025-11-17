import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

type RouteContext = {
    params: Promise<{ sessionId?: string | string[] }>;
};

function normalizeSessionId(sessionId: string | string[] | undefined) {
    if (Array.isArray(sessionId)) {
        return sessionId[0] ?? "";
    }
    return sessionId ?? "";
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        log.info("[Update Recording Start] === REQUEST RECEIVED ===");
        
        const skipAuth = request.nextUrl.searchParams.get("skip-auth") === "true";
        const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
        const shouldSkipAuth = skipAuth || isDemoMode;
        
        log.info("[Update Recording Start] Skip auth:", skipAuth);

        const session = await getServerSession(authOptions);
        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);

        if (!sessionId) {
            log.error("[Update Recording Start] ❌ No session ID provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        log.info("[Update Recording Start] Session ID:", sessionId);

        const userId = shouldSkipAuth ? null : (session?.user as any)?.id;
        
        if (!shouldSkipAuth && !userId) {
            log.error("[Update Recording Start] ❌ No user ID found and not in skip-auth/demo mode");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        
        const body = await request.json();
        const { recordingStartedAt } = body;
        
        if (!recordingStartedAt) {
            log.error("[Update Recording Start] ❌ No recordingStartedAt provided");
            return NextResponse.json(
                { error: "recordingStartedAt is required" },
                { status: 400 }
            );
        }
        
        log.info("[Update Recording Start] New recording start time:", recordingStartedAt);
        
        // Verify session exists and belongs to user
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                ...(shouldSkipAuth ? {} : { candidateId: userId }),
            },
        });

        if (!interviewSession) {
            log.error("[Update Recording Start] ❌ Interview session not found");
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }
        
        // Update the recording start time
        const updatedSession = await prisma.interviewSession.update({
            where: { id: sessionId },
            data: {
                recordingStartedAt: new Date(recordingStartedAt),
            },
        });

        log.info("[Update Recording Start] ✅ Updated session:", {
            id: updatedSession.id,
            recordingStartedAt: updatedSession.recordingStartedAt,
        });

        return NextResponse.json({
            message: "Recording start time updated successfully",
            interviewSession: updatedSession,
        });
    } catch (error) {
        log.error("[Update Recording Start] ❌ ERROR:", error);
        return NextResponse.json(
            { error: "Failed to update recording start time" },
            { status: 500 }
        );
    }
}

