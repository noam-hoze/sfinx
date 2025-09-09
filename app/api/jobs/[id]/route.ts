import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const jobId = params.id;
        const job = await (prisma as any).job.findUnique({
            where: { id: jobId },
            include: { company: true },
        });

        if (!job) {
            return NextResponse.json(
                { error: "Job not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ job });
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
