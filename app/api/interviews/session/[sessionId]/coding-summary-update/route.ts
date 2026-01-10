import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import { calculateScore, type RawScores, type WorkstyleMetrics } from "app/shared/utils/calculateScore";

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
                        backgroundSummary: true,
                    },
                },
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
                
                log.info(`[Coding Summary Update] ${categoryName}: ${contributions.length} contributions, raw avg=${Math.round(rawAverage)}, confidence=${confidence.toFixed(2)}, adjusted=${adjustedScore}, final override=${categoryData.score}`);
                
                // Use final evaluation score (overrides contribution-adjusted score)
                enrichedCategories[categoryName] = {
                    ...categoryData,
                    score: categoryData.score,
                    rawAverage: Math.round(rawAverage),
                    contributionCount: contributions.length,
                    confidence: confidence,
                    evidenceLinks: contributions.map(c => ({
                        timestamp: calculateVideoOffset(c.timestamp),
                        caption: c.caption
                    })),
                    contributions: contributions.map(c => ({
                        timestamp: calculateVideoOffset(c.timestamp),
                        strength: c.contributionStrength,
                        explanation: c.explanation
                    }))
                };
            } else {
                // No real-time contributions - use final evaluation score
                enrichedCategories[categoryName] = {
                    ...categoryData,
                    score: categoryData.score,
                    evidenceLinks: [],
                    contributions: []
                };
                
                log.info(`[Coding Summary Update] ${categoryName}: No contributions, using final evaluation score=${categoryData.score}`);
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

        // Calculate and persist final score
        let finalScore: number | null = null;
        if (session.telemetryData?.backgroundSummary && session.application.job.scoringConfiguration) {
            try {
                const job = session.application.job;
                const jobExperienceCategories = (job.experienceCategories as any) || [];
                const backgroundExperienceCategories = (session.telemetryData.backgroundSummary.experienceCategories as any) || {};
                const experienceScores = jobExperienceCategories.map((cat: any) => ({
                    name: cat.name,
                    score: backgroundExperienceCategories[cat.name]?.score || 0,
                    weight: cat.weight || 1
                }));

                const jobCodingCategories = (job.codingCategories as any) || [];
                const categoryScores = jobCodingCategories.map((cat: any) => {
                    // Match by base name (before any parentheses)
                    const baseName = cat.name.split(' (')[0];
                    const matchingKey = Object.keys(enrichedCategories).find(key => 
                        key.startsWith(baseName) || cat.name.startsWith(key)
                    ) || cat.name;
                    
                    return {
                        name: cat.name,
                        score: enrichedCategories[matchingKey]?.score || 0,
                        weight: cat.weight || 1
                    };
                });

                const rawScores: RawScores = { experienceScores, categoryScores };
                
                // Get External Tools accountability score if available
                const externalToolUsages = await prisma.externalToolUsage.findMany({
                    where: { interviewSessionId: sessionId },
                    select: { accountabilityScore: true }
                });
                
                const avgAccountabilityScore = externalToolUsages.length > 0
                    ? externalToolUsages.reduce((sum, usage) => sum + usage.accountabilityScore, 0) / externalToolUsages.length
                    : undefined;
                
                const workstyleMetrics: WorkstyleMetrics = { 
                    aiAssistAccountabilityScore: avgAccountabilityScore
                };

                const result = calculateScore(rawScores, workstyleMetrics, job.scoringConfiguration as any);
                finalScore = Math.round(result.finalScore);

                await prisma.interviewSession.update({
                    where: { id: sessionId },
                    data: { finalScore },
                });

                log.info(`[Coding Summary Update] Calculated and saved finalScore=${finalScore} for session ${sessionId}`);
            } catch (error) {
                log.error("[Coding Summary Update] Score calculation error:", error);
            }
        }

        return NextResponse.json({
            message: "Job-specific categories updated successfully",
            contributionsProcessed: allContributions.length,
            finalScore,
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

