import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

/**
 * POST /api/interviews/warmup
 * Pre-creates shell Application + InterviewSession + TelemetryData + WorkstyleMetrics + GapAnalysis
 * at login time, before the candidate selects a specific job.
 * These records are later activated with real job data via PATCH /api/interviews/warmup/activate.
 */
export async function POST(request: NextRequest) {
    try {
        log.info(LOG_CATEGORY, "[warmup] Shell record creation API called");

        const session = await getServerSession(authOptions);
        if (!(session?.user as any)?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session.user as any).id;
        log.info(LOG_CATEGORY, "[warmup] User ID:", userId);

        // Step 1: Delete any existing WARMUP applications for this user (cleanup old shells)
        const deleted = await prisma.application.deleteMany({
            where: {
                candidateId: userId,
                status: "WARMUP",
            },
        });
        if (deleted.count > 0) {
            log.info(LOG_CATEGORY, `[warmup] Cleaned up ${deleted.count} old WARMUP application(s)`);
        }

        // Step 2: Create shell records in a single transaction
        const txResult = await prisma.$transaction(async (tx) => {
            // Create shell Application (no jobId)
            const application = await tx.application.create({
                data: {
                    candidateId: userId,
                    status: "WARMUP",
                    // jobId is null — will be set when user selects a job
                },
            });
            log.info(LOG_CATEGORY, "[warmup] Shell Application created:", application.id);

            // Create shell InterviewSession
            const interviewSession = await tx.interviewSession.create({
                data: {
                    candidateId: userId,
                    applicationId: application.id,
                    status: "WARMUP",
                },
            });
            log.info(LOG_CATEGORY, "[warmup] Shell InterviewSession created:", interviewSession.id);

            // Create zeroed TelemetryData
            const telemetry = await tx.telemetryData.create({
                data: {
                    interviewSessionId: interviewSession.id,
                    matchScore: 0,
                    confidence: "Unknown",
                    story: "",
                    hasFairnessFlag: false,
                } as any,
            });
            log.info(LOG_CATEGORY, "[warmup] Shell TelemetryData created:", telemetry.id);

            // Create zeroed WorkstyleMetrics
            await tx.workstyleMetrics.create({
                data: {
                    telemetryDataId: telemetry.id,
                    externalToolUsage: 0,
                } as any,
            });

            // Create empty GapAnalysis
            await tx.gapAnalysis.create({
                data: { telemetryDataId: telemetry.id },
            });

            return { application, interviewSession };
        });

        log.info(LOG_CATEGORY, "[warmup] Shell records created successfully:", {
            applicationId: txResult.application.id,
            sessionId: txResult.interviewSession.id,
        });

        return NextResponse.json({
            applicationId: txResult.application.id,
            sessionId: txResult.interviewSession.id,
        });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[warmup] Error creating shell records:", error);
        return NextResponse.json(
            { error: "Failed to create warmup records" },
            { status: 500 }
        );
    }
}
