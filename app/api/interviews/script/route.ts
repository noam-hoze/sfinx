import { NextRequest, NextResponse } from "next/server";
import { prisma } from "app/shared/services/prisma";
import { mergeWithPredefinedCategories, type CodingCategory } from "app/api/company/jobs/categorySchemas";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const jobIdParam = searchParams.get("jobId");
        const companyIdParam = searchParams.get("companyId");
        const companyParam = searchParams.get("company");
        const roleParam = searchParams.get("role");

        let jobId = jobIdParam;
        if (!jobId) {
            if (!companyParam) {
                return NextResponse.json(
                    { error: "Missing jobId query parameter" },
                    { status: 400 }
                );
            }
            if (!roleParam) {
                return NextResponse.json(
                    { error: "Missing role query parameter" },
                    { status: 400 }
                );
            }
            const company = companyParam.toLowerCase();
            const role = roleParam.toLowerCase();
            jobId = `${company}-${role}`;
        }

        if (!jobId) {
            return NextResponse.json(
                { error: "Missing jobId query parameter" },
                { status: 400 }
            );
        }
        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: { interviewContent: true, company: true },
        });
        if (!job) {
            throw new Error(`Job not found for ${jobId}`);
        }
        if (companyIdParam && job.companyId !== companyIdParam) {
            return NextResponse.json(
                { error: "Job does not belong to this company" },
                { status: 404 }
            );
        }
        const interview = job.interviewContent;
        if (!interview) {
            throw new Error(`Interview content missing for job ${jobId}`);
        }
        
        const mergedCodingCategories = mergeWithPredefinedCategories(job.codingCategories as CodingCategory[] | null);
        
        return NextResponse.json({
            backgroundQuestion: interview.backgroundQuestion,
            backgroundQuestionCategory: interview.backgroundQuestionCategory,
            codingPrompt: interview.codingPrompt,
            codingTemplate: interview.codingTemplate,
            codingAnswer: interview.codingAnswer,
            expectedOutput: interview.expectedOutput,
            codingLanguage: interview.codingLanguage,
            backgroundQuestionTimeSeconds:
                interview.backgroundQuestionTimeSeconds,
            codingQuestionTimeSeconds: interview.codingQuestionTimeSeconds,
            codingCategories: mergedCodingCategories,
            experienceCategories: job.experienceCategories,
            companyId: job.companyId,
            companyName: job.company.name,
            jobId: job.id,
            jobTitle: job.title,
        });
    } catch (error: any) {
        const details = error?.message ? String(error.message) : undefined;
        return NextResponse.json(
            {
                error: "Script not found",
                details,
            },
            { status: 404 }
        );
    }
}
