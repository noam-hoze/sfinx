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

        // Fetch all real-time contributions for this session
        const allContributions = await prisma.categoryContribution.findMany({
            where: { interviewSessionId: sessionId },
            orderBy: { timestamp: "asc" }
        });

        log.info(`[Coding Summary Update] Found ${allContributions.length} real-time contributions`);

        // Group contributions by category
        const categoriesByName = new Map<string, any[]>();
        allContributions.forEach(contrib => {
            if (!categoriesByName.has(contrib.categoryName)) {
                categoriesByName.set(contrib.categoryName, []);
            }
            categoriesByName.get(contrib.categoryName)!.push(contrib);
        });

        // Calculate video offset helper
        const calculateVideoOffset = (timestamp: Date): number => {
            if (!session.recordingStartedAt) return 0;
            return Math.floor((timestamp.getTime() - session.recordingStartedAt.getTime()) / 1000);
        };

        // Target contributions for full confidence
        const TARGET_CONTRIBUTIONS = 5;

        // Merge real-time contributions with final evaluation categories
        const enrichedCategories: any = { ...jobSpecificCategories };

        for (const [categoryName, categoryData] of Object.entries(jobSpecificCategories as Record<string, any>)) {
            const contributions = categoriesByName.get(categoryName) || [];
            
            if (contributions.length > 0) {
                // Calculate raw average from contributions
                const scores = contributions.map(c => c.contributionStrength);
                const rawAverage = scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
                
                // Apply confidence multiplier based on sample size
                const confidence = Math.min(1.0, contributions.length / TARGET_CONTRIBUTIONS);
                const adjustedScore = Math.round(rawAverage * confidence);
                
                log.info(`[Coding Summary Update] ${categoryName}: ${contributions.length} contributions, raw avg=${Math.round(rawAverage)}, confidence=${confidence.toFixed(2)}, adjusted=${adjustedScore}`);
                
                // Use confidence-adjusted score from contributions
                enrichedCategories[categoryName] = {
                    ...categoryData,
                    score: adjustedScore,
                    rawAverage: Math.round(rawAverage),
                    contributionCount: contributions.length,
                    confidence: confidence,
                    evidenceLinks: contributions.map(c => calculateVideoOffset(c.timestamp)),
                    contributions: contributions.map(c => ({
                        timestamp: calculateVideoOffset(c.timestamp),
                        strength: c.contributionStrength,
                        explanation: c.explanation
                    }))
                };
            } else {
                // No real-time contributions - score should be 0
                enrichedCategories[categoryName] = {
                    ...categoryData,
                    score: 0,
                    evidenceLinks: [],
                    contributions: []
                };
                
                log.info(`[Coding Summary Update] ${categoryName}: No contributions, score set to 0`);
            }
        }

        // Update coding summary with enriched categories
        await prisma.codingSummary.update({
            where: { id: session.telemetryData.codingSummary.id },
            data: {
                jobSpecificCategories: enrichedCategories,
            },
        });

        log.info("[Coding Summary Update] Successfully updated job-specific categories with contribution data");

        return NextResponse.json({
            message: "Job-specific categories updated successfully",
            contributionsProcessed: allContributions.length,
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

