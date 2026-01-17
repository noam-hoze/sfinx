#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.DB;

/**
 * Resolve database URL with explicit validation.
 */
function resolveDatabaseUrl(): string {
    if (process.env.DEV_DATABASE_URL) {
        return process.env.DEV_DATABASE_URL;
    }
    if (!process.env.DATABASE_URL) {
        log.error(LOG_CATEGORY, "[add-default-scoring-configs] Missing DATABASE_URL");
        throw new Error("DATABASE_URL is required.");
    }
    return process.env.DATABASE_URL;
}

process.env.DATABASE_URL = resolveDatabaseUrl();

const prisma = new PrismaClient();

async function addDefaultScoringConfigs() {
    log.info(LOG_CATEGORY, "🔄 Adding default scoring configurations to jobs...");

    const jobsWithoutConfig = await prisma.job.findMany({
        where: {
            scoringConfiguration: null,
        },
        select: {
            id: true,
            title: true,
        },
    });

    log.info(LOG_CATEGORY, `📊 Found ${jobsWithoutConfig.length} jobs without scoring configuration`);

    for (const job of jobsWithoutConfig) {
        try {
            await prisma.scoringConfiguration.create({
                data: {
                    jobId: job.id,
                    aiAssistWeight: 25,
                    experienceWeight: 50,
                    codingWeight: 50,
                },
            });
            log.info(LOG_CATEGORY, `✅ Added scoring config for job: ${job.title}`);
        } catch (error) {
            log.error(LOG_CATEGORY, `❌ Failed to add config for job ${job.title}:`, error);
        }
    }

    log.info(LOG_CATEGORY, "✅ Done!");
    await prisma.$disconnect();
}

addDefaultScoringConfigs().catch((error) => {
    log.error(LOG_CATEGORY, "Fatal error:", error);
    process.exit(1);
});
