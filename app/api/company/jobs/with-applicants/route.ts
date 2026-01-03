import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "app/shared/services/auth";
import { prisma } from "app/shared/services";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "COMPANY") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyProfile = await prisma.companyProfile.findUnique({
        where: { userId: session.user.id },
    });

    if (!companyProfile) {
        return NextResponse.json({ error: "Company profile not found" }, { status: 404 });
    }

    const company = await prisma.company.findUnique({
        where: { name: companyProfile.companyName },
        include: {
            jobs: {
                include: {
                    _count: {
                        select: { applications: true },
                    },
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!company) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const jobsWithApplicants = company.jobs.map((job) => ({
        id: job.id,
        title: job.title,
        location: job.location,
        type: job.type,
        isActive: job.isActive,
        applicantCount: job._count.applications,
    }));

    return NextResponse.json({ jobs: jobsWithApplicants });
}

