#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

process.env.DATABASE_URL = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient();
const LOG_CATEGORY = LOG_CATEGORIES.DB;
const runId = randomUUID();

async function addDefaultScoringConfigs() {
    log.info(LOG_CATEGORY, "Adding default scoring configurations to jobs", { runId });

    const jobsWithoutConfig = await prisma.job.findMany({
        where: {
            scoringConfiguration: null,
        },
        select: {
            id: true,
            title: true,
        },
    });

    log.info(LOG_CATEGORY, "Found jobs without scoring configuration", {
        runId,
        jobCount: jobsWithoutConfig.length,
    });

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
            log.info(LOG_CATEGORY, "Added scoring config for job", {
                runId,
                jobId: job.id,
                jobTitle: job.title,
            });
        } catch (error) {
            log.error(LOG_CATEGORY, "Failed to add config for job", {
                runId,
                jobId: job.id,
                jobTitle: job.title,
                errorMessage: error instanceof Error ? error.message : String(error),
            });
        }
    }

    log.info(LOG_CATEGORY, "Default scoring configurations complete", { runId });
    await prisma.$disconnect();
}

addDefaultScoringConfigs().catch((error) => {
    log.error(LOG_CATEGORY, "Fatal error adding default scoring configs", {
        runId,
        errorMessage: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
});
