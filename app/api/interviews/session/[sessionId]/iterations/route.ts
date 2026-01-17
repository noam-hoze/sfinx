import { NextRequest, NextResponse } from "next/server";
import { prisma } from "app/shared/services/prisma";
import { CHAPTER_TYPES } from "../../../shared/chapterTypes";
import { createVideoChapter } from "../../../shared/createVideoChapter";
import { log } from "app/shared/services";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

export async function POST(
    request: NextRequest,
    context: RouteContext
) {
    const requestId = request.headers.get("x-request-id");
    let sessionId: string | undefined;
    try {
        const params = await context.params;
        sessionId = params.sessionId;
        
        const {
            timestamp,
            codeSnapshot,
            actualOutput,
            expectedOutput,
            evaluation,
            reasoning,
            matchPercentage,
            caption,
        } = await request.json();

        if (!sessionId || !codeSnapshot || !actualOutput || !expectedOutput) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        // Map evaluation string to enum
        const evaluationEnum =
            evaluation === "correct"
                ? "CORRECT"
                : evaluation === "partial"
                ? "PARTIAL"
                : "INCORRECT";

        const iteration = await prisma.iteration.create({
            data: {
                interviewSessionId: sessionId,
                timestamp: timestamp ? new Date(timestamp) : new Date(),
                codeSnapshot,
                actualOutput,
                expectedOutput,
                evaluation: evaluationEnum,
                reasoning: reasoning || "",
                matchPercentage: matchPercentage || 0,
                caption: caption || "",
            },
        });

        // Update WorkstyleMetrics with iteration count
        const iterationCount = await prisma.iteration.count({
            where: { interviewSessionId: sessionId },
        });

        // Find the WorkstyleMetrics for this session
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                telemetryData: {
                    include: {
                        workstyleMetrics: true,
                    },
                },
            },
        });

        if (session?.telemetryData?.workstyleMetrics) {
            // Only update iterationSpeed on first CORRECT iteration (iterations until success)
            const currentIterationSpeed = session.telemetryData.workstyleMetrics.iterationSpeed;
            
            if (currentIterationSpeed === null && evaluationEnum === "CORRECT") {
                // First correct solution - record how many iterations it took
                await prisma.workstyleMetrics.update({
                    where: { id: session.telemetryData.workstyleMetrics.id },
                    data: { iterationSpeed: iterationCount },
                });
                log.info(LOG_CATEGORY, "[Iterations API] First CORRECT solution", {
                    requestId,
                    sessionId,
                    iterationCount,
                });
            }
        }

        // Create evidence clips for Problem Solving category
        if (session?.recordingStartedAt && session?.telemetryData?.id) {
            const iterationTimestamp = timestamp ? new Date(timestamp) : new Date();
            const videoOffset = Math.floor((iterationTimestamp.getTime() - session.recordingStartedAt.getTime()) / 1000);
            
            log.info(LOG_CATEGORY, "[Iterations API] Creating evidence for iteration", {
                requestId,
                sessionId,
                recordingStartedAt: session.recordingStartedAt.toISOString(),
                iterationTimestamp: iterationTimestamp.toISOString(),
                videoOffset,
                iterationCount
            });
            
            if (videoOffset >= 0) {
                // Create CategoryContribution for Output
                await prisma.categoryContribution.create({
                    data: {
                        interviewSessionId: sessionId,
                        categoryName: "Output",
                        timestamp: iterationTimestamp,
                        codeChange: `Iteration ${iterationCount}: ${evaluation} (${matchPercentage}% match)`,
                        explanation: reasoning || `Code execution: ${evaluation}`,
                        contributionStrength: matchPercentage || 0,
                        caption: caption || `Iteration ${iterationCount}`,
                    },
                });

                // Create EvidenceClip - linked to Problem Solving category
                await prisma.evidenceClip.create({
                    data: {
                        telemetryData: {
                            connect: { id: session.telemetryData.id }
                        },
                        category: "JOB_SPECIFIC_CATEGORY",
                        categoryName: "Problem Solving",
                        title: `Output Check ${iterationCount}`,
                        description: reasoning || `Code execution: ${evaluation}`,
                        startTime: videoOffset,
                        duration: 15,
                        contributionStrength: matchPercentage || 0,
                        thumbnailUrl: null,
                    },
                });

                // Create VideoChapter
                if (caption) {
                    await createVideoChapter({
                        telemetryDataId: session.telemetryData.id,
                        title: `${CHAPTER_TYPES.ITERATION} ${iterationCount}`,
                        startTime: videoOffset,
                        description: `Code execution: ${evaluation}`,
                        caption: caption,
                    });
                }
                
                log.info(LOG_CATEGORY, "[Iterations API] Created evidence clips for iteration", {
                    requestId,
                    sessionId,
                    videoOffset,
                    iterationCount,
                });
            } else {
                log.warn(LOG_CATEGORY, "[Iterations API] Negative video offset, skipping evidence creation", {
                    requestId,
                    sessionId,
                    videoOffset,
                    iterationCount,
                });
            }
        }

        return NextResponse.json(iteration);
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[iterations] Error creating iteration", {
            requestId,
            sessionId,
            errorMessage: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            {
                error: "Failed to create iteration",
                details: error?.message || "Unknown error",
            },
            { status: 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    context: RouteContext
) {
    const requestId = request.headers.get("x-request-id");
    let sessionId: string | undefined;
    try {
        const params = await context.params;
        sessionId = params.sessionId;

        const iterations = await prisma.iteration.findMany({
            where: { interviewSessionId: sessionId },
            orderBy: { timestamp: "asc" },
        });

        log.debug(LOG_CATEGORY, "[iterations] Iterations fetched", {
            requestId,
            sessionId,
            iterationCount: iterations.length,
        });
        return NextResponse.json(iterations);
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[iterations] Error fetching iterations", {
            requestId,
            sessionId,
            errorMessage: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            {
                error: "Failed to fetch iterations",
                details: error?.message || "Unknown error",
            },
            { status: 500 }
        );
    }
}
