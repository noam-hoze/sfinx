import { NextRequest, NextResponse } from "next/server";
import { prisma } from "app/shared/services/server";
import { mergeWithPredefinedCategories, type CodingCategory } from "app/api/company/jobs/categorySchemas";

type RouteContext = {
    params: Promise<{ id?: string | string[] }>;
};

function normalizeJobId(id: string | string[] | undefined) {
    if (Array.isArray(id)) {
        return id[0] ?? "";
    }
    return id ?? "";
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const jobId = normalizeJobId(id);

        if (!jobId) {
            return NextResponse.json(
                { error: "Job id is required" },
                { status: 400 }
            );
        }
        const job = await (prisma as any).job.findUnique({
            where: { id: jobId },
            include: { company: true, interviewContent: true },
        });

        if (!job) {
            return NextResponse.json(
                { error: "Job not found" },
                { status: 404 }
            );
        }

        // Merge predefined Problem Solving category
        const mergedCodingCategories = mergeWithPredefinedCategories(job.codingCategories as CodingCategory[] | null);
        
        return NextResponse.json({ 
            job: {
                ...job,
                codingCategories: mergedCodingCategories
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                error: `Failed to fetch job: ${
                    error?.message || String(error)
                }`,
            },
            { status: 500 }
        );
    }
}
