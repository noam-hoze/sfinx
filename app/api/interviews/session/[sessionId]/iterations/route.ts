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
            
            if (videoOffset >= 0) {
                const videoChapter = await prisma.videoChapter.create({
                    data: {
                        telemetryDataId: session.telemetryData.id,
                        title: `Iteration ${iterationCount}`,
                        startTime: videoOffset,
                        endTime: videoOffset + 3,
                        description: `Code execution: ${evaluation}`,
                        thumbnailUrl: null,
                    },
                });

                await prisma.videoCaption.create({
                    data: {
                        videoChapterId: videoChapter.id,
                        text: caption,
                        startTime: videoOffset,
                        endTime: videoOffset + 3,
                    },
                });
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

