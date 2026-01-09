import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, prisma, getCached, setCached } from "app/shared/services/server";
import { calculateScore, type RawScores, type WorkstyleMetrics } from "app/shared/utils/calculateScore";

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
                    scoringConfiguration: true,
                    applications: {
                        include: {
                            interviewSessions: {
                                include: {
                                    telemetryData: {
                                        include: {
                                            backgroundSummary: true,
                                            codingSummary: true,
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
            .map(session => {
                const telemetry = session.telemetryData;
                if (!telemetry?.backgroundSummary || !telemetry?.codingSummary || !job.scoringConfiguration) {
                    return null;
                }

                try {
                    const jobExperienceCategories = (job.experienceCategories as any) || [];
                    const backgroundExperienceCategories = (telemetry.backgroundSummary.experienceCategories as any) || {};
                    const experienceScores = jobExperienceCategories.map((cat: any) => ({
                        name: cat.name,
                        score: backgroundExperienceCategories[cat.name]?.score || 0,
                        weight: cat.weight || 1
                    }));

                    const jobCodingCategories = (job.codingCategories as any) || [];
                    const codingCategoriesData = (telemetry.codingSummary.jobSpecificCategories as any) || {};
                    const categoryScores = jobCodingCategories.map((cat: any) => ({
                        name: cat.name,
                        score: codingCategoriesData[cat.name]?.score || 0,
                        weight: cat.weight || 1
                    }));

                    const rawScores: RawScores = { experienceScores, categoryScores };
                    const workstyleMetrics: WorkstyleMetrics = { aiAssistAccountabilityScore: undefined };

                    const result = calculateScore(rawScores, workstyleMetrics, job.scoringConfiguration as any);
                    return result.finalScore;
                } catch (error) {
                    console.error('[with-applicants] Score calculation error:', error);
                    return null;
                }
            })
            .filter((score): score is number => score !== null && score !== undefined);

        const highestScore = scores.length > 0 ? Math.round(Math.max(...scores)) : null;
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

