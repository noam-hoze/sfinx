import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

export async function PATCH(
    request: NextRequest,
    { params }: { params: { sessionId: string } }
) {
    try {
        const { sessionId } = params;
        const body = await request.json();
        const { jobSpecificCategories } = body;

        if (!jobSpecificCategories) {
            return NextResponse.json(
                { error: "jobSpecificCategories is required" },
                { status: 400 }
            );
        }

        log.info("[Coding Summary Update] Updating job-specific categories for session:", sessionId);

        // Find coding summary via session
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                telemetryData: {
                    include: {
                        codingSummary: true,
                    },
                },
            },
        });

        if (!session?.telemetryData?.codingSummary) {
            return NextResponse.json(
                { error: "Coding summary not found for session" },
                { status: 404 }
            );
        }

        // Update coding summary with job-specific categories
        await prisma.codingSummary.update({
            where: { id: session.telemetryData.codingSummary.id },
            data: {
                jobSpecificCategories: jobSpecificCategories,
            },
        });

        log.info("[Coding Summary Update] Successfully updated job-specific categories");

        return NextResponse.json({
            message: "Job-specific categories updated successfully",
        });
    } catch (error: any) {
        log.error("[Coding Summary Update] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to update coding summary",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

