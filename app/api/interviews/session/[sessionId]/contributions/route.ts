import { NextRequest, NextResponse } from "next/server";
import prisma from "lib/prisma";
import { log } from "app/shared/services";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

/**
 * GET: Fetch all category contributions for a session
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { sessionId } = await context.params;

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
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const jobCategories = (session.application.job.experienceCategories as any[]) || [];

        const contributions = await prisma.categoryContribution.findMany({
            where: { interviewSessionId: sessionId },
            orderBy: { timestamp: "desc" },
            take: 50,
        });

        const byCategory: Record<string, typeof contributions> = {};
        contributions.forEach(contrib => {
            if (!byCategory[contrib.categoryName]) {
                byCategory[contrib.categoryName] = [];
            }
            byCategory[contrib.categoryName].push(contrib);
        });

        const TARGET_CONTRIBUTIONS = 5;
        
        const categoryStats = jobCategories.map(category => {
            const contribs = byCategory[category.name] || [];
            const rawAverage = contribs.length > 0
                ? contribs.reduce((sum, c) => sum + c.contributionStrength, 0) / contribs.length
                : 0;
            const confidence = Math.min(1.0, contribs.length / TARGET_CONTRIBUTIONS);
            const adjustedScore = Math.round(rawAverage * confidence);
            
            return {
                categoryName: category.name,
                count: contribs.length,
                avgStrength: adjustedScore,
                rawAverage: Math.round(rawAverage),
                confidence: confidence,
                targetContributions: TARGET_CONTRIBUTIONS,
                latestContribution: contribs[0] || null,
            };
        });

        log.info(LOG_CATEGORY, `[contributions/GET] Fetched ${contributions.length} contributions for ${jobCategories.length} categories`);

        return NextResponse.json({
            contributions,
            categoryStats,
            byCategory,
        });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[contributions/GET] Error fetching contributions:", error);
        return NextResponse.json(
            { error: "Failed to fetch contributions", details: error.message },
            { status: 500 }
        );
    }
}

