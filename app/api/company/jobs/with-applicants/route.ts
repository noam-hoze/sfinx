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
        // Calculate scores from interview sessions
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

    return NextResponse.json({ jobs: jobsWithApplicants });
}

