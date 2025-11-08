import { NextRequest, NextResponse } from "next/server";
import { prisma } from "app/shared/services/prisma";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const companyParam = searchParams.get("company");
        if (!companyParam) {
            return NextResponse.json(
                { error: "Missing company query parameter" },
                { status: 400 }
            );
        }
        const roleParam = searchParams.get("role");
        if (!roleParam) {
            return NextResponse.json(
                { error: "Missing role query parameter" },
                { status: 400 }
            );
        }
        const company = companyParam.toLowerCase();
        const role = roleParam.toLowerCase();
        const jobId = `${company}-${role}`;
        const job = await prisma.job.findUnique({
            where: { id: jobId },
            include: {
                interviewContent: true,
            },
        });
        if (!job) {
            throw new Error(`Job not found for ${jobId}`);
        }
        const interview = job.interviewContent;
        if (!interview) {
            throw new Error(`Interview content missing for job ${jobId}`);
        }
        return NextResponse.json({
            backgroundQuestion: interview.backgroundQuestion,
            codingPrompt: interview.codingPrompt,
            codingTemplate: interview.codingTemplate,
            codingAnswer: interview.codingAnswer,
            backgroundQuestionTimeSeconds:
                interview.backgroundQuestionTimeSeconds,
            codingQuestionTimeSeconds: interview.codingQuestionTimeSeconds,
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
