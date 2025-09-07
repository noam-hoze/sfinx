import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: NextRequest) {
    try {
        console.log("🔍 Company candidates API called");

        const session = await getServerSession(authOptions);
        console.log("🔍 Session:", session ? "Found" : "Not found");

        if (!(session?.user as any)?.id) {
            console.log("❌ No user ID in session");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session!.user as any).id;
        console.log("✅ User ID:", userId);

        // Get the user's company profile
        console.log("🏢 Looking for company profile...");
        const companyProfile = await prisma.companyProfile.findUnique({
            where: { userId: userId },
        });

        if (!companyProfile) {
            console.log("❌ Company profile not found for user:", userId);
            return NextResponse.json(
                { error: "Company profile not found" },
                { status: 404 }
            );
        }

        console.log("✅ Company profile found:", companyProfile.companyName);

        const { searchParams } = new URL(request.url);
        const jobRole = searchParams.get("jobRole") || "";

        // Find the company by name
        console.log("🏢 Looking for company:", companyProfile.companyName);
        const company = await prisma.company.findUnique({
            where: { name: companyProfile.companyName },
        });

        if (!company) {
            console.log("❌ Company not found:", companyProfile.companyName);
            return NextResponse.json(
                { error: "Company not found" },
                { status: 404 }
            );
        }

        console.log("✅ Company found:", company.id);

        // Find all jobs for this company
        console.log("💼 Looking for jobs...");
        const jobs = await prisma.job.findMany({
            where: { companyId: company.id },
            select: { id: true },
        });

        console.log("✅ Found", jobs.length, "jobs");
        const jobIds = jobs.map((job) => job.id);

        // Get all applications for this company's jobs
        console.log("📋 Looking for applications...");
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

        console.log("✅ Found", applications.length, "applications");

        // Filter by job role if provided
        let filteredApplications = applications;
        if (jobRole) {
            filteredApplications = applications.filter((app: any) =>
                app.job.title.toLowerCase().includes(jobRole.toLowerCase())
            );
        }

        // Transform data for frontend
        const candidates = filteredApplications.map((app: any) => ({
            id: app.candidate.id,
            name: app.candidate.name || "Anonymous",
            email: app.candidate.email,
            image: app.candidate.image,
            jobTitle: app.candidate.candidateProfile?.jobTitle || "",
            location: app.candidate.candidateProfile?.location || "",
            appliedJob: app.job.title,
            appliedAt: app.appliedAt,
            status: app.status,
        }));

        return NextResponse.json({
            candidates,
            total: candidates.length,
        });
    } catch (error) {
        console.error("❌ Error fetching company candidates:", error);
        console.error("❌ Error details:", {
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
