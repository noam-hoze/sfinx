import { NextRequest, NextResponse } from "next/server";
import prisma from "lib/prisma";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

/**
 * Get evaluation status for an interview session.
 * Returns overall status and individual job statuses.
 */
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("sessionId");

        if (!sessionId) {
            return NextResponse.json(
                { error: "Session ID is required" },
                { status: 400 }
            );
        }

        // Get session with evaluation jobs
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            select: {
                id: true,
                status: true,
                evaluationJobs: {
                    select: {
                        id: true,
                        jobType: true,
                        status: true,
                        priority: true,
                        attempts: true,
                        error: true,
                        createdAt: true,
                        startedAt: true,
                        completedAt: true,
                    },
                    orderBy: {
                        priority: "desc",
                    },
                },
            },
        });

        if (!session) {
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 }
            );
        }

        // Calculate overall progress
        const jobs = session.evaluationJobs;
        const totalJobs = jobs.length;
        const completedJobs = jobs.filter((j) => j.status === "COMPLETED").length;
        const failedJobs = jobs.filter((j) => j.status === "FAILED").length;
        const pendingJobs = jobs.filter((j) => j.status === "PENDING").length;
        const processingJobs = jobs.filter((j) => j.status === "PROCESSING").length;

        const overallStatus = session.status;
        const progress = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

        return NextResponse.json({
            sessionId: session.id,
            overallStatus,
            progress,
            stats: {
                total: totalJobs,
                completed: completedJobs,
                failed: failedJobs,
                pending: pendingJobs,
                processing: processingJobs,
            },
            jobs: jobs.map((job) => ({
                id: job.id,
                type: job.jobType,
                status: job.status,
                priority: job.priority,
                attempts: job.attempts,
                error: job.error,
                createdAt: job.createdAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
            })),
        });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[Evaluation Status] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to get evaluation status",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}
