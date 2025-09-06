import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!(session?.user as any)?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get the user's company profile
        const companyProfile = await prisma.companyProfile.findUnique({
            where: { userId: (session!.user as any).id },
        });

        if (!companyProfile) {
            return NextResponse.json(
                { error: "Company profile not found" },
                { status: 404 }
            );
        }

        const { searchParams } = new URL(request.url);
        const jobRole = searchParams.get("jobRole") || "";

        // Find the company by name
        const company = await prisma.company.findUnique({
            where: { name: companyProfile.companyName },
        });

        if (!company) {
            return NextResponse.json(
                { error: "Company not found" },
                { status: 404 }
            );
        }

        // Find all jobs for this company
        const jobs = await prisma.job.findMany({
            where: { companyId: company.id },
            select: { id: true },
        });

        const jobIds = jobs.map((job) => job.id);

        // Get all applications for this company's jobs
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
        console.error("Error fetching company candidates:", error);
        return NextResponse.json(
            { error: "Failed to fetch candidates" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
