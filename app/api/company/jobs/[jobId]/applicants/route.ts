import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getCached, setCached } from "app/shared/services/server";
import prisma from "lib/prisma";
import { extractTopHighlights } from "../highlightUtils";

/**
 * GET /api/company/jobs/[jobId]/applicants
 * Fetch all applicants for a specific job.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "COMPANY" && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { jobId } = await context.params;

    const cacheKey = `applicants:job:${jobId}`;
    const cached = await getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch job details
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        scoringConfiguration: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Verify the job belongs to the company user
    const userId = (session.user as any).id;
    
    // Get company profile to find company name
    const companyProfile = await prisma.companyProfile.findUnique({
      where: { userId },
    });

    if (!companyProfile) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 404 }
      );
    }

    // Get company by name
    const company = await prisma.company.findUnique({
      where: { name: companyProfile.companyName },
      select: { id: true },
    });

    if (!company || company.id !== job.companyId) {
      return NextResponse.json(
        { error: "You do not have access to this job" },
        { status: 403 }
      );
    }

    // Fetch all applications for this job
    const applications = await prisma.application.findMany({
      where: { jobId },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            image: true,
            email: true,
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
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        appliedAt: "desc",
      },
    });

    // Transform to applicant format
    const applicants = applications
      .map((app) => {
        const latestSession = app.interviewSessions[0];
        const matchScore = latestSession?.finalScore ?? null;
        const highlights = extractTopHighlights(latestSession);

        return {
          id: app.candidate.id,
          name: app.candidate.name || "Unknown",
          email: app.candidate.email,
          image: app.candidate.image,
          matchScore,
          appliedAt: app.appliedAt.toISOString(),
          interviewCompleted: !!latestSession,
          applicationId: app.id,
          highlights,
        };
      })
      .sort((a, b) => {
        if (a.matchScore === null) return 1;
        if (b.matchScore === null) return -1;
        return b.matchScore - a.matchScore;
      });

    const result = {
      job: {
        id: job.id,
        title: job.title,
        location: job.location,
        type: job.type,
      },
      applicants,
    };

    await setCached(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching job applicants:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

