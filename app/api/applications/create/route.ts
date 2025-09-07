import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function POST(request: NextRequest) {
    try {
        console.log("🔍 Application creation API called");

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
        const { companyId, jobTitle } = await request.json();
        console.log("📋 Request data:", { companyId, jobTitle });

        if (!companyId || !jobTitle) {
            console.log("❌ Missing required fields");
            return NextResponse.json(
                { error: "Company ID and job title are required" },
                { status: 400 }
            );
        }

        // Find the company by ID
        console.log("🏢 Looking for company:", companyId);
        const company = await prisma.company.findUnique({
            where: { id: companyId },
        });

        if (!company) {
            console.log("❌ Company not found:", companyId);
            return NextResponse.json(
                { error: "Company not found" },
                { status: 404 }
            );
        }
        console.log("✅ Company found:", company.name);

        // Find or create a job for this company with the specified title
        let job = await prisma.job.findFirst({
            where: {
                companyId: company.id,
                title: jobTitle,
            },
        });

        if (!job) {
            // Create a new job if it doesn't exist
            job = await prisma.job.create({
                data: {
                    title: jobTitle,
                    type: "FULL_TIME",
                    location: "Remote", // Default location
                    companyId: company.id,
                },
            });
        }

        // Check if application already exists
        const existingApplication = await prisma.application.findFirst({
            where: {
                candidateId: userId,
                jobId: job.id,
            },
        });

        if (existingApplication) {
            return NextResponse.json({
                message: "Application already exists",
                application: existingApplication,
            });
        }

        // Create the application
        console.log("🚀 Creating application...");
        const application = await prisma.application.create({
            data: {
                candidateId: userId,
                jobId: job.id,
                status: "PENDING",
            },
        });

        console.log("✅ Application created:", application.id);
        return NextResponse.json({
            message: "Application created successfully",
            application,
        });
    } catch (error) {
        console.error("❌ Error creating application:", error);
        console.error("❌ Error details:", {
            name: error instanceof Error ? error.name : "Unknown",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
            { error: "Failed to create application" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
