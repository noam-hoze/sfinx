import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

const LOG_CATEGORY = "interviews";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;

        log.info(LOG_CATEGORY, "[Coding Summary API] Fetching summary for session:", sessionId);

        // Get session with telemetry data and coding summary
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

        if (!session) {
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 }
            );
        }

        if (!session.telemetryData?.codingSummary) {
            return NextResponse.json(
                { error: "Coding summary not found for this session" },
                { status: 404 }
            );
        }

        const codingSummary = session.telemetryData.codingSummary;

        // Format response to match expected structure
        const response = {
            summary: {
                executiveSummary: codingSummary.executiveSummary,
                recommendation: codingSummary.recommendation,
                codeQuality: {
                    score: codingSummary.codeQualityScore,
                    text: codingSummary.codeQualityText,
                },
                independence: {
                    score: codingSummary.independenceScore,
                    text: codingSummary.independenceText,
                },
                jobSpecificCategories: codingSummary.jobSpecificCategories as Record<string, { score: number; text: string }> | null,
            },
        };

        return NextResponse.json(response);
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[Coding Summary API] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch coding summary",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

