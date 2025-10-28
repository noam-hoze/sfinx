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

export async function POST(request: NextRequest) {
    log.info("🚀 TELEMETRY API STARTED");

    try {
        log.info("🔍 Interview telemetry creation API called");

        log.info("🔍 ATTEMPTING getServerSession()");
        const session = await getServerSession(authOptions);
        log.info("🔍 Session result:", session);
        log.info("🔍 Session user:", session?.user);
        log.info("🔍 Session user ID:", (session?.user as any)?.id);

        if (!(session?.user as any)?.id) {
            log.warn("❌ No user ID in session");
            log.info("❌ Session object:", JSON.stringify(session, null, 2));
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session!.user as any).id;
        log.info("✅ User ID:", userId);
        log.info("✅ Session validation PASSED");

        log.info("📋 PARSING REQUEST BODY");
        const { interviewSessionId } = await request.json();
        log.info("📋 Request data:", { interviewSessionId });
        log.info("📋 Interview session ID type:", typeof interviewSessionId);
        log.info("📋 Interview session ID length:", interviewSessionId?.length);

        if (!interviewSessionId) {
            log.warn("❌ Missing interviewSessionId");
            return NextResponse.json(
                { error: "Interview session ID is required" },
                { status: 400 }
            );
        }
        log.info("✅ Request parsing PASSED");

        // Verify the interview session exists and belongs to the user
        log.info("🔍 Verifying interview session...");
        log.info("Interview session ID:", interviewSessionId);
        log.info("User ID:", userId);

        // Check if telemetry data already exists for this session
        log.info("🔍 Checking for existing telemetry data...");
        log.info("🔍 Looking for interviewSessionId:", interviewSessionId);

        let existingTelemetry;
        try {
            existingTelemetry = await prisma.telemetryData.findUnique({
                where: {
                    interviewSessionId: interviewSessionId,
                },
            });
            log.info("🔍 findUnique result:", existingTelemetry);
        } catch (findError: any) {
            log.error("🔍 ERROR in findUnique:", findError);
            log.error("🔍 Find error details:", {
                name: findError?.name,
                message: findError?.message,
                code: findError?.code,
            });
            throw findError;
        }

        if (existingTelemetry) {
            log.info("✅ Telemetry data already exists:", existingTelemetry.id);
            log.info("✅ Returning existing telemetry data");
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

        log.info("✅ No existing telemetry found; creating zeroed telemetry");

        let interviewSession;
        try {
            interviewSession = await prisma.interviewSession.findFirst({
                where: {
                    id: interviewSessionId,
                    candidateId: userId,
                },
            });
            log.info(
                "🔍 Interview session query completed, result:",
                interviewSession ? "Found" : "Not found"
            );
        } catch (sessionError: any) {
            log.error("❌ Error in interview session query:", sessionError);
            throw sessionError;
        }

        if (!interviewSession) {
            log.warn("❌ Interview session not found or doesn't belong to user");
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
                } as any,
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
        log.info("💥 CATCH BLOCK ENTERED");
        log.error("❌ Error creating telemetry data:", error);
        log.error("❌ Error details:", {
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

    log.info("🏁 FUNCTION COMPLETELY FINISHED");
}
