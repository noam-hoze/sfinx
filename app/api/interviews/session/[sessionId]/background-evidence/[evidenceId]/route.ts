import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

type RouteContext = {
    params: Promise<{ sessionId?: string | string[]; evidenceId?: string | string[] }>;
};

function normalizeId(id: string | string[] | undefined) {
    if (Array.isArray(id)) {
        return id[0] ?? "";
    }
    return id ?? "";
}

/**
 * PATCH /api/interviews/session/[sessionId]/background-evidence/[evidenceId]
 * Updates duration for a specific background evidence record
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        log.info("[background-evidence/[evidenceId]/PATCH] ========== START ==========");

        const url = new URL(request.url);
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        const session = await getServerSession(authOptions);
        log.info("[background-evidence/[evidenceId]/PATCH] Session:", session ? `Found (user: ${(session.user as any)?.email})` : "Not found");
        log.info("[background-evidence/[evidenceId]/PATCH] Skip auth:", skipAuth);

        const body = await request.json();
        const { duration, userId: requestUserId } = body;

        let userId: string;

        if (skipAuth) {
            userId = requestUserId || "";
            log.info("[background-evidence/[evidenceId]/PATCH] Skip auth - User ID from request:", userId || "(not provided)");
        } else {
            if (!session?.user) {
                log.warn("[background-evidence/[evidenceId]/PATCH] ❌ Unauthorized request");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            userId = (session.user as any).id;
            log.info("[background-evidence/[evidenceId]/PATCH] ✅ User ID from session:", userId);
        }

        const { sessionId: rawSessionId, evidenceId: rawEvidenceId } = await context.params;
        const sessionId = normalizeId(rawSessionId);
        const evidenceId = normalizeId(rawEvidenceId);

        log.info("[background-evidence/[evidenceId]/PATCH] sessionId:", sessionId);
        log.info("[background-evidence/[evidenceId]/PATCH] evidenceId:", evidenceId);

        if (!sessionId || !evidenceId) {
            log.warn("[background-evidence/[evidenceId]/PATCH] ❌ Missing sessionId or evidenceId");
            return NextResponse.json(
                { error: "Session ID and Evidence ID are required" },
                { status: 400 }
            );
        }

        if (typeof duration !== 'number' || duration < 0) {
            log.warn("[background-evidence/[evidenceId]/PATCH] ❌ Invalid duration:", duration);
            return NextResponse.json(
                { error: "Valid duration is required" },
                { status: 400 }
            );
        }

        // Verify the evidence exists and belongs to this session
        const evidence = await prisma.backgroundEvidence.findFirst({
            where: {
                id: evidenceId,
            },
            include: {
                telemetryData: {
                    include: {
                        interviewSession: true,
                    },
                },
            },
        });

        if (!evidence) {
            log.warn("[background-evidence/[evidenceId]/PATCH] ❌ Evidence not found");
            return NextResponse.json(
                { error: "Evidence not found" },
                { status: 404 }
            );
        }

        if (evidence.telemetryData.interviewSession.id !== sessionId) {
            log.warn("[background-evidence/[evidenceId]/PATCH] ❌ Evidence doesn't belong to session");
            return NextResponse.json(
                { error: "Evidence doesn't belong to this session" },
                { status: 403 }
            );
        }

        if (userId && evidence.telemetryData.interviewSession.candidateId !== userId) {
            log.warn("[background-evidence/[evidenceId]/PATCH] ❌ Evidence doesn't belong to user");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 403 }
            );
        }

        // Update duration
        await prisma.backgroundEvidence.update({
            where: { id: evidenceId },
            data: { duration: Math.floor(duration) },
        });

        log.info("[background-evidence/[evidenceId]/PATCH] ✅ Duration updated:", duration, "s");

        return NextResponse.json(
            { message: "Duration updated successfully", duration: Math.floor(duration) },
            { status: 200 }
        );
    } catch (error) {
        log.error("❌ Error updating background evidence duration:", error);
        return NextResponse.json(
            { error: "Failed to update evidence duration" },
            { status: 500 }
        );
    }
}
