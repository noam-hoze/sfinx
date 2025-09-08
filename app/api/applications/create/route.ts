import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../../lib";

export async function POST(request: NextRequest) {
    try {
        logger.info("🔍 Application creation API called");

        const session = await getServerSession(authOptions);
        logger.info("🔍 Session:", session ? "Found" : "Not found");

        if (!(session?.user as any)?.id) {
            logger.warn("❌ No user ID in session");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session!.user as any).id;
        logger.info("✅ User ID:", userId);
        const { companyId, jobTitle } = await request.json();
        logger.info("📋 Request data:", { companyId, jobTitle });

        if (!companyId || !jobTitle) {
            logger.warn("❌ Missing required fields");
            return NextResponse.json(
                { error: "Company ID and job title are required" },
                { status: 400 }
            );
        }

        // Find the company by ID
        logger.info("🏢 Looking for company:", companyId);
        const company = await prisma.company.findUnique({
            where: { id: companyId },
        });

        if (!company) {
            logger.warn("❌ Company not found:", companyId);
            return NextResponse.json(
                { error: "Company not found" },
                { status: 404 }
            );
        }
        logger.info("✅ Company found:", company.name);

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
        logger.info("🚀 Creating application...");
        const application = await prisma.application.create({
            data: {
                candidateId: userId,
                jobId: job.id,
                status: "PENDING",
            },
        });

        logger.info("✅ Application created:", application.id);
        return NextResponse.json({
            message: "Application created successfully",
            application,
        });
    } catch (error) {
        logger.error("❌ Error creating application:", error);
        logger.error("❌ Error details:", {
            name: error instanceof Error ? error.name : "Unknown",
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
            {
                error: `Failed to create application: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            },
            { status: 500 }
        );
    }
}
