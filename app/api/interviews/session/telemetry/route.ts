import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

const LOG_CATEGORY = "interviews";

export async function POST(request: NextRequest) {
    log.info(LOG_CATEGORY, "🚀 TELEMETRY API STARTED");

    try {
        log.info(LOG_CATEGORY, "Interview telemetry creation API called");

        log.info(LOG_CATEGORY, "Attempting getServerSession()");
        const session = await getServerSession(authOptions);
        log.info(LOG_CATEGORY, "Session result:", session);
        log.info(LOG_CATEGORY, "Session user:", session?.user);
        log.info(LOG_CATEGORY, "Session user ID:", (session?.user as any)?.id);

        if (!(session?.user as any)?.id) {
            log.warn(LOG_CATEGORY, "❌ No user ID in session");
            log.info(LOG_CATEGORY, "❌ Session object:", JSON.stringify(session, null, 2));
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session!.user as any).id;
        log.info(LOG_CATEGORY, "User ID:", userId);
        log.info(LOG_CATEGORY, "Session validation passed");

        log.info(LOG_CATEGORY, "Parsing request body");
        const { interviewSessionId } = await request.json();
        log.info(LOG_CATEGORY, "Request data:", { interviewSessionId });
        log.info(LOG_CATEGORY, "Interview session ID type:", typeof interviewSessionId);
        log.info(LOG_CATEGORY, "Interview session ID length:", interviewSessionId?.length);

        if (!interviewSessionId) {
            log.warn(LOG_CATEGORY, "❌ Missing interviewSessionId");
            return NextResponse.json(
                { error: "Interview session ID is required" },
                { status: 400 }
            );
        }
        log.info(LOG_CATEGORY, "Request parsing passed");

        // Verify the interview session exists and belongs to the user
        log.info(LOG_CATEGORY, "Verifying interview session...");
        log.info(LOG_CATEGORY, "Interview session ID:", interviewSessionId);
        log.info(LOG_CATEGORY, "User ID:", userId);

        // Check if telemetry data already exists for this session
        log.info(LOG_CATEGORY, "Checking for existing telemetry data...");
        log.info(LOG_CATEGORY, "Looking for interviewSessionId:", interviewSessionId);

        let existingTelemetry;
        try {
            existingTelemetry = await prisma.telemetryData.findUnique({
                where: {
                    interviewSessionId: interviewSessionId,
                },
            });
            log.info(LOG_CATEGORY, "findUnique result:", existingTelemetry);
        } catch (findError: any) {
            log.error(LOG_CATEGORY, "Error in findUnique:", findError);
            log.error(LOG_CATEGORY, "Find error details:", {
                name: findError?.name,
                message: findError?.message,
                code: findError?.code,
            });
            throw findError;
        }

        if (existingTelemetry) {
        log.info(LOG_CATEGORY, "Telemetry data already exists:", existingTelemetry.id);
        log.info(LOG_CATEGORY, "Returning existing telemetry data");
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

        log.info(LOG_CATEGORY, "No existing telemetry found; creating zeroed telemetry");

        let interviewSession;
        try {
            interviewSession = await prisma.interviewSession.findFirst({
                where: {
                    id: interviewSessionId,
                    candidateId: userId,
                },
            });
            log.info(LOG_CATEGORY, 
                "Interview session query completed, result:",
                interviewSession ? "Found" : "Not found"
            );
        } catch (sessionError: any) {
            log.error(LOG_CATEGORY, "❌ Error in interview session query:", sessionError);
            throw sessionError;
        }

        if (!interviewSession) {
            log.warn(LOG_CATEGORY, "❌ Interview session not found or doesn't belong to user");
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
                    externalToolUsage: 0,
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
        log.info(LOG_CATEGORY, "Catch block entered");
        log.error(LOG_CATEGORY, "❌ Error creating telemetry data:", error);
        log.error(LOG_CATEGORY, "❌ Error details:", {
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

    log.info(LOG_CATEGORY, "Function completed");
}
