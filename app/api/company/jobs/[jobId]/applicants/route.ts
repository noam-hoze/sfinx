import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getCached, setCached } from "app/shared/services/server";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import prisma from "lib/prisma";

const LOG_CATEGORY = LOG_CATEGORIES.COMPANY;

/**
 * Extracts top 2-3 category highlights from interview session data.
 */
function extractTopHighlights(session: any): string[] {
  const telemetryArray = Array.isArray(session?.telemetryData) 
    ? session.telemetryData 
    : session?.telemetryData ? [session.telemetryData] : [];
  
  if (telemetryArray.length === 0) {
    return [];
  }

  const telemetry = telemetryArray[0];
  const allCategories: Array<{ name: string; score: number }> = [];

  if (telemetry.backgroundSummary?.experienceCategories) {
    const expCats = telemetry.backgroundSummary.experienceCategories;
    Object.entries(expCats).forEach(([key, value]: [string, any]) => {
      if (value?.score != null) {
        allCategories.push({ name: value.name || key, score: value.score });
      }
    });
  }

  if (telemetry.codingSummary?.jobSpecificCategories) {
    const codeCats = telemetry.codingSummary.jobSpecificCategories;
    Object.entries(codeCats).forEach(([key, value]: [string, any]) => {
      if (value?.score != null) {
        allCategories.push({ name: value.name || key, score: value.score });
      }
    });
  }

  const result = allCategories
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => c.name);
  
  return result;
}

/**
 * GET /api/company/jobs/[jobId]/applicants
 * Fetch all applicants for a specific job.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const requestId = request.headers.get("x-request-id");
  let jobId: string | undefined;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "COMPANY" && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await context.params;
    jobId = params.jobId;

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
    const applicants = applications.map((app) => {
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
    log.error(LOG_CATEGORY, "Error fetching job applicants", {
      requestId,
      jobId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
