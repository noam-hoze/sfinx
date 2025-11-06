import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

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
        log.info("Interview session update API called");

        const session = await getServerSession(authOptions);
        log.info("Session check:", session ? "Session found" : "No session");
        log.info("User ID:", (session?.user as any)?.id);

        const userId = (session!.user as any).id;
        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);

        if (!sessionId) {
            log.warn("❌ Interview session id was not provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        log.info("Session ID:", sessionId);

        // Verify the interview session exists and belongs to the user
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                candidateId: userId,
            },
        });

        if (!interviewSession) {
            log.warn(
                "❌ Interview session not found or doesn't belong to user"
            );
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        const { videoUrl } = await request.json();

        if (!videoUrl) {
            log.warn("❌ No video URL provided");
            return NextResponse.json(
                { error: "Video URL is required" },
                { status: 400 }
            );
        }

        // Update the interview session with the recording URL
        const updatedSession = await prisma.interviewSession.update({
            where: {
                id: sessionId,
            },
            data: {
                videoUrl: videoUrl,
            },
        });

        log.info("Interview session updated with recording URL:", updatedSession.id);

        return NextResponse.json({
            message: "Interview session updated successfully",
            interviewSession: updatedSession,
        });
    } catch (error) {
        log.error("❌ Error updating interview session:", error);
        return NextResponse.json(
            { error: "Failed to update interview session" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
