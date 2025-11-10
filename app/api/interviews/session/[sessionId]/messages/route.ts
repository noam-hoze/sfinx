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

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        log.info("[messages/POST] ========== START ==========");

        const url = new URL(request.url);
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        const session = await getServerSession(authOptions);
        log.info("[messages/POST] Session:", session ? `Found (user: ${(session.user as any)?.email})` : "Not found");
        log.info("[messages/POST] Skip auth:", skipAuth);

        const body = await request.json();
        const { messages, userId: requestUserId } = body;

        let userId: string;

        if (skipAuth) {
            if (!requestUserId) {
                log.warn("[messages/POST] ❌ skip-auth mode but no userId provided in request");
                return NextResponse.json(
                    { error: "userId required when skip-auth=true" },
                    { status: 400 }
                );
            }
            userId = requestUserId;
            log.info("[messages/POST] ✅ Skip auth - User ID from request:", userId);
        } else {
            if (!session?.user) {
                log.warn("[messages/POST] ❌ Unauthorized request");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            userId = (session.user as any).id;
            log.info("[messages/POST] ✅ User ID from session:", userId);
        }

        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);
        log.info("[messages/POST] userId:", userId);
        log.info("[messages/POST] sessionId (raw):", rawSessionId);
        log.info("[messages/POST] sessionId (normalized):", sessionId);

        if (!sessionId) {
            log.warn("[messages/POST] ❌ Interview session id was not provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        // Verify the interview session exists and belongs to the user
        log.info("[messages/POST] Looking up interview session...");
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                candidateId: userId,
            },
        });

        if (!interviewSession) {
            log.warn("[messages/POST] ❌ Interview session not found or doesn't belong to user");
            log.warn("[messages/POST] Searched for: sessionId=", sessionId, "candidateId=", userId);
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        log.info("[messages/POST] ✅ Interview session found:", interviewSession.id);

        log.info("[messages/POST] Received messages:", messages?.length || 0);

        if (!Array.isArray(messages)) {
            log.warn("[messages/POST] ❌ Invalid messages format (not an array)");
            return NextResponse.json(
                { error: "Messages must be an array" },
                { status: 400 }
            );
        }

        if (messages.length === 0) {
            log.warn("[messages/POST] ⚠️ Empty messages array received");
            return NextResponse.json({
                message: "No messages to save",
                count: 0,
            });
        }

        log.info(`[messages/POST] Saving ${messages.length} messages for session ${sessionId}...`);
        log.info("[messages/POST] First message sample:", messages[0]);

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

        log.info("[messages/POST] ✅ Messages saved successfully. Count:", messages.length);

        return NextResponse.json({
            message: "Messages saved successfully",
            count: messages.length,
        });
    } catch (error) {
        log.error("[messages/POST] ❌ Error saving messages:", error);
        log.error("[messages/POST] Error stack:", error instanceof Error ? error.stack : "N/A");
        return NextResponse.json(
            { error: "Failed to save messages" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}

