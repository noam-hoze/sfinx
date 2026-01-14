import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

/**
 * GET /api/interviews/session/[sessionId]/scoring-config
 * Fetch scoring configuration for the job associated with an interview session
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    try {
        const { sessionId } = await context.params;
        
        log.info(LOG_CATEGORY, "[Scoring Config GET] Fetching config for session:", sessionId);

        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
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
            },
        });

        if (!session) {
            return NextResponse.json(
                { error: "Session not found" },
                { status: 404 }
            );
        }

        if (!session.application?.job) {
            return NextResponse.json(
                { error: "Job not found for this session" },
                { status: 404 }
            );
        }

        const job = session.application.job;
        let config = job.scoringConfiguration;

        if (!config) {
            config = await prisma.scoringConfiguration.create({
                data: { jobId: job.id },
            });
            log.info(LOG_CATEGORY, `[Scoring Config GET] Created default config for job ${job.id}`);
        }

        return NextResponse.json({ config });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[Scoring Config GET] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch scoring configuration",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}
