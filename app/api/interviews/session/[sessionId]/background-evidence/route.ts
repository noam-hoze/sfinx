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

/**
 * POST /api/interviews/session/[sessionId]/background-evidence
 * Creates a background evidence link when user submits an answer
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        log.info("[background-evidence/POST] ========== START ==========");

        const url = new URL(request.url);
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        const session = await getServerSession(authOptions);
        log.info("[background-evidence/POST] Session:", session ? `Found (user: ${(session.user as any)?.email})` : "Not found");
        log.info("[background-evidence/POST] Skip auth:", skipAuth);

        const body = await request.json();
        const { timestamp, questionText, answerText, questionNumber, userId: requestUserId } = body;

        let userId: string;

        if (skipAuth) {
            // In skip-auth mode, userId is optional. If not provided, we'll infer it from the session.
            userId = requestUserId || "";
            log.info("[background-evidence/POST] Skip auth - User ID from request:", userId || "(not provided)");
        } else {
            if (!session?.user) {
                log.warn("[background-evidence/POST] ❌ Unauthorized request");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            userId = (session.user as any).id;
            log.info("[background-evidence/POST] ✅ User ID from session:", userId);
        }

        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);
        log.info("[background-evidence/POST] sessionId:", sessionId);

        if (!sessionId) {
            log.warn("[background-evidence/POST] ❌ Interview session id was not provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        // Validate required fields
        if (!timestamp || !questionText || typeof answerText !== 'string' || typeof questionNumber !== 'number') {
            log.warn("[background-evidence/POST] ❌ Missing required fields:", { timestamp, questionText, answerText, questionNumber });
            return NextResponse.json(
                { error: "Missing required fields: timestamp, questionText, answerText, questionNumber" },
                { status: 400 }
            );
        }

        // Verify the interview session exists
        log.info("[background-evidence/POST] Looking up interview session...");
        
        const whereClause: any = { id: sessionId };
        // Only filter by candidateId if we have a userId
        if (userId) {
            whereClause.candidateId = userId;
        }

        const interviewSession = await prisma.interviewSession.findFirst({
            where: whereClause,
            include: {
                telemetryData: true,
            },
        });

        if (!interviewSession) {
            log.warn("[background-evidence/POST] ❌ Interview session not found or doesn't belong to user");
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        log.info("[background-evidence/POST] ✅ Interview session found:", interviewSession.id);

        // Get or create telemetry data
        let telemetryDataId: string;
        if (interviewSession.telemetryData) {
            telemetryDataId = interviewSession.telemetryData.id;
            log.info("[background-evidence/POST] Using existing telemetryData:", telemetryDataId);
        } else {
            log.info("[background-evidence/POST] Creating new telemetryData...");
            const telemetryData = await prisma.telemetryData.create({
                data: {
                    interviewSessionId: sessionId,
                    matchScore: 0,
                    confidence: "pending",
                    story: "",
                },
            });
            telemetryDataId = telemetryData.id;
            log.info("[background-evidence/POST] ✅ Created telemetryData:", telemetryDataId);
        }

        const dateObj = new Date(timestamp);
        if (isNaN(dateObj.getTime())) {
            log.error("[background-evidence/POST] ❌ Invalid timestamp:", timestamp);
            return NextResponse.json({ error: "Invalid timestamp" }, { status: 400 });
        }

        // Create background evidence record
        log.info("[background-evidence/POST] Creating background evidence with data:", {
            telemetryDataId,
            timestamp: dateObj.toISOString(),
            questionText: questionText.substring(0, 50) + "...",
            answerText: answerText.substring(0, 50) + "...",
            questionNumber
        });

        if (!telemetryDataId) {
            log.error("[background-evidence/POST] ❌ telemetryDataId is missing!");
            return NextResponse.json({ error: "Internal Error: telemetryDataId missing" }, { status: 500 });
        }

        const backgroundEvidence = await prisma.backgroundEvidence.create({
            data: {
                telemetryData: {
                    connect: { id: telemetryDataId }
                },
                timestamp: dateObj,
                questionText,
                answerText,
                questionNumber,
            },
        });

        log.info("[background-evidence/POST] ✅ Background evidence created successfully. ID:", backgroundEvidence.id);

        return NextResponse.json(
            {
                evidenceId: backgroundEvidence.id,
                timestamp: backgroundEvidence.timestamp.toISOString(),
            },
            { status: 201 }
        );
    } catch (error) {
        log.error("❌ Error creating background evidence:", error);
        return NextResponse.json(
            { error: "Failed to create background evidence" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
