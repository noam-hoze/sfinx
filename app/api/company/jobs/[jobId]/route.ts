import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { prisma } from "app/shared/services/prisma";
import { log } from "app/shared/services";
import { loadCompanyForUser } from "../companyContext";
import { mapJobResponse } from "../route";

type RouteContext = {
    params: Promise<{ jobId?: string | string[] }>;
};

function ensureCompanyRole(session: any) {
    const role = session?.user?.role;
    if (role !== "COMPANY") {
        throw new Error("Company role required");
    }
}

function normalizeJobId(jobId: string | string[] | undefined) {
    if (Array.isArray(jobId)) {
        if (jobId.length === 0) {
            return "";
        }
        const first = jobId[0];
        if (typeof first === "string") {
            return first;
        }
        return "";
    }
    if (typeof jobId === "string") {
        return jobId;
    }
    return "";
}

async function assertOwnership(userId: string, jobId: string) {
    const { company } = await loadCompanyForUser(userId);
    const job = await (prisma as any).job.findUnique({
        where: { id: jobId },
        include: {
            company: true,
            interviewContent: true,
        },
    });
    if (!job) {
        throw new Error("Job not found");
    }
    if (job.companyId !== company.id) {
        throw new Error("Forbidden");
    }
    return { job, company };
}

export async function GET(_request: NextRequest, context: RouteContext) {
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

        const { job, company } = await assertOwnership(userId, jobId);
        return NextResponse.json(mapJobResponse(job, company));
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const status = (() => {
            if (message === "Company role required") {
                return 403;
            }
            if (message === "Company profile not found for user") {
                return 404;
            }
            if (message === "Company record not found for profile") {
                return 404;
            }
            if (message === "Job not found") {
                return 404;
            }
            if (message === "Forbidden") {
                return 403;
            }
            return 500;
        })();
        log.error("❌ Failed to fetch company job detail:", error);
        return NextResponse.json({ error: message }, { status });
    }
}

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
        const updates: any = {};

        if (Object.prototype.hasOwnProperty.call(body, "title")) {
            const title = body.title;
            if (typeof title !== "string" || title.trim().length === 0) {
                throw new Error("Job title is required");
            }
            updates.title = title.trim();
        }
        if (Object.prototype.hasOwnProperty.call(body, "location")) {
            const location = body.location;
            if (typeof location !== "string" || location.trim().length === 0) {
                throw new Error("Job location is required");
            }
            updates.location = location.trim();
        }
        if (Object.prototype.hasOwnProperty.call(body, "type")) {
            const type = body.type;
            if (typeof type !== "string" || type.trim().length === 0) {
                throw new Error("Job type is required");
            }
            updates.type = type.trim();
        }
        if (Object.prototype.hasOwnProperty.call(body, "salary")) {
            const salary =
                typeof body.salary === "string" ? body.salary : null;
            updates.salary = salary;
        }
        if (Object.prototype.hasOwnProperty.call(body, "description")) {
            const description =
                typeof body.description === "string"
                    ? body.description
                    : null;
            updates.description = description;
        }
        if (Object.prototype.hasOwnProperty.call(body, "requirements")) {
            const requirements =
                typeof body.requirements === "string"
                    ? body.requirements
                    : null;
            updates.requirements = requirements;
        }

    const { job, company } = await assertOwnership(userId, jobId);

        const interview = body.interviewContent;
        let interviewContentId = job.interviewContentId;
        if (interview !== undefined) {
            if (interview === null) {
                if (interviewContentId) {
                    const usageCount = await (prisma as any).job.count({
                        where: { interviewContentId },
                    });
                    await (prisma as any).job.updateMany({
                        where: { id: job.id },
                        data: { interviewContentId: null },
                    });
                    if (usageCount === 1) {
                        await (prisma as any).interviewContent.delete({
                            where: { id: interviewContentId },
                        });
                    }
                    interviewContentId = null;
                }
            } else {
                const codingPrompt =
                    typeof interview.codingPrompt === "string"
                        ? interview.codingPrompt.trim()
                        : "";
                if (codingPrompt.length === 0) {
                    throw new Error("Coding prompt is required for interview content");
                }
                const payload = {
                    backgroundQuestion:
                        typeof interview.backgroundQuestion === "string"
                            ? interview.backgroundQuestion
                            : null,
                    codingPrompt,
                    codingTemplate:
                        typeof interview.codingTemplate === "string"
                            ? interview.codingTemplate
                            : null,
                    codingAnswer:
                        typeof interview.codingAnswer === "string"
                            ? interview.codingAnswer
                            : null,
                };
                if (interviewContentId) {
                    await (prisma as any).interviewContent.update({
                        where: { id: interviewContentId },
                        data: payload,
                    });
                } else {
                    const createdContent = await (prisma as any).interviewContent.create({
                        data: payload,
                    });
                    interviewContentId = createdContent.id;
                }
                updates.interviewContentId = interviewContentId;
            }
        }

        let updated = job;
        if (Object.keys(updates).length > 0) {
            updated = await (prisma as any).job.update({
                where: { id: job.id },
                data: updates,
                include: {
                    company: true,
                    interviewContent: true,
                },
            });
        } else if (interview !== undefined) {
            updated = await (prisma as any).job.findUniqueOrThrow({
                where: { id: job.id },
                include: {
                    company: true,
                    interviewContent: true,
                },
            });
        }

        return NextResponse.json(mapJobResponse(updated, updated.company));
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const status = (() => {
            if (message === "Company role required") {
                return 403;
            }
            if (message === "Job not found") {
                return 404;
            }
            if (message === "Forbidden") {
                return 403;
            }
            if (message === "Job title is required") {
                return 400;
            }
            if (message === "Job location is required") {
                return 400;
            }
            if (message === "Job type is required") {
                return 400;
            }
            if (message === "Coding prompt is required for interview content") {
                return 400;
            }
            if (message === "Company profile not found for user") {
                return 404;
            }
            if (message === "Company record not found for profile") {
                return 404;
            }
            return 500;
        })();
        log.error("❌ Failed to update company job:", error);
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
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

        const { job } = await assertOwnership(userId, jobId);
        const interviewContentId = job.interviewContentId;

        await (prisma as any).job.delete({
            where: { id: job.id },
        });

        if (interviewContentId) {
            const remaining = await (prisma as any).job.count({
                where: { interviewContentId },
            });
            if (remaining === 0) {
                await (prisma as any).interviewContent.delete({
                    where: { id: interviewContentId },
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const status = (() => {
            if (message === "Company role required") {
                return 403;
            }
            if (message === "Job not found") {
                return 404;
            }
            if (message === "Forbidden") {
                return 403;
            }
            if (message === "Company profile not found for user") {
                return 404;
            }
            if (message === "Company record not found for profile") {
                return 404;
            }
            return 500;
        })();
        log.error("❌ Failed to delete company job:", error);
        return NextResponse.json({ error: message }, { status });
    }
}

