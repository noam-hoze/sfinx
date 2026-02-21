import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

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

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        log.info(LOG_CATEGORY, "[messages/POST] ========== START ==========");

        const url = new URL(request.url);
        // TODO: [Bug] skip-auth=true lets any unauthenticated caller bypass authentication and perform privileged
        //        operations by supplying an arbitrary userId. Remove or gate behind a server-side secret.
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        const session = await getServerSession(authOptions);
        log.info(LOG_CATEGORY, "[messages/POST] Session:", session ? `Found (user: ${(session.user as any)?.email})` : "Not found");
        log.info(LOG_CATEGORY, "[messages/POST] Skip auth:", skipAuth);

        const body = await request.json();
        const { messages, userId: requestUserId } = body;

        let userId: string;

        if (skipAuth) {
            if (!requestUserId) {
                log.warn(LOG_CATEGORY, "[messages/POST] ❌ skip-auth mode but no userId provided in request");
                return NextResponse.json(
                    { error: "userId required when skip-auth=true" },
                    { status: 400 }
                );
            }
            userId = requestUserId;
            log.info(LOG_CATEGORY, "[messages/POST] ✅ Skip auth - User ID from request:", userId);
        } else {
            if (!session?.user) {
                log.warn(LOG_CATEGORY, "[messages/POST] ❌ Unauthorized request");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            userId = (session.user as any).id;
            log.info(LOG_CATEGORY, "[messages/POST] ✅ User ID from session:", userId);
        }

        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);
        log.info(LOG_CATEGORY, "[messages/POST] userId:", userId);
        log.info(LOG_CATEGORY, "[messages/POST] sessionId (raw):", rawSessionId);
        log.info(LOG_CATEGORY, "[messages/POST] sessionId (normalized):", sessionId);

        if (!sessionId) {
            log.warn(LOG_CATEGORY, "[messages/POST] ❌ Interview session id was not provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        // Verify the interview session exists and belongs to the user
        log.info(LOG_CATEGORY, "[messages/POST] Looking up interview session...");
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                candidateId: userId,
            },
        });

        if (!interviewSession) {
            log.warn(LOG_CATEGORY, "[messages/POST] ❌ Interview session not found or doesn't belong to user");
            log.warn(LOG_CATEGORY, "[messages/POST] Searched for: sessionId=", sessionId, "candidateId=", userId);
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        log.info(LOG_CATEGORY, "[messages/POST] ✅ Interview session found:", interviewSession.id);

        log.info(LOG_CATEGORY, "[messages/POST] Received messages:", messages?.length || 0);

        if (!Array.isArray(messages)) {
            log.warn(LOG_CATEGORY, "[messages/POST] ❌ Invalid messages format (not an array)");
            return NextResponse.json(
                { error: "Messages must be an array" },
                { status: 400 }
            );
        }

        if (messages.length === 0) {
            log.warn(LOG_CATEGORY, "[messages/POST] ⚠️ Empty messages array received");
            return NextResponse.json({
                message: "No messages to save",
                count: 0,
            });
        }

        log.info(LOG_CATEGORY, `[messages/POST] Saving ${messages.length} messages for session ${sessionId}...`);
        log.info(LOG_CATEGORY, "[messages/POST] First message sample:", messages[0]);

        // Batch create messages in transaction
        await prisma.$transaction(
            messages.map((msg: any) =>
                prisma.conversationMessage.create({
                    data: {
                        interviewSessionId: sessionId,
                        speaker: msg.speaker,
                        text: msg.text,
                        stage: msg.stage,
                        timestamp: new Date(msg.timestamp),
                    },
                })
            )
        );

        log.info(LOG_CATEGORY, "[messages/POST] ✅ Messages saved successfully. Count:", messages.length);

        return NextResponse.json({
            message: "Messages saved successfully",
            count: messages.length,
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[messages/POST] ❌ Error saving messages:", error);
        log.error(LOG_CATEGORY, "[messages/POST] Error stack:", error instanceof Error ? error.stack : "N/A");
        return NextResponse.json(
            { error: "Failed to save messages" },
            { status: 500 }
        );
    }
}
