#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import { calculateScore, type RawScores, type WorkstyleMetrics } from "../../app/shared/utils/calculateScore";

const LOG_CATEGORY = LOG_CATEGORIES.DB;

/**
 * Resolve database URL with explicit validation.
 */
function resolveDatabaseUrl(): string {
    if (process.env.DEV_DATABASE_URL) {
        return process.env.DEV_DATABASE_URL;
    }
    if (!process.env.DATABASE_URL) {
        log.error(LOG_CATEGORY, "[backfill-final-scores] Missing DATABASE_URL");
        throw new Error("DATABASE_URL is required.");
    }
    return process.env.DATABASE_URL;
}

/**
 * Require a defined value.
 */
function requireValue<T>(value: T | null | undefined, label: string): T {
    if (value === null || value === undefined) {
        log.error(LOG_CATEGORY, `[backfill-final-scores] Missing ${label}`);
        throw new Error(`${label} is required.`);
    }
    return value;
}

/**
 * Require a finite number.
 */
function requireNumber(value: unknown, label: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        log.error(LOG_CATEGORY, `[backfill-final-scores] Invalid ${label}`, { value });
        throw new Error(`${label} must be a finite number.`);
    }
    return value;
}

process.env.DATABASE_URL = resolveDatabaseUrl();

const prisma = new PrismaClient();

async function backfillFinalScores() {
    log.info(LOG_CATEGORY, "🔄 Starting final score backfill...");

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

    log.info(LOG_CATEGORY, `📊 Found ${sessions.length} sessions without finalScore`);

    let successCount = 0;
    let failCount = 0;

    for (const session of sessions) {
        try {
            const { telemetryData, application } = session;
            const job = application.job;

            log.info(LOG_CATEGORY, `🔍 Checking session ${session.id}:`, {
                jobId: job.id,
                jobTitle: job.title,
                hasBackgroundSummary: !!telemetryData?.backgroundSummary,
                hasCodingSummary: !!telemetryData?.codingSummary,
                hasScoringConfig: !!job.scoringConfiguration,
                scoringConfigId: job.scoringConfiguration?.id,
            });

            if (!telemetryData?.backgroundSummary || !telemetryData?.codingSummary || !job.scoringConfiguration) {
                log.warn(LOG_CATEGORY, `⏭️  Skipping session ${session.id} - missing required data`);
                continue;
            }

            const jobExperienceCategories = requireValue(job.experienceCategories as any, "job.experienceCategories");
            const backgroundExperienceCategories = requireValue(
                telemetryData.backgroundSummary.experienceCategories as any,
                "telemetryData.backgroundSummary.experienceCategories"
            );
            const experienceScores = jobExperienceCategories.map((cat: any) => ({
                name: requireValue(cat.name, "experienceCategories.name"),
                score: requireNumber(backgroundExperienceCategories[cat.name]?.score, `experience score for ${cat.name}`),
                weight: requireNumber(cat.weight, `experience weight for ${cat.name}`),
            }));

            const jobCodingCategories = requireValue(job.codingCategories as any, "job.codingCategories");
            const codingCategoriesData = requireValue(
                telemetryData.codingSummary.jobSpecificCategories as any,
                "telemetryData.codingSummary.jobSpecificCategories"
            );
            const categoryScores = jobCodingCategories.map((cat: any) => {
                // Match by base name (before any parentheses)
                const baseName = requireValue(cat.name, "codingCategories.name").split(" (")[0];
                const matchingKey = Object.keys(codingCategoriesData).find((key) =>
                    key.startsWith(baseName) || cat.name.startsWith(key)
                );
                const resolvedKey = requireValue(matchingKey, `codingCategories key for ${cat.name}`);

                return {
                    name: requireValue(cat.name, "codingCategories.name"),
                    score: requireNumber(codingCategoriesData[resolvedKey]?.score, `coding score for ${cat.name}`),
                    weight: requireNumber(cat.weight, `coding weight for ${cat.name}`),
                };
            });

            const rawScores: RawScores = { experienceScores, categoryScores };
            
            // Get External Tools accountability score if available
            const externalToolUsages = await prisma.externalToolUsage.findMany({
                where: { interviewSessionId: session.id },
                select: { accountabilityScore: true }
            });
            
            const avgAccountabilityScore = externalToolUsages.length > 0
                ? externalToolUsages.reduce((sum, usage) => sum + requireNumber(usage.accountabilityScore, "accountabilityScore"), 0)
                    / externalToolUsages.length
                : undefined;
            
            const workstyleMetrics: WorkstyleMetrics = { 
                aiAssistAccountabilityScore: avgAccountabilityScore
            };

            log.info(LOG_CATEGORY, `📊 Score calculation inputs for ${session.id}:`, {
                experienceScores,
                categoryScores,
                workstyleMetrics,
                scoringConfig: job.scoringConfiguration,
            });

            const result = calculateScore(rawScores, workstyleMetrics, job.scoringConfiguration as any);
            const finalScore = Math.round(result.finalScore);

            log.info(LOG_CATEGORY, "📊 Score calculation result:", {
                experienceScore: result.experienceScore,
                codingScore: result.codingScore,
                finalScore: result.finalScore,
                rounded: finalScore,
            });

            await prisma.interviewSession.update({
                where: { id: session.id },
                data: { finalScore },
            });

            log.info(LOG_CATEGORY, `✅ Session ${session.id}: finalScore = ${finalScore}`);
            successCount++;
        } catch (error) {
            log.error(LOG_CATEGORY, `❌ Failed to process session ${session.id}:`, error);
            failCount++;
        }
    }

    log.info(LOG_CATEGORY, "📈 Backfill complete:");
    log.info(LOG_CATEGORY, `   ✅ Success: ${successCount}`);
    log.info(LOG_CATEGORY, `   ❌ Failed: ${failCount}`);

    await prisma.$disconnect();
}

backfillFinalScores().catch((error) => {
    log.error(LOG_CATEGORY, "Fatal error:", error);
    process.exit(1);
});
