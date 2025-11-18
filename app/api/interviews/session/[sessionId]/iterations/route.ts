import { NextRequest, NextResponse } from "next/server";
import { prisma } from "app/shared/services/prisma";

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
            await prisma.workstyleMetrics.update({
                where: { id: session.telemetryData.workstyleMetrics.id },
                data: { iterationSpeed: iterationCount },
            });
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
                // If first iteration, create "Problem Presentation" chapter
                if (iterationCount === 1) {
                    const problemPresentationChapter = await prisma.videoChapter.create({
                        data: {
                            telemetryDataId: session.telemetryData.id,
                            title: "Problem Presentation",
                            startTime: 0,
                            endTime: videoOffset,
                            description: "Initial problem setup and understanding",
                            thumbnailUrl: null,
                        },
                    });
                    console.log("✅ [Iterations API] Problem Presentation chapter created:", {
                        id: problemPresentationChapter.id,
                        title: problemPresentationChapter.title,
                        startTime: problemPresentationChapter.startTime,
                        endTime: problemPresentationChapter.endTime,
                    });
                } else {
                    // Update previous iteration's endTime to current startTime
                    const previousIterationChapter = await prisma.videoChapter.findFirst({
                        where: {
                            telemetryDataId: session.telemetryData.id,
                            title: `Iteration ${iterationCount - 1}`,
                        },
                    });
                    
                    if (previousIterationChapter) {
                        await prisma.videoChapter.update({
                            where: { id: previousIterationChapter.id },
                            data: { endTime: videoOffset },
                        });
                        console.log(`✅ [Iterations API] Updated Iteration ${iterationCount - 1} endTime to:`, videoOffset);
                    }
                }

                // Create current iteration chapter (endTime will be updated by next iteration or left as large number)
                const videoChapter = await prisma.videoChapter.create({
                    data: {
                        telemetryDataId: session.telemetryData.id,
                        title: `Iteration ${iterationCount}`,
                        startTime: videoOffset,
                        endTime: 999999, // Placeholder, will be updated by next iteration or video end
                        description: `Code execution: ${evaluation}`,
                        thumbnailUrl: null,
                    },
                });

                console.log("✅ [Iterations API] VideoChapter created:", {
                    id: videoChapter.id,
                    title: videoChapter.title,
                    startTime: videoChapter.startTime,
                    endTime: videoChapter.endTime,
                });

                await prisma.videoCaption.create({
                    data: {
                        videoChapterId: videoChapter.id,
                        text: caption,
                        startTime: videoOffset,
                        endTime: 999999, // Same placeholder
                    },
                });

                // Log all chapters to debug race conditions
                const allChapters = await prisma.videoChapter.findMany({
                    where: { telemetryDataId: session.telemetryData.id },
                    orderBy: { startTime: 'asc' }
                });
                console.log("📋 [Iterations API] All chapters after creation:", allChapters.map(c => ({ 
                    title: c.title, 
                    start: c.startTime, 
                    end: c.endTime 
                })));
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

