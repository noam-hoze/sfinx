import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, getCached, prisma, setCached } from "app/shared/services/server";
import {
    deriveCandidateDisplayStatus,
    isActiveDashboardStatus,
    isCompletedDashboardStatus,
    isRealtimeInterviewStatus,
    type CandidateApplicationStatus,
    type CandidateInterviewStatus,
} from "app/shared/utils/candidateDashboard";

interface DashboardInterviewRecord {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    duration: number | null;
    createdAt: string;
    updatedAt: string;
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!(session?.user as any)?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = (session.user as any).id as string;
        const cacheKey = `candidate-dashboard:${userId}`;
        const cached = await getCached<any>(cacheKey);

        if (cached) {
            return NextResponse.json(cached);
        }

        const applications = await prisma.application.findMany({
            where: {
                candidateId: userId,
                status: { not: "WARMUP" },
            },
            include: {
                job: {
                    include: {
                        company: true,
                    },
                },
                interviewSessions: {
                    orderBy: {
                        createdAt: "desc",
                    },
                    select: {
                        id: true,
                        status: true,
                        startedAt: true,
                        completedAt: true,
                        duration: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
            orderBy: {
                appliedAt: "desc",
            },
        });

        const applicationCards = applications
            .map((application) => {
                const interviews: DashboardInterviewRecord[] = application.interviewSessions.map(
                    (interview) => ({
                        id: interview.id,
                        status: interview.status,
                        startedAt: interview.startedAt.toISOString(),
                        completedAt: interview.completedAt?.toISOString() ?? null,
                        duration: interview.duration,
                        createdAt: interview.createdAt.toISOString(),
                        updatedAt: interview.updatedAt.toISOString(),
                    })
                );

                const latestInterview = interviews[0] ?? null;
                const latestInterviewStatus =
                    (latestInterview?.status as CandidateInterviewStatus) ?? null;
                const displayStatus = deriveCandidateDisplayStatus(
                    application.status as CandidateApplicationStatus,
                    latestInterviewStatus
                );
                const latestActivity = latestInterview
                    ? latestInterview.updatedAt
                    : application.appliedAt.toISOString();

                return {
                    id: application.id,
                    rawStatus: application.status,
                    displayStatus,
                    appliedAt: application.appliedAt.toISOString(),
                    updatedAt: application.updatedAt.toISOString(),
                    latestActivityAt: latestActivity,
                    job: application.job
                        ? {
                              id: application.job.id,
                              title: application.job.title,
                              location: application.job.location,
                              type: application.job.type,
                          }
                        : null,
                    company: application.job?.company
                        ? {
                              id: application.job.company.id,
                              name: application.job.company.name,
                              logo: application.job.company.logo,
                          }
                        : null,
                    latestInterview,
                    interviews,
                };
            })
            .sort(
                (left, right) =>
                    new Date(right.latestActivityAt).getTime() -
                    new Date(left.latestActivityAt).getTime()
            );

        const summary = {
            totalApplications: applicationCards.length,
            completedInterviews: applicationCards.filter((application) =>
                isCompletedDashboardStatus(application.displayStatus.label)
            ).length,
            activeItems: applicationCards.filter((application) =>
                isActiveDashboardStatus(application.displayStatus.label)
            ).length,
            finalDecisions: applicationCards.filter(
                (application) => application.displayStatus.isFinal
            ).length,
        };

        const payload = {
            summary,
            applications: applicationCards,
        };

        const hasActiveRealtimeSession = applicationCards.some((application) =>
            isRealtimeInterviewStatus(
                (application.latestInterview?.status as CandidateInterviewStatus) ?? null
            )
        );

        if (!hasActiveRealtimeSession) {
            await setCached(cacheKey, payload);
        }

        return NextResponse.json(payload);
    } catch (error) {
        console.error("Error fetching candidate dashboard:", error);
        return NextResponse.json(
            { error: "Failed to fetch candidate dashboard" },
            { status: 500 }
        );
    }
}
