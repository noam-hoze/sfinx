import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "app/shared/services/auth";
import prisma from "lib/prisma";
import { log } from "app/shared/services";
import { loadCompanyForUser } from "../../companyContext";
import { ensureCompanyRole } from "../../companyAuth";
import {
    buildScoringConfigValues,
    validateScoringConfigInput,
} from "../../scoringConfigHelpers";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.COMPANY;

interface RouteContext {
    params: Promise<{ jobId: string }>;
}

function normalizeJobId(jobId: string | string[] | undefined): string {
    if (Array.isArray(jobId)) return jobId[0] ?? "";
    return jobId ?? "";
}

/**
 * GET /api/company/jobs/[jobId]/scoring-config
 * Fetch scoring configuration for a job.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const skipAuth = request.nextUrl.searchParams.get("skip-auth") === "true";

        const params = await context.params;
        const jobId = normalizeJobId(params.jobId);
        if (!jobId) {
            return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
        }

        // For skip-auth mode (viewing/demo), just return the config without ownership verification
        if (skipAuth) {
            const job = await prisma.job.findUnique({
                where: { id: jobId },
                include: {
                    scoringConfiguration: true,
                },
            });

            if (!job) {
                return NextResponse.json({ error: "Job not found" }, { status: 404 });
            }

            if (!job.scoringConfiguration) {
                log.error(LOG_CATEGORY, `[scoring-config/GET] Missing scoring configuration for job ${jobId}`);
                return NextResponse.json(
                    { error: "Job scoring configuration is missing" },
                    { status: 500 }
                );
            }

            return NextResponse.json({ config: job.scoringConfiguration });
        }

    // Regular authenticated mode
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; role?: string } | undefined;
    if (!sessionUser?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    ensureCompanyRole(session);
    const userId = String(sessionUser.id);

    // Verify job belongs to user's company
    const { company } = await loadCompanyForUser(userId);
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
            scoringConfiguration: true,
        },
    });

    if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.companyId !== company.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

        if (!job.scoringConfiguration) {
            log.error(LOG_CATEGORY, `[scoring-config/GET] Missing scoring configuration for job ${jobId}`);
            return NextResponse.json(
                { error: "Job scoring configuration is missing" },
                { status: 500 }
            );
        }

        return NextResponse.json({ config: job.scoringConfiguration });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[scoring-config/GET] Error:", error);
        const message =
            typeof error?.message === "string"
                ? error.message
                : "Failed to fetch scoring configuration";
        const status =
            message === "Company role required" || message.includes("Forbidden") ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

/**
 * PUT /api/company/jobs/[jobId]/scoring-config
 * Update scoring configuration with validation
 */
export async function PUT(request: NextRequest, context: RouteContext) {
    try {
        const session = await getServerSession(authOptions);
        const sessionUser = session?.user as { id?: string; role?: string } | undefined;
        if (!sessionUser?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        ensureCompanyRole(session);
        const userId = String(sessionUser.id);

        const params = await context.params;
        const jobId = normalizeJobId(params.jobId);
        if (!jobId) {
            return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
        }

        const body = await request.json();

        // Verify job belongs to user's company
        const { company } = await loadCompanyForUser(userId);
        const job = await prisma.job.findUnique({
            where: { id: jobId },
        });

        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        if (job.companyId !== company.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const validationError = validateScoringConfigInput(body);
        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        // Build update data
        const weightFields = ["aiAssistWeight", "experienceWeight", "codingWeight"];
        const updates: any = {};
        const updateableFields = [
            ...weightFields,
            "backgroundContributionsTarget",
            "codingContributionsTarget",
        ];

        for (const field of updateableFields) {
            if (body[field] !== undefined) {
                updates[field] = Number(body[field]);
            }
        }

        // Upsert configuration
        const config = await prisma.scoringConfiguration.upsert({
            where: { jobId },
            create: {
                jobId,
                ...buildScoringConfigValues(),
                ...updates,
            },
            update: updates,
        });

        log.info(LOG_CATEGORY, `[scoring-config/PUT] Updated configuration for job ${jobId}`);

        return NextResponse.json({ config });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[scoring-config/PUT] Error:", error);
        const message =
            typeof error?.message === "string"
                ? error.message
                : "Failed to update scoring configuration";
        const status =
            message === "Company role required" || message.includes("Forbidden") ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
