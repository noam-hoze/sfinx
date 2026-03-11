import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import { calculateScore, type RawScores, type WorkstyleMetrics } from "app/shared/utils/calculateScore";
import { resolveCategoryKeyByName } from "app/shared/utils/resolveCategoryByName";
import { CONTRIBUTIONS_TARGET } from "@/shared/constants/interview";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const body = await request.json();
        const { jobSpecificCategories } = body;

        if (!jobSpecificCategories) {
            return NextResponse.json(
                { error: "jobSpecificCategories is required" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[Coding Summary Update] Updating job-specific categories for session:", sessionId);

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

        log.info(LOG_CATEGORY, `[Coding Summary Update] Found ${allContributions.length} real-time contributions`);

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

        // Merge real-time contributions with final evaluation categories
        const enrichedCategories: any = { ...jobSpecificCategories };

        for (const [categoryName, categoryData] of Object.entries(jobSpecificCategories as Record<string, any>)) {
            const contributions = categoriesByName.get(categoryName) || [];
            
            if (contributions.length > 0) {
                // Calculate raw average from contributions
                const scores = contributions.map(c => c.contributionStrength);
                const rawAverage = scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
                
                // Apply confidence multiplier based on sample size
                const confidence = Math.min(1.0, contributions.length / CONTRIBUTIONS_TARGET);
                const adjustedScore = Math.round(rawAverage * confidence);
                
                log.info(LOG_CATEGORY, `[Coding Summary Update] ${categoryName}: ${contributions.length} contributions, raw avg=${Math.round(rawAverage)}, confidence=${confidence.toFixed(2)}, adjusted=${adjustedScore}, final override=${categoryData.score}`);
                
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
                
                log.info(LOG_CATEGORY, `[Coding Summary Update] ${categoryName}: No contributions, using final evaluation score=${categoryData.score}`);
            }
        }

        // Extract Problem Solving as a workstyle metric — it is not a job-specific category
        const problemSolvingEntry = (enrichedCategories as any)["Problem Solving"];
        const problemSolvingScore: number | undefined = problemSolvingEntry?.score;

        // Persist only job-specific categories (exclude Problem Solving)
        const categoryOnlyEntries = Object.fromEntries(
            Object.entries(enrichedCategories).filter(([name]) => name !== "Problem Solving")
        );

        await prisma.codingSummary.update({
            where: { id: session.telemetryData.codingSummary.id },
            data: {
                jobSpecificCategories: categoryOnlyEntries,
            },
        });

        if (problemSolvingScore !== undefined && session.telemetryData?.id) {
            await prisma.workstyleMetrics.upsert({
                where: { telemetryDataId: session.telemetryData.id },
                create: { telemetryDataId: session.telemetryData.id, problemSolvingScore },
                update: { problemSolvingScore },
            });
            log.info(LOG_CATEGORY, `[Coding Summary Update] Persisted problemSolvingScore=${problemSolvingScore} to WorkstyleMetrics`);
        }

        log.info(LOG_CATEGORY, "[Coding Summary Update] Successfully updated job-specific categories with contribution data");

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
                const categoryScores = jobCodingCategories.map((cat: any) => ({
                    name: cat.name,
                    score:
                        (categoryOnlyEntries as any)[
                            resolveCategoryKeyByName(categoryOnlyEntries as Record<string, unknown>, cat.name) ?? ""
                        ]?.score ?? 0,
                    weight: cat.weight ?? 1,
                }));

                const rawScores: RawScores = { experienceScores, categoryScores };

                // Get External Tools accountability score if available
                const externalToolUsages = await prisma.externalToolUsage.findMany({
                    where: { interviewSessionId: sessionId },
                    select: { accountabilityScore: true }
                });

                const avgAccountabilityScore = externalToolUsages.length > 0
                    ? externalToolUsages.reduce((sum, usage) => sum + usage.accountabilityScore, 0) / externalToolUsages.length
                    : undefined;

                const scoringConfig = job.scoringConfiguration as any;
                const workstyleMetrics: WorkstyleMetrics = {
                    aiAssistAccountabilityScore: avgAccountabilityScore,
                    problemSolvingScore,
                };

                const result = calculateScore(rawScores, workstyleMetrics, {
                    aiAssistWeight: scoringConfig.aiAssistWeight ?? 25,
                    problemSolvingWeight: scoringConfig.problemSolvingWeight ?? 25,
                    experienceWeight: scoringConfig.experienceWeight ?? 50,
                    codingWeight: scoringConfig.codingWeight ?? 50,
                });
                finalScore = Math.round(result.finalScore);
                await prisma.interviewSession.update({
                    where: { id: sessionId },
                    data: { finalScore },
                });

                log.info(LOG_CATEGORY, `[Coding Summary Update] Calculated and saved finalScore=${finalScore} (problemSolving=${problemSolvingScore ?? "N/A"}) for session ${sessionId}`);
            } catch (error) {
                log.error(LOG_CATEGORY, "[Coding Summary Update] Score calculation error:", error);
            }
        }

        return NextResponse.json({
            message: "Job-specific categories updated successfully",
            contributionsProcessed: allContributions.length,
            finalScore,
        });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[Coding Summary Update] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to update coding summary",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

