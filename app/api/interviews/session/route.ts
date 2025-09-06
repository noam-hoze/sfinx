import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function POST(request: NextRequest) {
    try {
        console.log("🔍 Interview session creation API called");

        const session = await getServerSession(authOptions);
        console.log("🔍 Session:", session ? "Found" : "Not found");

        if (!(session?.user as any)?.id) {
            console.log("❌ No user ID in session");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session!.user as any).id;
        console.log("✅ User ID:", userId);

        const { applicationId, companyId } = await request.json();
        console.log("📋 Request data:", { applicationId, companyId });

        if (!applicationId) {
            console.log("❌ Missing applicationId");
            return NextResponse.json(
                { error: "Application ID is required" },
                { status: 400 }
            );
        }

        // Verify the application exists and belongs to the user
        const application = await prisma.application.findFirst({
            where: {
                id: applicationId,
                candidateId: userId,
            },
        });

        if (!application) {
            console.log("❌ Application not found or doesn't belong to user");
            return NextResponse.json(
                { error: "Application not found" },
                { status: 404 }
            );
        }

        // Check if interview session already exists for this application
        const existingSession = await prisma.interviewSession.findFirst({
            where: {
                applicationId: applicationId,
                candidateId: userId,
            },
        });

        if (existingSession) {
            console.log(
                "✅ Existing interview session found:",
                existingSession.id
            );
            return NextResponse.json({
                message: "Interview session already exists",
                interviewSession: existingSession,
            });
        }

        // Create new interview session
        console.log("🚀 Creating interview session...");
        const interviewSession = await prisma.interviewSession.create({
            data: {
                candidateId: userId,
                applicationId: applicationId,
                status: "IN_PROGRESS",
            },
        });

        console.log("✅ Interview session created:", interviewSession.id);
        return NextResponse.json({
            message: "Interview session created successfully",
            interviewSession,
        });
    } catch (error) {
        console.error("❌ Error creating interview session:", error);
        console.error("❌ Error details:", {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
        });
        return NextResponse.json(
            { error: "Failed to create interview session" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
