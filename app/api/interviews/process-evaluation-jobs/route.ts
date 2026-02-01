import { NextRequest, NextResponse } from "next/server";
import prisma from "lib/prisma";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import OpenAI from "openai";
import { calculateScore, type RawScores, type WorkstyleMetrics } from "app/shared/utils/calculateScore";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

/**
 * Background worker endpoint that processes pending evaluation jobs.
 * Can be called by:
 * - Cron job (e.g., every 30 seconds)
 * - Manual trigger
 * - Vercel cron (@vercel/cron)
 */
export async function POST(request: NextRequest) {
    try {
        log.info(LOG_CATEGORY, "[Process Evaluation Jobs] Worker started");

        // Get batch size from query params (default 5)
        const url = new URL(request.url);
        const batchSize = parseInt(url.searchParams.get("batchSize") || "5", 10);

        // Find pending jobs, prioritized and oldest first
        const pendingJobs = await prisma.evaluationJob.findMany({
            where: {
                status: "PENDING",
                attempts: {
                    lt: prisma.evaluationJob.fields.maxAttempts,
                },
            },
            orderBy: [
                { priority: "desc" },
                { createdAt: "asc" },
            ],
            take: batchSize,
            include: {
                interviewSession: {
                    include: {
                        application: {
                            include: {
                                job: {
                                    include: {
                                        scoringConfiguration: true,
                                    },
                                },
                            },
                        },
                        telemetryData: {
                            include: {
                                backgroundSummary: true,
                                codingSummary: true,
                            },
                        },
                    },
                },
            },
        });

        if (pendingJobs.length === 0) {
            log.info(LOG_CATEGORY, "[Process Evaluation Jobs] No pending jobs found");
            return NextResponse.json({
                message: "No pending jobs",
                processed: 0,
            });
        }

        log.info(LOG_CATEGORY, `[Process Evaluation Jobs] Processing ${pendingJobs.length} jobs`);

        const results = [];

        // Process each job
        for (const job of pendingJobs) {
            try {
                // Mark as processing
                await prisma.evaluationJob.update({
                    where: { id: job.id },
                    data: {
                        status: "PROCESSING",
                        startedAt: new Date(),
                        attempts: job.attempts + 1,
                    },
                });

                log.info(LOG_CATEGORY, `[Process Evaluation Jobs] Processing job ${job.id} (${job.jobType}) for session ${job.interviewSessionId}`);

                // Process based on job type
                let result: any = null;

                switch (job.jobType) {
                    case "coding-gaps":
                        result = await processCodingGaps(job);
                        break;
                    case "coding-summary":
                        result = await processCodingSummary(job);
                        break;
                    case "code-quality-analysis":
                        result = await processCodeQualityAnalysis(job);
                        break;
                    case "job-specific-coding":
                        result = await processJobSpecificCoding(job);
                        break;
                    case "profile-story":
                        result = await processProfileStory(job);
                        break;
                    default:
                        throw new Error(`Unknown job type: ${job.jobType}`);
                }

                // Mark as completed
                await prisma.evaluationJob.update({
                    where: { id: job.id },
                    data: {
                        status: "COMPLETED",
                        completedAt: new Date(),
                        result,
                    },
                });

                log.info(LOG_CATEGORY, `[Process Evaluation Jobs] ✅ Completed job ${job.id} (${job.jobType})`);
                results.push({ jobId: job.id, jobType: job.jobType, status: "COMPLETED" });
            } catch (error: any) {
                log.error(LOG_CATEGORY, `[Process Evaluation Jobs] ❌ Failed job ${job.id} (${job.jobType}):`, error);

                // Mark as failed if max attempts reached, otherwise back to pending
                const shouldFail = job.attempts + 1 >= job.maxAttempts;

                await prisma.evaluationJob.update({
                    where: { id: job.id },
                    data: {
                        status: shouldFail ? "FAILED" : "PENDING",
                        error: error.message,
                        completedAt: shouldFail ? new Date() : null,
                    },
                });

                results.push({
                    jobId: job.id,
                    jobType: job.jobType,
                    status: shouldFail ? "FAILED" : "RETRY",
                    error: error.message,
                });
            }
        }

        // Check if all jobs for any session are complete
        const sessionIds = [...new Set(pendingJobs.map((j) => j.interviewSessionId))];
        for (const sessionId of sessionIds) {
            await checkAndUpdateSessionStatus(sessionId);
        }

        log.info(LOG_CATEGORY, `[Process Evaluation Jobs] Processed ${results.length} jobs`);

        return NextResponse.json({
            message: "Jobs processed",
            processed: results.length,
            results,
        });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[Process Evaluation Jobs] Worker error:", error);
        return NextResponse.json(
            {
                error: "Failed to process evaluation jobs",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

/**
 * Process coding gaps job
 */
async function processCodingGaps(job: any) {
    const { finalCode, codingTask, expectedSolution } = job.payload;
    const sessionId = job.interviewSessionId;

    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/interviews/generate-coding-gaps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sessionId,
            finalCode,
            codingTask,
            expectedSolution,
        }),
    });

    if (!response.ok) {
        throw new Error(`Coding gaps API failed: ${response.status}`);
    }

    return await response.json();
}

/**
 * Process coding summary job
 */
async function processCodingSummary(job: any) {
    const { finalCode, codingTask, expectedSolution } = job.payload;
    const sessionId = job.interviewSessionId;

    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/interviews/generate-coding-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sessionId,
            finalCode,
            codingTask,
            expectedSolution,
        }),
    });

    if (!response.ok) {
        throw new Error(`Coding summary API failed: ${response.status}`);
    }

    return await response.json();
}

/**
 * Process code quality analysis job
 */
async function processCodeQualityAnalysis(job: any) {
    const sessionId = job.interviewSessionId;

    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/interviews/session/${sessionId}/code-quality-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
        throw new Error(`Code quality analysis API failed: ${response.status}`);
    }

    return await response.json();
}

/**
 * Process job-specific coding evaluation job
 */
async function processJobSpecificCoding(job: any) {
    const { finalCode, codingTask, expectedSolution, categories } = job.payload;
    const sessionId = job.interviewSessionId;
    const session = job.interviewSession;

    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/interviews/evaluate-job-specific-coding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            finalCode,
            codingTask,
            categories,
            referenceCode: expectedSolution,
            expectedOutput: session.application.job.expectedOutput,
            sessionId,
        }),
    });

    if (!response.ok) {
        throw new Error(`Job-specific coding API failed: ${response.status}`);
    }

    const result = await response.json();

    // Update coding summary with job-specific categories
    const jobCategories = categories as Array<{ name: string; description: string; weight: number }>;
    const enrichedCategories: Record<string, any> = {};

    if (jobCategories) {
        Object.entries(result.categories || {}).forEach(([name, data]: [string, any]) => {
            const categoryDef = jobCategories.find((c: any) => c.name === name);
            enrichedCategories[name] = {
                ...data,
                description: categoryDef?.description || "",
            };
        });
    }

    const updateResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/interviews/session/${sessionId}/coding-summary-update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jobSpecificCategories: enrichedCategories,
        }),
    });

    if (!updateResponse.ok) {
        throw new Error(`Failed to update coding summary: ${updateResponse.status}`);
    }

    return result;
}

/**
 * Process profile story job
 */
async function processProfileStory(job: any) {
    const sessionId = job.interviewSessionId;

    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/interviews/generate-profile-story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
        throw new Error(`Profile story API failed: ${response.status}`);
    }

    return await response.json();
}

/**
 * Check if all evaluation jobs for a session are complete, and update session status
 */
async function checkAndUpdateSessionStatus(sessionId: string) {
    const jobs = await prisma.evaluationJob.findMany({
        where: { interviewSessionId: sessionId },
    });

    const allComplete = jobs.every((j) => j.status === "COMPLETED" || j.status === "FAILED");

    if (allComplete) {
        log.info(LOG_CATEGORY, `[Process Evaluation Jobs] All jobs complete for session ${sessionId}, updating status to COMPLETED`);

        await prisma.interviewSession.update({
            where: { id: sessionId },
            data: { status: "COMPLETED" },
        });
    }
}
