import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";
import { logger } from "../../../../../lib";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function PATCH(
    request: NextRequest,
    { params }: { params: { sessionId: string } }
) {
    try {
        logger.info("🔍 Interview session update API called");

        const session = await getServerSession(authOptions);
        logger.info(
            "🔍 Session check:",
            session ? "Session found" : "No session"
        );
        logger.info("🔍 User ID:", (session?.user as any)?.id);

        // Temporarily disable auth check for debugging
        // if (!(session?.user as any)?.id) {
        //     console.log("❌ No user ID in session");
        //     return NextResponse.json(
        //         { error: "Unauthorized" },
        //         { status: 401 }
        //     );
        // }

        const userId = (session!.user as any).id;
        const { sessionId } = params;

        logger.info("📋 Session ID:", sessionId);

        // Verify the interview session exists and belongs to the user
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                candidateId: userId,
            },
        });

        if (!interviewSession) {
            logger.warn(
                "❌ Interview session not found or doesn't belong to user"
            );
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        const { videoUrl } = await request.json();

        if (!videoUrl) {
            logger.warn("❌ No video URL provided");
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

        logger.info(
            "✅ Interview session updated with recording URL:",
            updatedSession.id
        );

        return NextResponse.json({
            message: "Interview session updated successfully",
            interviewSession: updatedSession,
        });
    } catch (error) {
        logger.error("❌ Error updating interview session:", error);
        return NextResponse.json(
            { error: "Failed to update interview session" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
