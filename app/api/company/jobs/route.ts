import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { prisma } from "app/shared/services/prisma";
import { log } from "app/shared/services";
import { loadCompanyForUser } from "./companyContext";
import { coerceSeconds, mapJobResponse } from "./jobHelpers";

function ensureCompanyRole(session: any) {
    const role = session?.user?.role;
    if (role !== "COMPANY") {
        throw new Error("Company role required");
    }
}

export async function GET(_request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const sessionUser = session?.user as { id?: string; role?: string } | undefined;
        if (!sessionUser?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        ensureCompanyRole(session);
        const userId = String(sessionUser.id);

        const { company } = await loadCompanyForUser(userId);
        const jobs = await (prisma as any).job.findMany({
            where: { companyId: company.id },
            orderBy: { createdAt: "desc" },
            include: {
                interviewContent: true,
            },
        });

        return NextResponse.json({
            company: {
                id: company.id,
                name: company.name,
                logo: company.logo,
                industry: company.industry,
                size: company.size,
            },
            jobs: jobs.map((job: any) => mapJobResponse(job, company)),
        });
    } catch (error) {
        log.error("❌ Failed to list company jobs:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        const status = message === "Company role required" ? 403 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const sessionUser = session?.user as { id?: string; role?: string } | undefined;
        if (!sessionUser?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        ensureCompanyRole(session);
        const userId = String(sessionUser.id);

        const body = await request.json();
        const title = body.title;
        const location = body.location;
        const type = body.type;
        if (typeof title !== "string" || title.trim().length === 0) {
            throw new Error("Job title is required");
        }
        if (typeof location !== "string" || location.trim().length === 0) {
            throw new Error("Job location is required");
        }
        if (typeof type !== "string" || type.trim().length === 0) {
            throw new Error("Job type is required");
        }
        const description =
            typeof body.description === "string" ? body.description : null;
        const salary = typeof body.salary === "string" ? body.salary : null;
        const requirements =
            typeof body.requirements === "string" ? body.requirements : null;

        const { company } = await loadCompanyForUser(userId);
        let interviewContentId: string | undefined;
        const interview = body.interviewContent;
        if (interview && typeof interview === "object") {
            const background =
                typeof interview.backgroundQuestion === "string"
                    ? interview.backgroundQuestion
                    : null;
            const codingPromptRaw =
                typeof interview.codingPrompt === "string"
                    ? interview.codingPrompt.trim()
                    : "";
            const codingTemplate =
                typeof interview.codingTemplate === "string"
                    ? interview.codingTemplate
                    : null;
            const codingAnswer =
                typeof interview.codingAnswer === "string"
                    ? interview.codingAnswer
                    : null;
            const hasContent =
                (background && background.trim().length > 0) ||
                codingPromptRaw.length > 0 ||
                (codingTemplate && codingTemplate.trim().length > 0) ||
                (codingAnswer && codingAnswer.trim().length > 0);
            if (hasContent) {
                if (codingPromptRaw.length === 0) {
                    throw new Error("Coding prompt is required for interview content");
                }
                const created = await (prisma as any).interviewContent.create({
                    data: {
                        backgroundQuestion:
                            background && background.trim().length > 0
                                ? background
                                : null,
                        codingPrompt: codingPromptRaw,
                        codingTemplate:
                            codingTemplate && codingTemplate.trim().length > 0
                                ? codingTemplate
                                : null,
                        codingAnswer:
                            codingAnswer && codingAnswer.trim().length > 0
                                ? codingAnswer
                                : null,
                        backgroundQuestionTimeSeconds: coerceSeconds(
                            (interview as any).backgroundQuestionTimeSeconds,
                            900
                        ),
                        codingQuestionTimeSeconds: coerceSeconds(
                            (interview as any).codingQuestionTimeSeconds,
                            1800
                        ),
                    },
                });
                interviewContentId = created.id;
            }
        }
        if (interview && typeof interview === "object" && !interviewContentId) {
            const background =
                typeof interview.backgroundQuestion === "string"
                    ? interview.backgroundQuestion
                    : null;
            const codingPromptRaw =
                typeof interview.codingPrompt === "string"
                    ? interview.codingPrompt.trim()
                    : "";
            const codingTemplate =
                typeof interview.codingTemplate === "string"
                    ? interview.codingTemplate
                    : null;
            const codingAnswer =
                typeof interview.codingAnswer === "string"
                    ? interview.codingAnswer
                    : null;
            const hasContent =
                (background && background.trim().length > 0) ||
                codingPromptRaw.length > 0 ||
                (codingTemplate && codingTemplate.trim().length > 0) ||
                (codingAnswer && codingAnswer.trim().length > 0);
            if (hasContent && codingPromptRaw.length === 0) {
                throw new Error("Coding prompt is required for interview content");
            }
            if (hasContent) {
                throw new Error("Failed to create interview content");
            }
        }

        const data: any = {
            title: title.trim(),
            location: location.trim(),
            type: type.trim(),
            description,
            salary,
            requirements,
            companyId: company.id,
        };
        if (interviewContentId) {
            data.interviewContentId = interviewContentId;
        }

        const job = await (prisma as any).job.create({
            data,
            include: {
                interviewContent: true,
                company: true,
            },
        });

        return NextResponse.json(mapJobResponse(job, job.company));
    } catch (error) {
        log.error("❌ Failed to create company job:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        const status = (() => {
            if (message === "Company role required") {
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
            if (message === "Company profile not found for user") {
                return 404;
            }
            if (message === "Company record not found for profile") {
                return 404;
            }
            return 500;
        })();
        return NextResponse.json({ error: message }, { status });
    }
}

