import { NextRequest, NextResponse } from "next/server";
import prisma from "lib/prisma";
import { log } from "app/shared/services";

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

/**
 * GET: Fetch all category contributions for a session
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { sessionId } = await context.params;

        const contributions = await prisma.categoryContribution.findMany({
            where: { interviewSessionId: sessionId },
            orderBy: { timestamp: "desc" },
            take: 50, // Limit to most recent 50
        });

        // Group by category
        const byCategory: Record<string, typeof contributions> = {};
        contributions.forEach(contrib => {
            if (!byCategory[contrib.categoryName]) {
                byCategory[contrib.categoryName] = [];
            }
            byCategory[contrib.categoryName].push(contrib);
        });

        // Calculate stats per category
        const categoryStats = Object.entries(byCategory).map(([categoryName, contribs]) => ({
            categoryName,
            count: contribs.length,
            avgStrength: Math.round(
                contribs.reduce((sum, c) => sum + c.contributionStrength, 0) / contribs.length
            ),
            latestContribution: contribs[0],
        }));

        log.info(`[contributions/GET] Fetched ${contributions.length} contributions for session ${sessionId}`);

        return NextResponse.json({
            contributions,
            categoryStats,
            byCategory,
        });
    } catch (error: any) {
        log.error("[contributions/GET] Error fetching contributions:", error);
        return NextResponse.json(
            { error: "Failed to fetch contributions", details: error.message },
            { status: 500 }
        );
    }
}

