import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import type { EvidenceCategory, TelemetryData } from "@prisma/client";

type RouteContext = {
    params: Promise<{ sessionId?: string | string[] }>;
};

/**
 * Lightweight error wrapper for consistent HTTP responses.
 */
class RequestError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

/**
 * Normalizes a session id parameter into a single string.
 */
function normalizeSessionId(sessionId: string | string[] | undefined) {
    if (Array.isArray(sessionId)) {
        return sessionId[0] ?? "";
    }
    return sessionId ?? "";
}

/**
 * Validates and returns the request payload for background evidence.
 */
function parseRequestPayload(body: any) {
    const { timestamp, questionText, answerText, questionNumber, userId } = body;
    const isInvalid =
        !timestamp ||
        typeof questionText !== "string" ||
        typeof answerText !== "string" ||
        typeof questionNumber !== "number";

    if (isInvalid) {
        log.warn("[background-evidence/POST] ❌ Missing required fields:", { timestamp, questionText, answerText, questionNumber });
        throw new RequestError(400, "Missing required fields: timestamp, questionText, answerText, questionNumber");
    }

    return { timestamp, questionText, answerText, questionNumber, userId } as {
        timestamp: string;
        questionText: string;
        answerText: string;
        questionNumber: number;
        userId?: string;
    };
}

/**
 * Resolves the request user id with optional auth skipping.
 */
function resolveUserId(skipAuth: boolean, session: any, requestUserId?: string) {
    if (skipAuth) {
        const userId = requestUserId || "";
        log.info("[background-evidence/POST] Skip auth - User ID from request:", userId || "(not provided)");
        return userId;
    }
    if (!session?.user) {
        throw new RequestError(401, "Unauthorized");
    }
    const userId = (session.user as any).id;
    log.info("[background-evidence/POST] ✅ User ID from session:", userId);
    return userId;
}

/**
 * Resolves the session id and guards against missing values.
 */
async function resolveSessionId(context: RouteContext) {
    const { sessionId: rawSessionId } = await context.params;
    const sessionId = normalizeSessionId(rawSessionId);
    log.info("[background-evidence/POST] sessionId:", sessionId);

    if (!sessionId) {
        log.warn("[background-evidence/POST] ❌ Interview session id was not provided");
        throw new RequestError(400, "Interview session id is required");
    }

    return sessionId;
}

/**
 * Ensures telemetry data exists for the session.
 */
async function ensureTelemetryData(sessionId: string, telemetryData?: TelemetryData | null) {
    if (telemetryData) {
        log.info("[background-evidence/POST] Using existing telemetryData:", telemetryData.id);
        return telemetryData.id;
    }
    log.info("[background-evidence/POST] Creating new telemetryData...");
    const created = await prisma.telemetryData.create({
        data: {
            interviewSessionId: sessionId,
            matchScore: 0,
            confidence: "pending",
            story: "",
        },
    });
    log.info("[background-evidence/POST] ✅ Created telemetryData:", created.id);
    return created.id;
}

/**
 * Creates a background evidence record.
 */
async function createBackgroundEvidence(data: {
    telemetryDataId: string;
    timestamp: Date;
    questionText: string;
    answerText: string;
    questionNumber: number;
}) {
    log.info("[background-evidence/POST] Creating background evidence with data:", {
        telemetryDataId: data.telemetryDataId,
        timestamp: data.timestamp,
        questionText: data.questionText.substring(0, 50) + "...",
        answerText: data.answerText.substring(0, 50) + "...",
        questionNumber: data.questionNumber,
    });

    const created = await prisma.backgroundEvidence.create({ data });
    log.info("[background-evidence/POST] ✅ Background evidence created successfully. ID:", created.id);
    return created;
}

/**
 * Calculates clip start time relative to recording start.
 */
function calculateStartTime(evidenceTimestamp: Date, recordingStartedAt?: Date | null) {
    if (!recordingStartedAt) {
        log.warn("[background-evidence/POST] ⚠️ Recording start time missing; cannot compute startTime");
        return null;
    }
    const offsetSeconds = Math.round((evidenceTimestamp.getTime() - recordingStartedAt.getTime()) / 1000);
    if (offsetSeconds < 0) {
        log.warn("[background-evidence/POST] ⚠️ Negative startTime offset; skipping clip startTime", { offsetSeconds });
        return null;
    }
    return offsetSeconds;
}

/**
 * Creates an evidence clip for the background response.
 */
async function createBackgroundEvidenceClip(params: {
    telemetryDataId: string;
    evidenceTimestamp: Date;
    questionText: string;
    answerText: string;
    questionNumber: number;
    recordingStartedAt?: Date | null;
}) {
    const startTime = calculateStartTime(params.evidenceTimestamp, params.recordingStartedAt);
    const title = `Background Q${params.questionNumber}`;
    const description = `${params.questionText} — ${params.answerText.substring(0, 80)}`;
    const clipCategory: EvidenceCategory | null = "AI_ASSIST_USAGE";

    log.info("[background-evidence/POST] Creating evidence clip:", {
        telemetryDataId: params.telemetryDataId,
        title,
        startTime,
        category: clipCategory,
    });

    const clip = await prisma.evidenceClip.create({
        data: {
            telemetryDataId: params.telemetryDataId,
            title,
            duration: 0,
            description,
            startTime,
            thumbnailUrl: null,
            category: clipCategory,
        },
    });

    log.info("[background-evidence/POST] ✅ Evidence clip created:", clip.id);
    return clip;
}

/**
 * Retrieves the interview session with optional candidate scoping.
 */
async function findInterviewSession(sessionId: string, userId: string) {
    log.info("[background-evidence/POST] Looking up interview session...");

    const whereClause: any = { id: sessionId };
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
        throw new RequestError(404, "Interview session not found");
    }

    log.info("[background-evidence/POST] ✅ Interview session found:", interviewSession.id);
    return interviewSession;
}

/**
 * Executes the background evidence creation workflow.
 */
async function executePost(request: NextRequest, context: RouteContext) {
    log.info("[background-evidence/POST] ========== START ==========");

    const url = new URL(request.url);
    const skipAuth = url.searchParams.get("skip-auth") === "true";

    const session = await getServerSession(authOptions);
    log.info("[background-evidence/POST] Session:", session ? `Found (user: ${(session.user as any)?.email})` : "Not found");
    log.info("[background-evidence/POST] Skip auth:", skipAuth);

    const payload = parseRequestPayload(await request.json());
    const userId = resolveUserId(skipAuth, session, payload.userId);
    const sessionId = await resolveSessionId(context);
    const interviewSession = await findInterviewSession(sessionId, userId);
    const telemetryDataId = await ensureTelemetryData(sessionId, interviewSession.telemetryData);
    const evidenceTimestamp = new Date(payload.timestamp);

    const backgroundEvidence = await createBackgroundEvidence({ telemetryDataId, timestamp: evidenceTimestamp, questionText: payload.questionText, answerText: payload.answerText, questionNumber: payload.questionNumber });

    await createBackgroundEvidenceClip({ telemetryDataId, evidenceTimestamp, questionText: payload.questionText, answerText: payload.answerText, questionNumber: payload.questionNumber, recordingStartedAt: interviewSession.recordingStartedAt });

    return NextResponse.json({ evidenceId: backgroundEvidence.id, timestamp: backgroundEvidence.timestamp.toISOString() }, { status: 201 });
}

/**
 * POST /api/interviews/session/[sessionId]/background-evidence
 * Creates a background evidence link when user submits an answer
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        return await executePost(request, context);
    } catch (error) {
        log.error("❌ Error creating background evidence:", error);
        const status = error instanceof RequestError ? error.status : 500;
        const message = error instanceof RequestError ? error.message : "Failed to create background evidence";
        return NextResponse.json(
            { error: message },
            { status }
        );
    } finally {
        await prisma.$disconnect();
    }
}
