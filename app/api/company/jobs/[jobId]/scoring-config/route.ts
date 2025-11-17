import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "app/shared/services/auth";
import prisma from "lib/prisma";
import { log } from "app/shared/services";

interface RouteContext {
    params: Promise<{ jobId: string }>;
}

function normalizeJobId(jobId: string | string[] | undefined): string {
    if (Array.isArray(jobId)) return jobId[0] ?? "";
    return jobId ?? "";
}

function ensureCompanyRole(session: any) {
    const user = session?.user as { role?: string } | undefined;
    if (user?.role !== "COMPANY") {
        throw new Error("Only company users can access this resource");
    }
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
                log.info(`[scoring-config/GET] Created default configuration for job ${jobId}`);
            }

            return NextResponse.json({ config });
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
        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: {
                company: true,
                scoringConfiguration: true,
            },
        });

        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        if (job.company.userId !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // If no configuration exists, create default
        let config = job.scoringConfiguration;
        if (!config) {
            config = await prisma.scoringConfiguration.create({
                data: { jobId },
            });
            log.info(`[scoring-config/GET] Created default configuration for job ${jobId}`);
        }

        return NextResponse.json({ config });
    } catch (error: any) {
        log.error("[scoring-config/GET] Error:", error);
        const message = error.message || "Failed to fetch scoring configuration";
        const status = error.message?.includes("Forbidden") ? 403 : 500;
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
        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: {
                company: true,
            },
        });

        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        if (job.company.userId !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Validate weights are positive numbers
        const weightFields = [
            'adaptabilityWeight',
            'creativityWeight',
            'reasoningWeight',
            'codeQualityWeight',
            'problemSolvingWeight',
            'independenceWeight',
            'iterationSpeedWeight',
            'debugLoopsWeight',
            'aiAssistWeight',
            'experienceWeight',
            'codingWeight',
        ];

        for (const field of weightFields) {
            if (body[field] !== undefined) {
                const value = Number(body[field]);
                if (isNaN(value) || value < 0) {
                    return NextResponse.json(
                        { error: `${field} must be a positive number` },
                        { status: 400 }
                    );
                }
            }
        }

        // Validate category weights sum to 100 (with tolerance for floating point)
        if (body.experienceWeight !== undefined && body.codingWeight !== undefined) {
            const sum = Number(body.experienceWeight) + Number(body.codingWeight);
            if (Math.abs(sum - 100) > 0.01) {
                return NextResponse.json(
                    { error: "Experience weight and coding weight must sum to 100" },
                    { status: 400 }
                );
            }
        }

        // Validate thresholds are sensible
        if (
            body.iterationSpeedThresholdModerate !== undefined &&
            body.iterationSpeedThresholdHigh !== undefined
        ) {
            const moderate = Number(body.iterationSpeedThresholdModerate);
            const high = Number(body.iterationSpeedThresholdHigh);
            if (moderate >= high) {
                return NextResponse.json(
                    { error: "Iteration speed moderate threshold must be less than high threshold" },
                    { status: 400 }
                );
            }
        }

        if (
            body.debugLoopsDepthThresholdFast !== undefined &&
            body.debugLoopsDepthThresholdModerate !== undefined
        ) {
            const fast = Number(body.debugLoopsDepthThresholdFast);
            const moderate = Number(body.debugLoopsDepthThresholdModerate);
            if (fast >= moderate) {
                return NextResponse.json(
                    { error: "Debug loops fast threshold must be less than moderate threshold" },
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
            'debugLoopsDepthThresholdFast',
            'debugLoopsDepthThresholdModerate',
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
                ...updates,
            },
            update: updates,
        });

        log.info(`[scoring-config/PUT] Updated configuration for job ${jobId}`);

        return NextResponse.json({ config });
    } catch (error: any) {
        log.error("[scoring-config/PUT] Error:", error);
        const message = error.message || "Failed to update scoring configuration";
        const status = error.message?.includes("Forbidden") ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

