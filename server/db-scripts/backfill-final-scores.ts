#!/usr/bin/env tsx

import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "url";
import { log } from "app/shared/services/logger";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import { calculateScore, type RawScores, type WorkstyleMetrics } from "../../app/shared/utils/calculateScore";

const LOG_CATEGORY = LOG_CATEGORIES.DB;

/**
 * Resolve database URL with explicit validation.
 */
export function resolveDatabaseUrl(): string {
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
export function requireValue<T>(value: T | null | undefined, label: string): T {
    if (value === null || value === undefined) {
        log.error(LOG_CATEGORY, `[backfill-final-scores] Missing ${label}`);
        throw new Error(`${label} is required.`);
    }
    return value;
}

/**
 * Require a finite number.
 */
export function requireNumber(value: unknown, label: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        log.error(LOG_CATEGORY, `[backfill-final-scores] Invalid ${label}`, { value });
        throw new Error(`${label} must be a finite number.`);
    }
    return value;
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

type SessionWithTelemetry = Awaited<ReturnType<PrismaClient["interviewSession"]["findMany"]>>[number];
type ScriptFlags = { apply: boolean; dryRun: boolean };

/**
 * Fetch sessions missing final scores.
 */
async function fetchSessions(prisma: PrismaClient): Promise<SessionWithTelemetry[]> {
    return prisma.interviewSession.findMany({
        where: { finalScore: null, telemetryData: { isNot: null } },
        include: {
            telemetryData: { include: { backgroundSummary: true, codingSummary: true, workstyleMetrics: true } },
            application: { include: { job: { include: { scoringConfiguration: true } } } },
        },
    });
}

/**
 * Build experience score inputs.
 */
function buildExperienceScores(session: SessionWithTelemetry) {
    const job = session.application.job;
    const jobExperienceCategories = requireValue(job.experienceCategories as any, "job.experienceCategories");
    const backgroundExperienceCategories = requireValue(
        session.telemetryData?.backgroundSummary?.experienceCategories as any,
        "telemetryData.backgroundSummary.experienceCategories"
    );
    return jobExperienceCategories.map((cat: any) => ({
        name: requireValue(cat.name, "experienceCategories.name"),
        score: requireNumber(backgroundExperienceCategories[cat.name]?.score, `experience score for ${cat.name}`),
        weight: requireNumber(cat.weight, `experience weight for ${cat.name}`),
    }));
}

/**
 * Resolve coding category key match.
 */
function resolveCategoryKey(codingCategoriesData: Record<string, any>, catName: string): string {
    const baseName = requireValue(catName, "codingCategories.name").split(" (")[0];
    const matchingKey = Object.keys(codingCategoriesData).find((key) =>
        key.startsWith(baseName) || catName.startsWith(key)
    );
    return requireValue(matchingKey, `codingCategories key for ${catName}`);
}

/**
 * Build coding category score inputs.
 */
function buildCategoryScores(session: SessionWithTelemetry) {
    const job = session.application.job;
    const jobCodingCategories = requireValue(job.codingCategories as any, "job.codingCategories");
    const codingCategoriesData = requireValue(
        session.telemetryData?.codingSummary?.jobSpecificCategories as any,
        "telemetryData.codingSummary.jobSpecificCategories"
    );
    return jobCodingCategories.map((cat: any) => {
        const resolvedKey = resolveCategoryKey(codingCategoriesData, cat.name);
        return {
            name: requireValue(cat.name, "codingCategories.name"),
            score: requireNumber(codingCategoriesData[resolvedKey]?.score, `coding score for ${cat.name}`),
            weight: requireNumber(cat.weight, `coding weight for ${cat.name}`),
        };
    });
}

/**
 * Calculate accountability score.
 */
async function calculateAccountabilityScore(prisma: PrismaClient, sessionId: string) {
    const externalToolUsages = await prisma.externalToolUsage.findMany({
        where: { interviewSessionId: sessionId },
        select: { accountabilityScore: true },
    });
    if (externalToolUsages.length === 0) return undefined;
    const total = externalToolUsages.reduce(
        (sum, usage) => sum + requireNumber(usage.accountabilityScore, "accountabilityScore"),
        0
    );
    return total / externalToolUsages.length;
}

/**
 * Log session skip details.
 */
function logSessionStatus(session: SessionWithTelemetry) {
    const job = session.application.job;
    const telemetryData = session.telemetryData;
    log.info(LOG_CATEGORY, `🔍 Checking session ${session.id}:`, {
        jobId: job.id,
        jobTitle: job.title,
        hasBackgroundSummary: !!telemetryData?.backgroundSummary,
        hasCodingSummary: !!telemetryData?.codingSummary,
        hasScoringConfig: !!job.scoringConfiguration,
        scoringConfigId: job.scoringConfiguration?.id,
    });
}

/**
 * Update session final score in DB.
 */
async function updateSessionScore(prisma: PrismaClient, sessionId: string, finalScore: number, dryRun: boolean) {
    if (dryRun) {
        log.info(LOG_CATEGORY, `[dry-run] Would set finalScore=${finalScore} for session ${sessionId}`);
        return;
    }
    await prisma.interviewSession.update({ where: { id: sessionId }, data: { finalScore } });
}

/**
 * Build workstyle metrics for scoring.
 */
async function buildWorkstyleMetrics(prisma: PrismaClient, sessionId: string): Promise<WorkstyleMetrics> {
    const avgAccountabilityScore = await calculateAccountabilityScore(prisma, sessionId);
    return { aiAssistAccountabilityScore: avgAccountabilityScore };
}

/**
 * Log scoring inputs for a session.
 */
function logScoreInputs(sessionId: string, experienceScores: any[], categoryScores: any[], metrics: WorkstyleMetrics, config: any) {
    log.info(LOG_CATEGORY, `📊 Score calculation inputs for ${sessionId}:`, {
        experienceScores,
        categoryScores,
        workstyleMetrics: metrics,
        scoringConfig: config,
    });
}

/**
 * Log score calculation output.
 */
function logScoreResult(result: { experienceScore: number; codingScore: number; finalScore: number }) {
    log.info(LOG_CATEGORY, "📊 Score calculation result:", {
        experienceScore: result.experienceScore,
        codingScore: result.codingScore,
        finalScore: result.finalScore,
        rounded: Math.round(result.finalScore),
    });
}

/**
 * Calculate final score from inputs.
 */
function calculateFinalScore(rawScores: RawScores, metrics: WorkstyleMetrics, config: any): number {
    const result = calculateScore(rawScores, metrics, config);
    logScoreResult(result);
    return Math.round(result.finalScore);
}

/**
 * Process a single session.
 */
async function processSession(prisma: PrismaClient, session: SessionWithTelemetry, dryRun: boolean): Promise<boolean> {
    logSessionStatus(session);
    const job = session.application.job;
    const telemetryData = session.telemetryData;
    if (!telemetryData?.backgroundSummary || !telemetryData?.codingSummary || !job.scoringConfiguration) {
        log.warn(LOG_CATEGORY, `⏭️  Skipping session ${session.id} - missing required data`);
        return false;
    }
    const experienceScores = buildExperienceScores(session);
    const categoryScores = buildCategoryScores(session);
    const rawScores: RawScores = { experienceScores, categoryScores };
    const workstyleMetrics = await buildWorkstyleMetrics(prisma, session.id);
    logScoreInputs(session.id, experienceScores, categoryScores, workstyleMetrics, job.scoringConfiguration);
    const finalScore = calculateFinalScore(rawScores, workstyleMetrics, job.scoringConfiguration as any);
    await updateSessionScore(prisma, session.id, finalScore, dryRun);
    log.info(LOG_CATEGORY, `✅ Session ${session.id}: finalScore = ${finalScore}`);
    return true;
}

/**
 * Process all sessions needing backfill.
 */
async function processSessions(prisma: PrismaClient, sessions: SessionWithTelemetry[], dryRun: boolean) {
    let successCount = 0;
    let failCount = 0;
    for (const session of sessions) {
        try {
            if (await processSession(prisma, session, dryRun)) successCount += 1;
        } catch (error) {
            log.error(LOG_CATEGORY, `❌ Failed to process session ${session.id}:`, error);
            failCount += 1;
        }
    }
    log.info(LOG_CATEGORY, "📈 Backfill complete:");
    log.info(LOG_CATEGORY, `   ✅ Success: ${successCount}`);
    log.info(LOG_CATEGORY, `   ❌ Failed: ${failCount}`);
}

/**
 * Run final score backfill.
 */
export async function backfillFinalScores(prisma: PrismaClient, dryRun: boolean): Promise<void> {
    log.info(LOG_CATEGORY, "🔄 Starting final score backfill...");
    const sessions = await fetchSessions(prisma);
    log.info(LOG_CATEGORY, `📊 Found ${sessions.length} sessions without finalScore`);
    await processSessions(prisma, sessions, dryRun);
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
export async function runBackfillFinalScores(): Promise<void> {
    process.env.DATABASE_URL = resolveDatabaseUrl();
    const flags = parseFlags(process.argv);
    if (!flags.dryRun) {
        assertMutationAllowed(flags);
    } else {
        log.info(LOG_CATEGORY, "Running in dry-run mode.");
    }
    const prisma = new PrismaClient();
    try {
        await backfillFinalScores(prisma, flags.dryRun);
    } finally {
        await prisma.$disconnect();
    }
}

if (isMainModule()) {
    runBackfillFinalScores().catch((error) => {
        log.error(LOG_CATEGORY, "Fatal error:", error);
        process.exit(1);
    });
}
