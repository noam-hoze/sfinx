import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!(session?.user as any)?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session!.user as any).id;
        const { companyId, jobTitle } = await request.json();

        if (!companyId || !jobTitle) {
            return NextResponse.json(
                { error: "Company ID and job title are required" },
                { status: 400 }
            );
        }

        // Find the company by ID
        const company = await prisma.company.findUnique({
            where: { id: companyId },
        });

        if (!company) {
            return NextResponse.json(
                { error: "Company not found" },
                { status: 404 }
            );
        }

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
        const existingApplication = await (prisma as any).application.findFirst(
            {
                where: {
                    candidateId: userId,
                    jobId: job.id,
                },
            }
        );

        if (existingApplication) {
            return NextResponse.json({
                message: "Application already exists",
                application: existingApplication,
            });
        }

        // Create the application
        const application = await (prisma as any).application.create({
            data: {
                candidateId: userId,
                jobId: job.id,
                status: "PENDING",
            },
        });

        return NextResponse.json({
            message: "Application created successfully",
            application,
        });
    } catch (error) {
        console.error("Error creating application:", error);
        return NextResponse.json(
            { error: "Failed to create application" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
