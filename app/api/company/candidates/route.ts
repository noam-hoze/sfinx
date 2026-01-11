import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { log } from "app/shared/services";
import { authOptions, prisma } from "app/shared/services/server";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.COMPANY;

export async function GET(request: NextRequest) {
    try {
        log.info(LOG_CATEGORY, "🔍 Company candidates API called");

        const session = await getServerSession(authOptions);
        log.info(LOG_CATEGORY, "🔍 Session:", session ? "Found" : "Not found");

        if (!(session?.user as any)?.id) {
            log.warn(LOG_CATEGORY, "❌ No user ID in session");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session!.user as any).id;
        log.info(LOG_CATEGORY, "✅ User ID:", userId);

        // Get the user's company profile
        log.info(LOG_CATEGORY, "🏢 Looking for company profile...");
        const companyProfile = await prisma.companyProfile.findUnique({
            where: { userId: userId },
        });

        if (!companyProfile) {
            log.warn(LOG_CATEGORY, "❌ Company profile not found for user:", userId);
            return NextResponse.json(
                { error: "Company profile not found" },
                { status: 404 }
            );
        }

        log.info(LOG_CATEGORY, "✅ Company profile found:", companyProfile.companyName);

        const { searchParams } = new URL(request.url);
        const jobRole = searchParams.get("jobRole");

        // Find the company by name
        log.info(LOG_CATEGORY, "🏢 Looking for company:", companyProfile.companyName);
        const company = await prisma.company.findUnique({
            where: { name: companyProfile.companyName },
        });

        if (!company) {
            log.warn(LOG_CATEGORY, "❌ Company not found:", companyProfile.companyName);
            return NextResponse.json(
                { error: "Company not found" },
                { status: 404 }
            );
        }

        log.info(LOG_CATEGORY, "✅ Company found:", company.id);

        // Find all jobs for this company
        log.info(LOG_CATEGORY, "💼 Looking for jobs...");
        const jobs = await prisma.job.findMany({
            where: { companyId: company.id },
            select: { id: true },
        });

        log.info(LOG_CATEGORY, "✅ Found", jobs.length, "jobs");
        const jobIds = jobs.map((job) => job.id);

        // Get all applications for this company's jobs
        log.info(LOG_CATEGORY, "📋 Looking for applications...");
        const applications = await (prisma as any).application.findMany({
            where: {
                jobId: { in: jobIds },
            },
            include: {
                candidate: {
                    include: {
                        candidateProfile: true,
                    },
                },
                job: {
                    include: {
                        company: true,
                    },
                },
            },
        });

        log.info(LOG_CATEGORY, "✅ Found", applications.length, "applications");

        // Filter by job role if provided
        let filteredApplications = applications;
        if (jobRole) {
            filteredApplications = applications.filter((app: any) =>
                app.job.title.toLowerCase().includes(jobRole.toLowerCase())
            );
        }

        // Deduplicate by candidate and select latest application per candidate
        const latestApplicationByCandidate = new Map<string, any>();
        for (const app of filteredApplications as any[]) {
            const candidateId = app.candidate.id as string;
            const existing = latestApplicationByCandidate.get(candidateId);
            const currentAppliedAt = app.appliedAt
                ? new Date(app.appliedAt).getTime()
                : 0;
            const existingAppliedAt = existing?.appliedAt
                ? new Date(existing.appliedAt).getTime()
                : -1;
            if (!existing || currentAppliedAt > existingAppliedAt) {
                latestApplicationByCandidate.set(candidateId, app);
            }
        }

        // Transform data for frontend from the latest application per candidate
        const candidates = Array.from(
            latestApplicationByCandidate.values()
        ).map((app: any) => {
            if (!app.candidate.name) {
                throw new Error(`Candidate ${app.candidate.id} missing name`);
            }
            return {
                id: app.candidate.id,
                name: app.candidate.name,
                email: app.candidate.email,
                image: app.candidate.image,
                jobTitle: app.candidate.candidateProfile?.jobTitle,
                location: app.candidate.candidateProfile?.location,
                appliedJob: app.job.title,
                appliedAt: app.appliedAt,
                status: app.status,
                applicationId: app.id,
                jobId: app.job.id,
                companyId: app.job.company.id,
            };
        });

        return NextResponse.json({
            candidates,
            total: candidates.length,
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "❌ Error fetching company candidates:", error);
        log.error(LOG_CATEGORY, "❌ Error details:", {
            name: error instanceof Error ? error.name : "Unknown",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
            {
                error: `Failed to fetch candidates: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            },
            { status: 500 }
        );
    }
}
