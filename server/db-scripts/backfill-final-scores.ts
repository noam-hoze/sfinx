#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import { calculateScore, type RawScores, type WorkstyleMetrics } from "../../app/shared/utils/calculateScore";

// Use DEV_DATABASE_URL (orange-tree) as user confirmed
process.env.DATABASE_URL = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient();
const LOG_CATEGORY = LOG_CATEGORIES.DB;
const runId = randomUUID();

async function backfillFinalScores() {
    log.info(LOG_CATEGORY, "Starting final score backfill", { runId });

    const sessions = await prisma.interviewSession.findMany({
        where: {
            finalScore: null,
            telemetryData: {
                isNot: null,
            },
        },
        include: {
            telemetryData: {
                include: {
                    backgroundSummary: true,
                    codingSummary: true,
                    workstyleMetrics: true,
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

    log.info(LOG_CATEGORY, "Found sessions without finalScore", {
        runId,
        sessionCount: sessions.length,
    });

    let successCount = 0;
    let failCount = 0;

    for (const session of sessions) {
        try {
            const { telemetryData, application } = session;
            const job = application.job;

            log.debug(LOG_CATEGORY, "Checking session for backfill", {
                runId,
                sessionId: session.id,
                jobId: job.id,
                hasBackgroundSummary: Boolean(telemetryData?.backgroundSummary),
                hasCodingSummary: Boolean(telemetryData?.codingSummary),
                hasScoringConfig: Boolean(job.scoringConfiguration),
                scoringConfigId: job.scoringConfiguration?.id,
            });

            if (!telemetryData?.backgroundSummary || !telemetryData?.codingSummary || !job.scoringConfiguration) {
                log.debug(LOG_CATEGORY, "Skipping session - missing required data", {
                    runId,
                    sessionId: session.id,
                });
                continue;
            }

            const jobExperienceCategories = (job.experienceCategories as any) || [];
            const backgroundExperienceCategories = (telemetryData.backgroundSummary.experienceCategories as any) || {};
            const experienceScores = jobExperienceCategories.map((cat: any) => ({
                name: cat.name,
                score: backgroundExperienceCategories[cat.name]?.score || 0,
                weight: cat.weight || 1
            }));

            const jobCodingCategories = (job.codingCategories as any) || [];
            const codingCategoriesData = (telemetryData.codingSummary.jobSpecificCategories as any) || {};
            const categoryScores = jobCodingCategories.map((cat: any) => {
                // Match by base name (before any parentheses)
                const baseName = cat.name.split(' (')[0];
                const matchingKey = Object.keys(codingCategoriesData).find(key => 
                    key.startsWith(baseName) || cat.name.startsWith(key)
                ) || cat.name;
                
                return {
                    name: cat.name,
                    score: codingCategoriesData[matchingKey]?.score || 0,
                    weight: cat.weight || 1
                };
            });

            const rawScores: RawScores = { experienceScores, categoryScores };
            
            // Get External Tools accountability score if available
            const externalToolUsages = await prisma.externalToolUsage.findMany({
                where: { interviewSessionId: session.id },
                select: { accountabilityScore: true }
            });
            
            const avgAccountabilityScore = externalToolUsages.length > 0
                ? externalToolUsages.reduce((sum, usage) => sum + usage.accountabilityScore, 0) / externalToolUsages.length
                : undefined;
            
            const workstyleMetrics: WorkstyleMetrics = { 
                aiAssistAccountabilityScore: avgAccountabilityScore
            };

            const result = calculateScore(rawScores, workstyleMetrics, job.scoringConfiguration as any);
            const finalScore = Math.round(result.finalScore);

            log.debug(LOG_CATEGORY, "Score calculation result", {
                runId,
                sessionId: session.id,
                experienceScore: result.experienceScore,
                codingScore: result.codingScore,
                finalScore: result.finalScore,
                rounded: finalScore,
            });

            await prisma.interviewSession.update({
                where: { id: session.id },
                data: { finalScore },
            });

            log.info(LOG_CATEGORY, "Session finalScore updated", {
                runId,
                sessionId: session.id,
                finalScore,
            });
            successCount++;
        } catch (error) {
            log.error(LOG_CATEGORY, "Failed to process session", {
                runId,
                sessionId: session.id,
                errorMessage: error instanceof Error ? error.message : String(error),
            });
            failCount++;
        }
    }

    log.info(LOG_CATEGORY, "Backfill complete", {
        runId,
        successCount,
        failCount,
    });

    await prisma.$disconnect();
}

backfillFinalScores().catch((error) => {
    log.error(LOG_CATEGORY, "Fatal error during backfill", {
        runId,
        errorMessage: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
});
