import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";

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
        console.log("🔍 Interview session update API called");

        const session = await getServerSession(authOptions);
        console.log(
            "🔍 Session check:",
            session ? "Session found" : "No session"
        );
        console.log("🔍 User ID:", (session?.user as any)?.id);

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

        console.log("📋 Session ID:", sessionId);

        // Verify the interview session exists and belongs to the user
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                candidateId: userId,
            },
        });

        if (!interviewSession) {
            console.log(
                "❌ Interview session not found or doesn't belong to user"
            );
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        const { videoUrl } = await request.json();

        if (!videoUrl) {
            console.log("❌ No video URL provided");
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

        console.log(
            "✅ Interview session updated with recording URL:",
            updatedSession.id
        );

        return NextResponse.json({
            message: "Interview session updated successfully",
            interviewSession: updatedSession,
        });
    } catch (error) {
        console.error("❌ Error updating interview session:", error);
        return NextResponse.json(
            { error: "Failed to update interview session" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
