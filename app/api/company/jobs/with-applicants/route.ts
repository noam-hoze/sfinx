import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, prisma, getCached, setCached } from "app/shared/services/server";

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

    const cacheKey = `jobs:company:${companyProfile.companyName}:with-applicants`;
    const cached = await getCached<{ jobs: any[] }>(cacheKey);
    if (cached) {
        return NextResponse.json(cached);
    }

    const company = await prisma.company.findUnique({
        where: { name: companyProfile.companyName },
        include: {
            jobs: {
                include: {
                    _count: {
                        select: { applications: true },
                    },
                    applications: {
                        include: {
                            interviewSessions: {
                                include: {
                                    telemetryData: {
                                        select: {
                                            matchScore: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!company) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const jobsWithApplicants = company.jobs.map((job) => {
        const scores = job.applications
            .flatMap(app => app.interviewSessions)
            .map(session => session.telemetryData?.matchScore)
            .filter((score): score is number => score !== null && score !== undefined);

        const highestScore = scores.length > 0 ? Math.max(...scores) : null;
        const averageScore = scores.length > 0 
            ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
            : null;

        return {
            id: job.id,
            title: job.title,
            isActive: job.isActive,
            applicantCount: job._count.applications,
            highestScore,
            averageScore,
            interviewedCount: scores.length,
        };
    });

    const result = { jobs: jobsWithApplicants };
    await setCached(cacheKey, result);
    return NextResponse.json(result);
}

