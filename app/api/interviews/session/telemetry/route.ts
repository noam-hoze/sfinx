import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function POST(request: NextRequest) {
    console.log("🚀 TELEMETRY API STARTED");

    try {
        console.log("🔍 Interview telemetry creation API called");

        console.log("🔍 ATTEMPTING getServerSession()");
        const session = await getServerSession(authOptions);
        console.log("🔍 Session result:", session);
        console.log("🔍 Session user:", session?.user);
        console.log("🔍 Session user ID:", (session?.user as any)?.id);

        if (!(session?.user as any)?.id) {
            console.log("❌ No user ID in session");
            console.log("❌ Session object:", JSON.stringify(session, null, 2));
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session!.user as any).id;
        console.log("✅ User ID:", userId);
        console.log("✅ Session validation PASSED");

        console.log("📋 PARSING REQUEST BODY");
        const { interviewSessionId } = await request.json();
        console.log("📋 Request data:", { interviewSessionId });
        console.log("📋 Interview session ID type:", typeof interviewSessionId);
        console.log(
            "📋 Interview session ID length:",
            interviewSessionId?.length
        );

        if (!interviewSessionId) {
            console.log("❌ Missing interviewSessionId");
            return NextResponse.json(
                { error: "Interview session ID is required" },
                { status: 400 }
            );
        }
        console.log("✅ Request parsing PASSED");

        // Verify the interview session exists and belongs to the user
        console.log("🔍 Verifying interview session...");
        console.log("Interview session ID:", interviewSessionId);
        console.log("User ID:", userId);

        // Check if telemetry data already exists for this session
        console.log("🔍 Checking for existing telemetry data...");
        console.log("🔍 Looking for interviewSessionId:", interviewSessionId);

        let existingTelemetry;
        try {
            existingTelemetry = await prisma.telemetryData.findUnique({
                where: {
                    interviewSessionId: interviewSessionId,
                },
            });
            console.log("🔍 findUnique result:", existingTelemetry);
        } catch (findError: any) {
            console.error("🔍 ERROR in findUnique:", findError);
            console.error("🔍 Find error details:", {
                name: findError?.name,
                message: findError?.message,
                code: findError?.code,
            });
            throw findError;
        }

        if (existingTelemetry) {
            console.log(
                "✅ Telemetry data already exists:",
                existingTelemetry.id
            );
            console.log("✅ Returning existing telemetry data");
            return NextResponse.json({
                message: "Telemetry data already exists",
                telemetryData: {
                    id: existingTelemetry.id,
                    matchScore: existingTelemetry.matchScore,
                    confidence: existingTelemetry.confidence,
                    story: existingTelemetry.story,
                },
            });
        }

        console.log(
            "✅ No existing telemetry found; creating zeroed telemetry"
        );

        let interviewSession;
        try {
            interviewSession = await prisma.interviewSession.findFirst({
                where: {
                    id: interviewSessionId,
                    candidateId: userId,
                },
            });
            console.log(
                "🔍 Interview session query completed, result:",
                interviewSession ? "Found" : "Not found"
            );
        } catch (sessionError: any) {
            console.error("❌ Error in interview session query:", sessionError);
            throw sessionError;
        }

        if (!interviewSession) {
            console.log(
                "❌ Interview session not found or doesn't belong to user"
            );
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        // Create zeroed telemetry + empty structures
        const created = await prisma.$transaction(async (tx) => {
            const telemetry = await tx.telemetryData.create({
                data: {
                    interviewSessionId,
                    matchScore: 0,
                    confidence: "Unknown",
                    story: "",
                    hasFairnessFlag: false,
                    persistenceFlow: [],
                    learningToAction: [],
                    confidenceCurve: [],
                } as any,
            });

            await tx.workstyleMetrics.create({
                data: {
                    telemetryDataId: telemetry.id,
                    iterationSpeed: 0,
                    debugLoops: 0,
                    refactorCleanups: 0,
                    aiAssistUsage: 0,
                },
            });

            await tx.gapAnalysis.create({
                data: {
                    telemetryDataId: telemetry.id,
                },
            });

            return telemetry;
        });

        return NextResponse.json({
            message: "Telemetry data created successfully",
            telemetryData: {
                id: created.id,
                matchScore: created.matchScore,
                confidence: created.confidence,
                story: created.story,
            },
        });
    } catch (error: any) {
        console.log("💥 CATCH BLOCK ENTERED");
        console.error("❌ Error creating telemetry data:", error);
        console.error("❌ Error details:", {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
        });

        // Return detailed error information for debugging
        return NextResponse.json(
            {
                error: "Failed to create telemetry data",
                details: {
                    name: error?.name,
                    message: error?.message,
                    stack: error?.stack,
                },
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }

    console.log("🏁 FUNCTION COMPLETELY FINISHED");
}
