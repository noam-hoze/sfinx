import { NextRequest, NextResponse } from "next/server";
import { prisma } from "app/shared/services/prisma";
import { CHAPTER_TYPES } from "../../../shared/chapterTypes";
import { createVideoChapter } from "../../../shared/createVideoChapter";

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

export async function POST(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { sessionId } = await context.params;
        
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
                console.log(`✅ [Iterations API] First CORRECT solution at iteration ${iterationCount}`);
            }
        }

        // Create VideoChapter + VideoCaption for this iteration
        if (session?.recordingStartedAt && session?.telemetryData?.id && caption) {
            const iterationTimestamp = timestamp ? new Date(timestamp) : new Date();
            const videoOffset = Math.floor((iterationTimestamp.getTime() - session.recordingStartedAt.getTime()) / 1000);
            
            console.log("📹 [Iterations API] VideoChapter calculation:");
            console.log("  - Recording started at:", session.recordingStartedAt.toISOString());
            console.log("  - Iteration timestamp:", iterationTimestamp.toISOString());
            console.log("  - Calculated video offset (s):", videoOffset);
            console.log("  - Iteration count:", iterationCount);
            
            if (videoOffset >= 0) {
                await createVideoChapter({
                    telemetryDataId: session.telemetryData.id,
                    title: `${CHAPTER_TYPES.ITERATION} ${iterationCount}`,
                    startTime: videoOffset,
                    description: `Code execution: ${evaluation}`,
                    caption: caption,
                });
            } else {
                console.warn("⚠️ [Iterations API] Negative video offset, skipping VideoChapter creation");
            }
        }

        return NextResponse.json(iteration);
    } catch (error: any) {
        console.error("[iterations] Error creating iteration:", error);
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
    try {
        const { sessionId } = await context.params;

        const iterations = await prisma.iteration.findMany({
            where: { interviewSessionId: sessionId },
            orderBy: { timestamp: "asc" },
        });

        return NextResponse.json(iterations);
    } catch (error: any) {
        console.error("[iterations] Error fetching iterations:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch iterations",
                details: error?.message || "Unknown error",
            },
            { status: 500 }
        );
    }
}

