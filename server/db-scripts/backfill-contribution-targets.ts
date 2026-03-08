#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";
import {
    CREATION_BACKGROUND_CONTRIBUTIONS_TARGET,
    CREATION_CODING_CONTRIBUTIONS_TARGET,
} from "../../shared/constants/interview";

const rootDir = path.resolve(__dirname, "../..");
config({ path: path.join(rootDir, ".env.local"), override: true });

const prisma = new PrismaClient();

async function backfillContributionTargets() {
    console.log("🔄 Backfilling contribution targets on scoring configurations...");

    const result = await prisma.scoringConfiguration.updateMany({
        data: {
            backgroundContributionsTarget: CREATION_BACKGROUND_CONTRIBUTIONS_TARGET,
            codingContributionsTarget: CREATION_CODING_CONTRIBUTIONS_TARGET,
        },
    });

    console.log(`✅ Updated ${result.count} scoring configurations`);
    await prisma.$disconnect();
}

backfillContributionTargets().catch(async (error) => {
    console.error("Fatal error:", error);
    await prisma.$disconnect();
    process.exit(1);
});
