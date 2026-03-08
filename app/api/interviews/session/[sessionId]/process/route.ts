/**
 * POST /api/interviews/session/[sessionId]/process
 *
 * Triggers all post-interview processing steps asynchronously so the candidate
 * is never blocked waiting for AI computations.
 *
 * Flow:
 *  1. Validate request and session ownership.
 *  2. Mark session status → "PROCESSING".
 *  3. Return HTTP 202 immediately so the candidate's browser is unblocked.
 *  4. Execute all six processing steps after the response is flushed (using
 *     Next.js `after()`). Each step is individually try/caught so one failure
 *     does not abort the rest.
 *  5. Persist finalScore to InterviewSession before marking COMPLETED.
 *  6. Mark session status → "COMPLETED" when all steps finish.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import {
    calculateScore,
    type RawScores,
    type WorkstyleMetrics,
    type ScoringConfiguration,
} from "app/shared/utils/calculateScore";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

/** Fetches session data required for final score calculation. */
async function fetchSessionForScoring(sessionId: string) {
    return prisma.interviewSession.findUnique({
        where: { id: sessionId },
        include: {
            application: {
                include: {
                    job: { include: { scoringConfiguration: true } },
                },
            },
            telemetryData: {
                include: { backgroundSummary: true, codingSummary: true },
            },
        },
    });
}

/** Builds RawScores from session background and coding summaries. */
function buildRawScores(
    session: NonNullable<Awaited<ReturnType<typeof fetchSessionForScoring>>>
): RawScores {
    const job = session.application?.job;
    const bgCats = (session.telemetryData?.backgroundSummary?.experienceCategories as any) ?? {};
    const codingCats = (session.telemetryData?.codingSummary?.jobSpecificCategories as any) ?? {};
    const experienceScores = ((job?.experienceCategories as any) ?? []).map((c: any) => ({
        name: c.name, score: bgCats[c.name]?.score ?? 0, weight: c.weight ?? 1,
    }));
    const categoryScores = ((job?.codingCategories as any) ?? []).map((c: any) => ({
        name: c.name, score: codingCats[c.name]?.score ?? 0, weight: c.weight ?? 1,
    }));
    return { experienceScores, categoryScores };
}

/**
 * Calculates and persists finalScore for a completed session.
 * Uses the same logic as the telemetry API so the applicants table score
 * matches what the CPS page displays. Defaults to 0 if data is unavailable.
 */
async function persistFinalScore(sessionId: string): Promise<void> {
    const session = await fetchSessionForScoring(sessionId);
    const scoringConfig = session?.application?.job?.scoringConfiguration;
    const hasSummaries = !!(
        session?.telemetryData?.backgroundSummary && session.telemetryData.codingSummary
    );

    let finalScore = 0;
    if (scoringConfig && hasSummaries) {
        const tools = await prisma.externalToolUsage.findMany({
            where: { interviewSessionId: sessionId },
            select: { accountabilityScore: true },
        });
        const avgScore = tools.length > 0
            ? tools.reduce((sum, t) => sum + t.accountabilityScore, 0) / tools.length
            : undefined;
        const workstyleMetrics: WorkstyleMetrics = { aiAssistAccountabilityScore: avgScore };
        const result = calculateScore(buildRawScores(session!), workstyleMetrics, scoringConfig as ScoringConfiguration);
        finalScore = result.finalScore;
    }

    await prisma.interviewSession.update({ where: { id: sessionId }, data: { finalScore } });
}

type RouteContext = {
    params: Promise<{ sessionId?: string | string[] }>;
};

function normalizeSessionId(sessionId: string | string[] | undefined): string {
    if (Array.isArray(sessionId)) return sessionId[0] ?? "";
    return sessionId ?? "";
}

export async function POST(request: NextRequest, context: RouteContext) {
    const { sessionId: rawSessionId } = await context.params;
    const sessionId = normalizeSessionId(rawSessionId);

    if (!sessionId) {
        return NextResponse.json(
            { error: "Interview session id is required" },
            { status: 400 }
        );
    }

    // Parse and validate request body
    let body: {
        finalCode?: string;
        codingTask?: string;
        expectedSolution?: string;
        expectedOutput?: string;
        jobCategories?: Array<{ name: string; description: string; weight: number }>;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Verify session exists. The candidate submits this from their own browser,
    // so no company-auth check is needed here (same skip-auth pattern used elsewhere).
    const interviewSession = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        select: { id: true, status: true },
    });

    if (!interviewSession) {
        return NextResponse.json(
            { error: "Interview session not found" },
            { status: 404 }
        );
    }

    if (interviewSession.status === "PROCESSING" || interviewSession.status === "COMPLETED") {
        // Idempotent: don't re-process an already in-flight or finished session.
        return NextResponse.json({ status: interviewSession.status }, { status: 202 });
    }

    // Mark as PROCESSING synchronously before returning so the CPS page
    // can immediately show the "calculating" state on first poll.
    await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { status: "PROCESSING" },
    });

    log.info(LOG_CATEGORY, `[Process] Session ${sessionId} marked PROCESSING, scheduling background work`);

    // Build the absolute base URL for internal API calls executed after the
    // response is flushed. The request URL is the most reliable source here.
    const baseUrl = new URL(request.url).origin;

    const {
        finalCode = "",
        codingTask = "",
        expectedSolution = "",
        expectedOutput = "",
        jobCategories = [],
    } = body;

    // Schedule work to run AFTER the HTTP response is sent to the candidate.
    after(async () => {
        log.info(LOG_CATEGORY, `[Process] Starting background processing for session ${sessionId}`);

        // ------------------------------------------------------------------ //
        // Step 1 — Coding gaps
        // ------------------------------------------------------------------ //
        try {
            const res = await fetch(`${baseUrl}/api/interviews/generate-coding-gaps`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, finalCode, codingTask, expectedSolution }),
            });
            if (res.ok) {
                log.info(LOG_CATEGORY, `[Process] ✅ Coding gaps generated for ${sessionId}`);
            } else {
                log.error(LOG_CATEGORY, `[Process] ❌ Coding gaps failed: ${res.status}`);
            }
        } catch (err) {
            log.error(LOG_CATEGORY, `[Process] ❌ Coding gaps error:`, err);
        }

        // ------------------------------------------------------------------ //
        // Step 2 — Coding summary
        // ------------------------------------------------------------------ //
        try {
            const res = await fetch(`${baseUrl}/api/interviews/generate-coding-summary`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, finalCode, codingTask, expectedSolution }),
            });
            if (res.ok) {
                log.info(LOG_CATEGORY, `[Process] ✅ Coding summary generated for ${sessionId}`);
            } else {
                log.error(LOG_CATEGORY, `[Process] ❌ Coding summary failed: ${res.status}`);
            }
        } catch (err) {
            log.error(LOG_CATEGORY, `[Process] ❌ Coding summary error:`, err);
        }

        // ------------------------------------------------------------------ //
        // Step 3 — Code quality analysis
        // ------------------------------------------------------------------ //
        try {
            const res = await fetch(
                `${baseUrl}/api/interviews/session/${sessionId}/code-quality-analysis`,
                { method: "POST", headers: { "Content-Type": "application/json" } }
            );
            if (res.ok) {
                log.info(LOG_CATEGORY, `[Process] ✅ Code quality analysis done for ${sessionId}`);
            } else {
                log.error(LOG_CATEGORY, `[Process] ❌ Code quality analysis failed: ${res.status}`);
            }
        } catch (err) {
            log.error(LOG_CATEGORY, `[Process] ❌ Code quality analysis error:`, err);
        }

        // ------------------------------------------------------------------ //
        // Step 4 — Job-specific coding evaluation + coding-summary update
        // ------------------------------------------------------------------ //
        try {
            const evalRes = await fetch(`${baseUrl}/api/interviews/evaluate-job-specific-coding`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    finalCode,
                    codingTask,
                    categories: jobCategories,
                    referenceCode: expectedSolution,
                    expectedOutput,
                    sessionId,
                }),
            });

            if (evalRes.ok) {
                const evalData = await evalRes.json();
                log.info(LOG_CATEGORY, `[Process] ✅ Job-specific eval done for ${sessionId}`);

                // Enrich with descriptions from jobCategories, then write back
                const enrichedCategories: Record<string, any> = {};
                Object.entries(evalData.categories || {}).forEach(([name, data]: [string, any]) => {
                    const catDef = jobCategories.find((c) => c.name === name);
                    enrichedCategories[name] = { ...data, description: catDef?.description ?? "" };
                });

                try {
                    const updateRes = await fetch(
                        `${baseUrl}/api/interviews/session/${sessionId}/coding-summary-update`,
                        {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ jobSpecificCategories: enrichedCategories }),
                        }
                    );
                    if (updateRes.ok) {
                        log.info(LOG_CATEGORY, `[Process] ✅ Coding summary updated for ${sessionId}`);
                    } else {
                        log.error(LOG_CATEGORY, `[Process] ❌ Coding summary update failed: ${updateRes.status}`);
                    }
                } catch (updateErr) {
                    log.error(LOG_CATEGORY, `[Process] ❌ Coding summary update error:`, updateErr);
                }
            } else {
                log.error(LOG_CATEGORY, `[Process] ❌ Job-specific eval failed: ${evalRes.status}`);
            }
        } catch (err) {
            log.error(LOG_CATEGORY, `[Process] ❌ Job-specific eval error:`, err);
        }

        // ------------------------------------------------------------------ //
        // Step 5 — Profile story
        // ------------------------------------------------------------------ //
        try {
            const res = await fetch(`${baseUrl}/api/interviews/generate-profile-story`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
            });
            if (res.ok) {
                log.info(LOG_CATEGORY, `[Process] ✅ Profile story generated for ${sessionId}`);
            } else {
                log.error(LOG_CATEGORY, `[Process] ❌ Profile story failed: ${res.status}`);
            }
        } catch (err) {
            log.error(LOG_CATEGORY, `[Process] ❌ Profile story error:`, err);
        }

        // ------------------------------------------------------------------ //
        // Step 6 — Persist final score
        // Uses the same calculation logic as the telemetry API so the
        // applicants table score matches what the CPS page displays.
        // Runs after all AI steps so summaries are guaranteed to be written.
        // ------------------------------------------------------------------ //
        try {
            await persistFinalScore(sessionId);
            log.info(LOG_CATEGORY, `[Process] ✅ Final score persisted for ${sessionId}`);
        } catch (err) {
            log.error(LOG_CATEGORY, `[Process] ❌ Final score persistence error:`, err);
        }

        // ------------------------------------------------------------------ //
        // Mark COMPLETED regardless of individual step outcomes
        // ------------------------------------------------------------------ //
        try {
            await prisma.interviewSession.update({
                where: { id: sessionId },
                data: { status: "COMPLETED" },
            });
            log.info(LOG_CATEGORY, `[Process] ✅ Session ${sessionId} marked COMPLETED`);
        } catch (err) {
            log.error(LOG_CATEGORY, `[Process] ❌ Failed to mark session COMPLETED:`, err);
        }
    });

    return NextResponse.json({ status: "PROCESSING" }, { status: 202 });
}
