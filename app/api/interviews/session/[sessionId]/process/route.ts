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
 *  4. Execute all five processing steps after the response is flushed (using
 *     Next.js `after()`). Each step is individually try/caught so one failure
 *     does not abort the rest.
 *  5. Mark session status → "COMPLETED" when all steps finish.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

type RouteContext = {
    params: Promise<{ sessionId?: string | string[] }>;
};

type CodingCategory = { name: string; description: string; weight: number };
type ProcessRequestBody = { finalCode?: string; userId?: string };

function normalizeSessionId(sessionId: string | string[] | undefined): string {
    if (Array.isArray(sessionId)) return sessionId[0] ?? "";
    return sessionId ?? "";
}

function normalizeCodingCategories(raw: unknown): CodingCategory[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
            name: typeof item.name === "string" ? item.name : "",
            description: typeof item.description === "string" ? item.description : "",
            weight: typeof item.weight === "number" ? item.weight : Number(item.weight) || 0,
        }))
        .filter((category) => category.name.length > 0);
}

/** Returns the authenticated candidate id from the active session. */
function getAuthenticatedUserId(session: unknown): string | undefined {
    return (session as { user?: { id?: string } } | null)?.user?.id;
}

/** Returns the candidate id explicitly supplied for skip-auth interview flows. */
function getRequestedUserId(body: ProcessRequestBody): string | undefined {
    if (typeof body.userId !== "string") return undefined;
    const userId = body.userId.trim();
    return userId.length > 0 ? userId : undefined;
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
    let body: ProcessRequestBody;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const url = new URL(request.url);
    const skipAuth = url.searchParams.get("skip-auth") === "true";
    const session = await getServerSession(authOptions);
    const actingUserId = getAuthenticatedUserId(session)
        ?? (skipAuth ? getRequestedUserId(body) : undefined);

    if (!actingUserId) {
        return skipAuth
            ? NextResponse.json({ error: "userId required when skip-auth=true" }, { status: 400 })
            : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const interviewSession = await prisma.interviewSession.findFirst({
        where: {
            id: sessionId,
            candidateId: actingUserId,
        },
        select: {
            id: true,
            status: true,
            candidateId: true,
            application: {
                select: {
                    job: {
                        select: {
                            codingCategories: true,
                            interviewContent: {
                                select: {
                                    codingPrompt: true,
                                    codingAnswer: true,
                                    expectedOutput: true,
                                },
                            },
                        },
                    },
                },
            },
        },
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

    const interviewContent = interviewSession.application?.job?.interviewContent;
    if (!interviewContent) {
        return NextResponse.json(
            { error: "Interview content is missing for this session's job" },
            { status: 400 }
        );
    }

    const claimResult = await prisma.interviewSession.updateMany({
        where: {
            id: sessionId,
            candidateId: actingUserId,
            status: "IN_PROGRESS",
        },
        data: { status: "PROCESSING" },
    });

    if (claimResult.count === 0) {
        const latestSession = await prisma.interviewSession.findFirst({
            where: { id: sessionId, candidateId: actingUserId },
            select: { status: true },
        });
        if (!latestSession) {
            return NextResponse.json({ error: "Interview session not found" }, { status: 404 });
        }
        if (latestSession.status === "PROCESSING" || latestSession.status === "COMPLETED") {
            return NextResponse.json({ status: latestSession.status }, { status: 202 });
        }
        return NextResponse.json(
            { error: `Interview session cannot be processed from status ${latestSession.status}` },
            { status: 409 }
        );
    }

    log.info(LOG_CATEGORY, `[Process] Session ${sessionId} marked PROCESSING, scheduling background work`);

    // Build the absolute base URL for internal API calls executed after the
    // response is flushed. The request URL is the most reliable source here.
    const baseUrl = new URL(request.url).origin;

    const finalCode = body.finalCode ?? "";
    const codingTask = interviewContent.codingPrompt;
    const expectedSolution = interviewContent.codingAnswer ?? "";
    const expectedOutput = interviewContent.expectedOutput ?? "";
    const jobCategories = normalizeCodingCategories(interviewSession.application?.job?.codingCategories);

    // Schedule work to run AFTER the HTTP response is sent to the candidate.
    after(async () => {
        log.info(LOG_CATEGORY, `[Process] Starting background processing for session ${sessionId}`);

        // ------------------------------------------------------------------ //
        // Step 1 — Background summary (server owns this; client only saves messages)
        // ------------------------------------------------------------------ //
        try {
            const res = await fetch(
                `${baseUrl}/api/interviews/session/${sessionId}/background-summary?skip-auth=true`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: interviewSession.candidateId }),
                }
            );
            if (res.ok) {
                log.info(LOG_CATEGORY, `[Process] ✅ Background summary generated for ${sessionId}`);
            } else {
                log.error(LOG_CATEGORY, `[Process] ❌ Background summary failed: ${res.status} ${await res.text().catch(() => "")}`);
            }
        } catch (err) {
            log.error(LOG_CATEGORY, `[Process] ❌ Background summary error:`, err);
        }

        // ------------------------------------------------------------------ //
        // Step 2 — Coding gaps
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
        // Step 3 — Coding summary
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
        // Step 4 — Code quality analysis
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
        // Step 5 — Job-specific coding evaluation + coding-summary update
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
        // Step 6 — Profile story
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
