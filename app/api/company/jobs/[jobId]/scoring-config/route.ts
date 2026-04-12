import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "app/shared/services/auth";
import prisma from "lib/prisma";
import { log } from "app/shared/services";
import { resolveScoringConfiguration } from "app/shared/utils/calculateScore";
import { loadCompanyForUser } from "../../companyContext";
import { ensureCompanyRole } from "../../companyAuth";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.COMPANY;

interface RouteContext {
    params: Promise<{ jobId: string }>;
}

function normalizeJobId(jobId: string | string[] | undefined): string {
    if (Array.isArray(jobId)) return jobId[0] ?? "";
    return jobId ?? "";
}

function toNumber(value: unknown): number {
    return Number(value);
}

/**
 * GET /api/company/jobs/[jobId]/scoring-config
 * Fetch scoring configuration for a job (create default if doesn't exist)
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

            // If no configuration exists, create default
            let config = job.scoringConfiguration;
            if (!config) {
                config = await prisma.scoringConfiguration.create({
                    data: { jobId },
                });
                log.info(LOG_CATEGORY, `[scoring-config/GET] Created default configuration for job ${jobId}`);
            }

            return NextResponse.json({ config: resolveScoringConfiguration(config) });
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

    // If no configuration exists, create default
    let config = job.scoringConfiguration;
        if (!config) {
            config = await prisma.scoringConfiguration.create({
                data: { jobId },
            });
            log.info(LOG_CATEGORY, `[scoring-config/GET] Created default configuration for job ${jobId}`);
        }

        return NextResponse.json({ config: resolveScoringConfiguration(config) });
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

        // Validate weights are positive numbers
        const weightFields = [
            'aiAssistWeight',
            'problemSolvingWeight',
            'experienceWeight',
            'codingWeight',
        ];

        for (const field of weightFields) {
            if (body[field] !== undefined) {
                const value = toNumber(body[field]);
                if (Number.isNaN(value) || value < 0 || value > 100) {
                    return NextResponse.json(
                        { error: `${field} must be a number between 0 and 100` },
                        { status: 400 }
                    );
                }
            }
        }

        const existingConfig = resolveScoringConfiguration(job.scoringConfiguration);
        const resolvedAiAssistWeight = body.aiAssistWeight !== undefined
            ? toNumber(body.aiAssistWeight)
            : existingConfig.aiAssistWeight;
        const resolvedProblemSolvingWeight = body.problemSolvingWeight !== undefined
            ? toNumber(body.problemSolvingWeight)
            : existingConfig.problemSolvingWeight;
        const resolvedExperienceWeight = body.experienceWeight !== undefined
            ? toNumber(body.experienceWeight)
            : existingConfig.experienceWeight;
        const resolvedCodingWeight = body.codingWeight !== undefined
            ? toNumber(body.codingWeight)
            : existingConfig.codingWeight;

        // Ensure coding score never receives a negative category contribution.
        if (resolvedAiAssistWeight + resolvedProblemSolvingWeight > 100) {
            return NextResponse.json(
                { error: "aiAssistWeight + problemSolvingWeight must be less than or equal to 100" },
                { status: 400 }
            );
        }

        // Validate category weights sum to 100 (supports partial updates too)
        if (Math.abs((resolvedExperienceWeight + resolvedCodingWeight) - 100) > 0.01) {
            return NextResponse.json(
                { error: "Experience weight and coding weight must sum to 100" },
                { status: 400 }
            );
        }

        // Validate thresholds are sensible
        if (
            body.iterationSpeedThresholdModerate !== undefined &&
            body.iterationSpeedThresholdHigh !== undefined
        ) {
            const moderate = toNumber(body.iterationSpeedThresholdModerate);
            const high = toNumber(body.iterationSpeedThresholdHigh);
            if (moderate >= high) {
                return NextResponse.json(
                    { error: "Iteration speed moderate threshold must be less than high threshold" },
                    { status: 400 }
                );
            }
        }

        // Build update data
        const updates: any = {};
        const updateableFields = [
            ...weightFields,
            'iterationSpeedThresholdModerate',
            'iterationSpeedThresholdHigh',
        ];

        for (const field of updateableFields) {
            if (body[field] !== undefined) {
                updates[field] = toNumber(body[field]);
            }
        }

        // Upsert configuration
        const config = await prisma.scoringConfiguration.upsert({
            where: { jobId },
            create: {
                jobId,
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
