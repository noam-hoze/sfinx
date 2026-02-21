import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, prisma, getCached, setCached } from "app/shared/services/server";
import { extractTopHighlights } from "../jobs/highlightUtils";

/**
 * GET /api/company/applicants
 * Returns ALL applicants across ALL company jobs with scores, highlights, and job info.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "COMPANY") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!companyProfile) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 404 }
      );
    }

    const cacheKey = `applicants:company:${companyProfile.companyName}:all`;
    const cached = await getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const company = await prisma.company.findUnique({
      where: { name: companyProfile.companyName },
      include: {
        jobs: {
          include: {
            applications: {
              include: {
                candidate: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
                interviewSessions: {
                  select: {
                    id: true,
                    finalScore: true,
                    createdAt: true,
                    telemetryData: {
                      include: {
                        backgroundSummary: true,
                        codingSummary: true,
                      },
                    },
                  },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
              orderBy: { appliedAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Flatten all applications across all jobs
    const applicants = company.jobs
      .flatMap((job) =>
        job.applications.map((app) => {
          const latestSession = app.interviewSessions[0];
          return {
            id: app.candidate.id,
            name: app.candidate.name || "Unknown",
            email: app.candidate.email,
            image: app.candidate.image,
            matchScore: latestSession?.finalScore ?? null,
            highlights: extractTopHighlights(latestSession),
            interviewCompleted: !!latestSession,
            applicationId: app.id,
            jobId: job.id,
            jobTitle: job.title,
            appliedAt: app.appliedAt.toISOString(),
          };
        })
      )
      .sort((a, b) => {
        // Completed first (by score desc), then pending (by date desc)
        if (a.interviewCompleted && !b.interviewCompleted) return -1;
        if (!a.interviewCompleted && b.interviewCompleted) return 1;
        if (a.interviewCompleted && b.interviewCompleted) {
          if (a.matchScore === null) return 1;
          if (b.matchScore === null) return -1;
          return b.matchScore - a.matchScore;
        }
        return new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime();
      });

    const jobs = company.jobs.map((job) => ({
      id: job.id,
      title: job.title,
      isActive: job.isActive,
    }));

    const totalApplicants = applicants.length;
    const totalInterviewed = applicants.filter((a) => a.interviewCompleted).length;
    const activeJobsCount = company.jobs.filter((j) => j.isActive).length;
    const conversionPct =
      totalApplicants > 0
        ? Math.round((totalInterviewed / totalApplicants) * 100)
        : 0;

    const result = {
      applicants,
      jobs,
      stats: {
        totalApplicants,
        totalInterviewed,
        activeJobsCount,
        conversionPct,
      },
    };

    await setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching all applicants:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
