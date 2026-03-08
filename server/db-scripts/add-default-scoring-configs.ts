#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";
import {
    CREATION_BACKGROUND_CONTRIBUTIONS_TARGET,
    CREATION_CODING_CONTRIBUTIONS_TARGET,
} from "../../shared/constants/interview";

// Load .env.local for local development (contains DATABASE_URL)
const rootDir = path.resolve(__dirname, '../..');
config({ path: path.join(rootDir, '.env.local'), override: true });

const prisma = new PrismaClient();

async function addDefaultScoringConfigs() {
    console.log("🔄 Adding default scoring configurations to jobs...");

    const jobsWithoutConfig = await prisma.job.findMany({
        where: {
            scoringConfiguration: null,
        },
        select: {
            id: true,
            title: true,
        },
    });

    console.log(`📊 Found ${jobsWithoutConfig.length} jobs without scoring configuration`);

    for (const job of jobsWithoutConfig) {
        try {
            await prisma.scoringConfiguration.create({
                data: {
                    jobId: job.id,
                    aiAssistWeight: 25,
                    experienceWeight: 50,
                    codingWeight: 50,
                    backgroundContributionsTarget: CREATION_BACKGROUND_CONTRIBUTIONS_TARGET,
                    codingContributionsTarget: CREATION_CODING_CONTRIBUTIONS_TARGET,
                },
            });
            console.log(`✅ Added scoring config for job: ${job.title}`);
        } catch (error) {
            console.error(`❌ Failed to add config for job ${job.title}:`, error);
        }
    }

    console.log("\n✅ Done!");
    await prisma.$disconnect();
}

addDefaultScoringConfigs().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
