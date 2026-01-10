#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;

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
