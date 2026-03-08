import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import { invalidatePattern } from "app/shared/services/server";
import prisma from "lib/prisma";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

/**
 * PATCH /api/interviews/warmup/activate
 * Activates a pre-created shell Application with real job data.
 * Called when the candidate selects a specific job/company interview.
 */
export async function PATCH(request: NextRequest) {
    try {
        log.info(LOG_CATEGORY, "[warmup/activate] Activation API called");

        const session = await getServerSession(authOptions);
        if (!(session?.user as any)?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session.user as any).id;
        const body = await request.json();
        const { applicationId, companyId, jobId } = body;

        if (!applicationId || !companyId || !jobId) {
            return NextResponse.json(
                { error: "applicationId, companyId, and jobId are required" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[warmup/activate] Request:", { applicationId, companyId, jobId });

        // Verify company exists
        const company = await prisma.company.findUnique({
            where: { id: companyId },
        });
        if (!company) {
            return NextResponse.json(
                { error: "Company not found" },
                { status: 404 }
            );
        }

        // Verify job exists and belongs to company
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job || job.companyId !== company.id) {
            return NextResponse.json(
                { error: "Job not found for this company" },
                { status: 404 }
            );
        }

        // Check if user already has an active (non-WARMUP) application for this job
        const existingApp = await prisma.application.findFirst({
            where: {
                candidateId: userId,
                jobId: job.id,
                status: { not: "WARMUP" },
            },
            include: {
                interviewSessions: {
                    where: { status: { not: "WARMUP" } },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
        });

        if (existingApp) {
            log.info(LOG_CATEGORY, "[warmup/activate] Existing application found, creating new session");

            await prisma.application.delete({
                where: { id: applicationId },
            }).catch(() => {});

            const newSession = await prisma.$transaction(async (tx) => {
                const session = await tx.interviewSession.create({
                    data: {
                        candidateId: userId,
                        applicationId: existingApp.id,
                        status: "IN_PROGRESS",
                    },
                });
                const telemetry = await tx.telemetryData.create({
                    data: {
                        interviewSessionId: session.id,
                        matchScore: 0, confidence: "Unknown", story: "",
                        hasFairnessFlag: false,
                    } as any,
                });
                await tx.workstyleMetrics.create({
                    data: { telemetryDataId: telemetry.id, externalToolUsage: 0 } as any,
                });
                await tx.gapAnalysis.create({
                    data: { telemetryDataId: telemetry.id },
                });
                return session;
            });

            log.info(LOG_CATEGORY, "[warmup/activate] New session created:", newSession.id);
            invalidatePattern(`candidate-dashboard:${userId}`);

            return NextResponse.json({
                application: existingApp,
                sessionId: newSession.id,
                reused: false,
            });
        }

        // Activate the shell: update Application with job data and InterviewSession status
        const txResult = await prisma.$transaction(async (tx) => {
            const updatedApp = await tx.application.update({
                where: { id: applicationId, candidateId: userId, status: "WARMUP" },
                data: {
                    jobId: job.id,
                    status: "PENDING",
                },
            });

            // Activate the most recent WARMUP session for this application
            const warmupSession = await tx.interviewSession.findFirst({
                where: {
                    applicationId: applicationId,
                    candidateId: userId,
                    status: "WARMUP",
                },
                orderBy: { createdAt: "desc" },
            });

            let sessionId: string | null = null;
            if (warmupSession) {
                await tx.interviewSession.update({
                    where: { id: warmupSession.id },
                    data: { status: "IN_PROGRESS" },
                });
                sessionId = warmupSession.id;
            }

            return { application: updatedApp, sessionId };
        });

        log.info(LOG_CATEGORY, "[warmup/activate] Shell activated:", {
            applicationId: txResult.application.id,
            sessionId: txResult.sessionId,
        });
        invalidatePattern(`candidate-dashboard:${userId}`);

        return NextResponse.json({
            application: txResult.application,
            sessionId: txResult.sessionId,
            reused: false,
        });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[warmup/activate] Error:", error);

        // If the warmup record was already activated or deleted, return a specific error
        if (error?.code === "P2025") {
            return NextResponse.json(
                { error: "Warmup record not found or already activated" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { error: "Failed to activate warmup" },
            { status: 500 }
        );
    }
}
