import { NextRequest, NextResponse } from "next/server";
import prisma from "lib/prisma";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

/**
 * Enqueues async evaluation jobs for an interview session.
 * This replaces the blocking sequential API calls with non-blocking job creation.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, finalCode, codingTask, expectedSolution } = body;

        if (!sessionId) {
            return NextResponse.json(
                { error: "Session ID is required" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[Enqueue Evaluation Jobs] Starting for session:", sessionId);

        // Verify session exists
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                application: {
                    include: {
                        job: true,
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

        // Delete any existing pending jobs for this session (in case of retry)
        await prisma.evaluationJob.deleteMany({
            where: {
                interviewSessionId: sessionId,
                status: "PENDING",
            },
        });

        // Create evaluation jobs with priorities (higher = run first)
        const jobsToCreate = [
            {
                interviewSessionId: sessionId,
                jobType: "coding-gaps",
                priority: 5,
                payload: {
                    finalCode,
                    codingTask,
                    expectedSolution,
                },
            },
            {
                interviewSessionId: sessionId,
                jobType: "coding-summary",
                priority: 10, // High priority - needed for final score
                payload: {
                    finalCode,
                    codingTask,
                    expectedSolution,
                },
            },
            {
                interviewSessionId: sessionId,
                jobType: "code-quality-analysis",
                priority: 4,
                payload: {},
            },
            {
                interviewSessionId: sessionId,
                jobType: "job-specific-coding",
                priority: 9, // High priority - needed for final score
                payload: {
                    finalCode,
                    codingTask,
                    expectedSolution,
                    categories: session.application.job.codingCategories || [],
                },
            },
            {
                interviewSessionId: sessionId,
                jobType: "profile-story",
                priority: 3, // Lower priority - can be generated later
                payload: {},
            },
        ];

        // Create all jobs in a transaction
        await prisma.$transaction(
            jobsToCreate.map((job) =>
                prisma.evaluationJob.create({
                    data: job,
                })
            )
        );

        // Update session status to indicate evaluations are pending
        await prisma.interviewSession.update({
            where: { id: sessionId },
            data: { status: "EVALUATING" },
        });

        log.info(LOG_CATEGORY, "[Enqueue Evaluation Jobs] Created", jobsToCreate.length, "jobs for session:", sessionId);

        return NextResponse.json({
            message: "Evaluation jobs enqueued successfully",
            jobCount: jobsToCreate.length,
            sessionId,
        });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[Enqueue Evaluation Jobs] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to enqueue evaluation jobs",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}
