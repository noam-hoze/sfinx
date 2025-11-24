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

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        log.info("[Session GET] === FETCH REQUEST RECEIVED ===");
        
        const skipAuth = request.nextUrl.searchParams.get("skip-auth") === "true";
        const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
        const shouldSkipAuth = skipAuth || isDemoMode;
        
        log.info("[Session GET] Skip auth:", skipAuth);

        const session = await getServerSession(authOptions);
        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);

        if (!sessionId) {
            log.error("[Session GET] ❌ No session ID provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        log.info("[Session GET] Session ID:", sessionId);

        const userId = shouldSkipAuth ? null : (session?.user as any)?.id;
        
        if (!shouldSkipAuth && !userId) {
            log.error("[Session GET] ❌ No user ID found and not in skip-auth/demo mode");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                ...(shouldSkipAuth ? {} : { candidateId: userId }),
            },
        });

        if (!interviewSession) {
            log.error("[Session GET] ❌ Interview session not found");
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        log.info("[Session GET] ✅ Session found:", {
            id: interviewSession.id,
            recordingStartedAt: interviewSession.recordingStartedAt,
        });

        return NextResponse.json({
            interviewSession,
        });
    } catch (error) {
        log.error("[Session GET] ❌ ERROR:", error);
        return NextResponse.json(
            { error: "Failed to fetch interview session" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        log.info("[Session PATCH] === UPDATE REQUEST RECEIVED ===");
        log.info("[Session PATCH] URL:", request.url);

        const skipAuth = request.nextUrl.searchParams.get("skip-auth") === "true";
        const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
        const shouldSkipAuth = skipAuth || isDemoMode;
        
        log.info("[Session PATCH] Skip auth:", skipAuth);
        log.info("[Session PATCH] Demo mode (env):", isDemoMode);
        log.info("[Session PATCH] Should skip auth:", shouldSkipAuth);

        const session = await getServerSession(authOptions);
        log.info("[Session PATCH] Auth session:", session ? "found" : "not found");
        log.info("[Session PATCH] User ID:", (session?.user as any)?.id);

        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);

        if (!sessionId) {
            log.error("[Session PATCH] ❌ No session ID provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        log.info("[Session PATCH] Session ID:", sessionId);

        // Verify the interview session exists (and belongs to user if not demo mode)
        const userId = shouldSkipAuth ? null : (session?.user as any)?.id;
        
        log.info("[Session PATCH] Querying session with where clause:", {
            id: sessionId,
            candidateId: shouldSkipAuth ? "(skipped)" : userId,
        });
        
        if (!shouldSkipAuth && !userId) {
            log.error("[Session PATCH] ❌ No user ID found and not in skip-auth/demo mode");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                ...(shouldSkipAuth ? {} : { candidateId: userId }),
            },
        });

        log.info("[Session PATCH] Session found:", interviewSession ? "YES" : "NO");
        if (interviewSession) {
            log.info("[Session PATCH] Current session state:", {
                id: interviewSession.id,
                candidateId: interviewSession.candidateId,
                videoUrl: interviewSession.videoUrl,
                createdAt: interviewSession.createdAt,
            });
        }

        if (!interviewSession) {
            log.error("[Session PATCH] ❌ Interview session not found or doesn't belong to user");
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        const body = await request.json();
        log.info("[Session PATCH] Request body:", JSON.stringify(body));
        
        const { videoUrl } = body;

        if (!videoUrl) {
            log.error("[Session PATCH] ❌ No video URL provided in body");
            return NextResponse.json(
                { error: "Video URL is required" },
                { status: 400 }
            );
        }

        log.info("[Session PATCH] Video URL to save:", videoUrl);

        // Update the interview session with the recording URL
        log.info("[Session PATCH] Executing prisma update...");
        
        const updatedSession = await prisma.interviewSession.update({
            where: {
                id: sessionId,
            },
            data: {
                videoUrl: videoUrl,
            },
        });

        log.info("[Session PATCH] ✅ SUCCESS! Updated session:", {
            id: updatedSession.id,
            videoUrl: updatedSession.videoUrl,
        });

        return NextResponse.json({
            message: "Interview session updated successfully",
            interviewSession: updatedSession,
        });
    } catch (error) {
        log.error("[Session PATCH] ❌ ERROR:", error);
        if (error instanceof Error) {
            log.error("[Session PATCH] Error message:", error.message);
            log.error("[Session PATCH] Error stack:", error.stack);
        }
        return NextResponse.json(
            { error: "Failed to update interview session" },
            { status: 500 }
        );
    }
}
