#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "url";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.DB;

type JobSummary = { id: string; title: string };
type ScriptFlags = { apply: boolean; dryRun: boolean };

/**
 * Resolve database URL with explicit validation.
 */
export function resolveDatabaseUrl(): string {
    if (process.env.DEV_DATABASE_URL) {
        return process.env.DEV_DATABASE_URL;
    }
    if (!process.env.DATABASE_URL) {
        log.error(LOG_CATEGORY, "[add-default-scoring-configs] Missing DATABASE_URL");
        throw new Error("DATABASE_URL is required.");
    }
    return process.env.DATABASE_URL;
}

/**
 * Parse CLI flags for script execution.
 */
export function parseFlags(argv: string[]): ScriptFlags {
    return {
        apply: argv.includes("--apply"),
        dryRun: argv.includes("--dry-run") || argv.includes("--preview"),
    };
}

/**
 * Ensure script is allowed to mutate the database.
 */
export function assertMutationAllowed(flags: ScriptFlags): void {
    if (!flags.apply) {
        log.warn(LOG_CATEGORY, "No --apply flag provided; refusing to mutate.");
        throw new Error("Missing --apply flag.");
    }
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_MUTATION !== "true") {
        log.error(LOG_CATEGORY, "Missing ALLOW_DB_MUTATION=true for production.");
        throw new Error("ALLOW_DB_MUTATION=true is required in production.");
    }
}

/**
 * Fetch jobs missing scoring configuration.
 */
async function fetchJobsWithoutConfig(prisma: PrismaClient): Promise<JobSummary[]> {
    return prisma.job.findMany({
        where: { scoringConfiguration: null },
        select: { id: true, title: true },
    });
}

/**
 * Add scoring configuration for a job.
 */
async function addConfigForJob(prisma: PrismaClient, job: JobSummary): Promise<void> {
    await prisma.scoringConfiguration.create({
        data: {
            jobId: job.id,
            aiAssistWeight: 25,
            experienceWeight: 50,
            codingWeight: 50,
        },
    });
    log.info(LOG_CATEGORY, `✅ Added scoring config for job: ${job.title}`);
}

/**
 * Process all jobs without scoring configuration.
 */
async function processJobs(prisma: PrismaClient, jobs: JobSummary[], dryRun: boolean): Promise<void> {
    for (const job of jobs) {
        try {
            if (dryRun) {
                log.info(LOG_CATEGORY, `[dry-run] Would add scoring config for job: ${job.title}`);
            } else {
                await addConfigForJob(prisma, job);
            }
        } catch (error) {
            log.error(LOG_CATEGORY, `❌ Failed to add config for job ${job.title}:`, error);
        }
    }
}

/**
 * Run default scoring configuration backfill.
 */
export async function addDefaultScoringConfigs(prisma: PrismaClient, dryRun: boolean): Promise<void> {
    log.info(LOG_CATEGORY, "🔄 Adding default scoring configurations to jobs...");
    const jobsWithoutConfig = await fetchJobsWithoutConfig(prisma);
    log.info(LOG_CATEGORY, `📊 Found ${jobsWithoutConfig.length} jobs without scoring configuration`);
    await processJobs(prisma, jobsWithoutConfig, dryRun);
    log.info(LOG_CATEGORY, "✅ Done!");
}

/**
 * Check if this module is the entry point.
 */
function isMainModule(): boolean {
    const entry = process.argv[1];
    return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

/**
 * Execute script when run directly.
 */
export async function runAddDefaultScoringConfigs(): Promise<void> {
    process.env.DATABASE_URL = resolveDatabaseUrl();
    const flags = parseFlags(process.argv);
    if (!flags.dryRun) {
        assertMutationAllowed(flags);
    } else {
        log.info(LOG_CATEGORY, "Running in dry-run mode.");
    }
    const prisma = new PrismaClient();
    try {
        await addDefaultScoringConfigs(prisma, flags.dryRun);
    } finally {
        await prisma.$disconnect();
    }
}

if (isMainModule()) {
    runAddDefaultScoringConfigs().catch((error) => {
        log.error(LOG_CATEGORY, "Fatal error:", error);
        process.exit(1);
    });
}
