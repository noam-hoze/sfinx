import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

export async function POST(request: NextRequest) {
    try {
        log.info(LOG_CATEGORY, "🔍 Interview session creation API called");

        const session = await getServerSession(authOptions);
        log.info(LOG_CATEGORY, "🔍 Session:", session ? "Found" : "Not found");

        const body = await request.json();
        const { applicationId, companyId, userId: requestUserId } = body;

        if (!(session?.user as any)?.id) {
            log.warn(LOG_CATEGORY, "❌ No user ID in session");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        const userId = (session!.user as any).id;
        log.info(LOG_CATEGORY, "✅ User ID from session:", userId);

        log.info(LOG_CATEGORY, "📋 Request data:", { applicationId, companyId });

        if (!applicationId) {
            log.warn(LOG_CATEGORY, "❌ Missing applicationId");
            return NextResponse.json(
                { error: "Application ID is required" },
                { status: 400 }
            );
        }

        // Verify the application exists and belongs to the user
        log.info(LOG_CATEGORY, "🔎 Verifying application exists & belongs to user", {
            applicationId,
            userId,
        });
        const application = await prisma.application.findFirst({
            where: {
                id: applicationId,
                candidateId: userId,
            },
        });

        if (!application) {
            log.warn(LOG_CATEGORY, "❌ Application not found or doesn't belong to user");
            return NextResponse.json(
                { error: "Application not found" },
                { status: 404 }
            );
        }
        log.info(LOG_CATEGORY, "✅ Application verified");

        // Create interview session AND zeroed telemetry in a single transaction
        log.info(LOG_CATEGORY, 
            "🚀 Creating interview session and zeroed telemetry (transaction)..."
        );
        let interviewSession; // for logging after transaction
        try {
            const txResult = await prisma.$transaction(async (tx) => {
                log.info(LOG_CATEGORY, "🧾 [TX] Creating InterviewSession...");
                const actualRecordingStartTime = new Date(); // Always use server time, never trust client-supplied timestamp
                log.info(LOG_CATEGORY, "📹 Using recording start time:", actualRecordingStartTime.toISOString());
                const interviewSession = await tx.interviewSession.create({
                    data: {
                        candidateId: userId,
                        applicationId: applicationId,
                        status: "IN_PROGRESS",
                        recordingStartedAt: actualRecordingStartTime, // Use actual MediaRecorder start time
                    },
                });
                log.info(LOG_CATEGORY, "✅ [TX] InterviewSession created", {
                    interviewSessionId: interviewSession.id,
                });

                log.info(LOG_CATEGORY, "🧾 [TX] Creating TelemetryData (zeroed)...");
                const telemetry = await tx.telemetryData.create({
                    data: {
                        interviewSessionId: interviewSession.id,
                        matchScore: 0,
                        confidence: "Unknown",
                        story: "",
                        hasFairnessFlag: false,
                    } as any,
                });
                log.info(LOG_CATEGORY, "✅ [TX] TelemetryData created", {
                    telemetryId: telemetry.id,
                });

                log.info(LOG_CATEGORY, 
                    "🧾 [TX] Creating WorkstyleMetrics (nullable baseline)..."
                );
                await tx.workstyleMetrics.create({
                    data: {
                        telemetryDataId: telemetry.id,
                        externalToolUsage: 0,
                    } as any,
                });
                log.info(LOG_CATEGORY, "✅ [TX] WorkstyleMetrics created for telemetry", {
                    telemetryId: telemetry.id,
                });

                log.info(LOG_CATEGORY, "🧾 [TX] Creating GapAnalysis (empty)...");
                await tx.gapAnalysis.create({
                    data: { telemetryDataId: telemetry.id },
                });
                log.info(LOG_CATEGORY, "✅ [TX] GapAnalysis created for telemetry", {
                    telemetryId: telemetry.id,
                });

                return { interviewSession };
            });
            interviewSession = txResult.interviewSession;
        } catch (txError: any) {
            log.error(LOG_CATEGORY, 
                "💥 Transaction failed while creating session/telemetry",
                {
                    name: txError?.name,
                    message: txError?.message,
                    code: txError?.code,
                    meta: txError?.meta,
                    stack: txError?.stack,
                }
            );
            throw txError; // handled by outer catch to return 500
        }

        log.info(LOG_CATEGORY, 
            "✅ Interview session and telemetry created:",
            interviewSession.id
        );

        return NextResponse.json({
            message: "Interview session created successfully",
            interviewSession,
        });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "❌ Error creating interview session:", error);
        log.error(LOG_CATEGORY, "❌ Error details:", {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
        });
        // Surface rich error details in non-prod to aid debugging
        const payload: any = { error: "Failed to create interview session" };
        if (process.env.NODE_ENV !== "production") {
            payload.details = {
                name: error?.name,
                message: error?.message,
                code: (error as any)?.code,
                meta: (error as any)?.meta,
                stack: error?.stack,
            };
        }
        return NextResponse.json(payload, { status: 500 });
    }
}
