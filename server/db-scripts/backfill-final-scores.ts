#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { calculateScore, type RawScores, type WorkstyleMetrics } from "../../app/shared/utils/calculateScore";
import { config } from "dotenv";
import path from "path";

// Load .env.local for local development (contains DATABASE_URL)
const rootDir = path.resolve(__dirname, '../..');
config({ path: path.join(rootDir, '.env.local'), override: true });

const prisma = new PrismaClient();

async function backfillFinalScores() {
    console.log("🔄 Starting final score backfill...");

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

    console.log(`📊 Found ${sessions.length} sessions without finalScore`);

    let successCount = 0;
    let failCount = 0;

    for (const session of sessions) {
        try {
            const { telemetryData, application } = session;
            const job = application.job;

            console.log(`🔍 Checking session ${session.id}:`, {
                jobId: job.id,
                jobTitle: job.title,
                hasBackgroundSummary: !!telemetryData?.backgroundSummary,
                hasCodingSummary: !!telemetryData?.codingSummary,
                hasScoringConfig: !!job.scoringConfiguration,
                scoringConfigId: job.scoringConfiguration?.id,
            });

            if (!telemetryData?.backgroundSummary || !telemetryData?.codingSummary || !job.scoringConfiguration) {
                console.log(`⏭️  Skipping session ${session.id} - missing required data`);
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

            console.log(`📊 Score calculation inputs for ${session.id}:`, {
                experienceScores,
                categoryScores,
                workstyleMetrics,
                scoringConfig: job.scoringConfiguration,
            });

            const result = calculateScore(rawScores, workstyleMetrics, job.scoringConfiguration as any);
            const finalScore = Math.round(result.finalScore);

            console.log(`📊 Score calculation result:`, {
                experienceScore: result.experienceScore,
                codingScore: result.codingScore,
                finalScore: result.finalScore,
                rounded: finalScore,
            });

            await prisma.interviewSession.update({
                where: { id: session.id },
                data: { finalScore },
            });

            console.log(`✅ Session ${session.id}: finalScore = ${finalScore}`);
            successCount++;
        } catch (error) {
            console.error(`❌ Failed to process session ${session.id}:`, error);
            failCount++;
        }
    }

    console.log(`\n📈 Backfill complete:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);

    await prisma.$disconnect();
}

backfillFinalScores().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
