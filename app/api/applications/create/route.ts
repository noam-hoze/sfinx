import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { prisma } from "app/shared/services";
import { log } from "app/shared/services";

export async function POST(request: NextRequest) {
    try {
        log.info("🔍 Application creation API called");

        const url = new URL(request.url);
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        const session = await getServerSession(authOptions);
        log.info("🔍 Session:", session ? "Found" : "Not found");
        log.info("🔍 Skip auth:", skipAuth);

        const body = await request.json();
        const { companyId, jobId, userId: demoUserId } = body;

        let userId: string;

        if (skipAuth) {
            if (!demoUserId) {
                log.warn("❌ skip-auth mode but no userId provided in request");
                return NextResponse.json(
                    { error: "userId required when skip-auth=true" },
                    { status: 400 }
                );
            }
            userId = demoUserId;
            log.info("✅ Skip auth - User ID from request:", userId);
        } else {
            if (!(session?.user as any)?.id) {
                log.warn("❌ No user ID in session");
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }
            userId = (session!.user as any).id;
            log.info("✅ User ID from session:", userId);
        }

        log.info("📋 Request data:", { companyId, jobId });

        if (!companyId || !jobId) {
            log.warn("❌ Missing required fields");
            return NextResponse.json(
                {
                    error: "companyId and jobId are required",
                },
                { status: 400 }
            );
        }

        // Find the company by ID
        log.info("🏢 Looking for company:", companyId);
        const company = await prisma.company.findUnique({
            where: { id: companyId },
        });

        if (!company) {
            log.warn("❌ Company not found:", companyId);
            return NextResponse.json(
                { error: "Company not found" },
                { status: 404 }
            );
        }
        log.info("✅ Company found:", company.name);

        // Resolve job STRICTLY by jobId (deterministic)
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job || job.companyId !== company.id) {
            log.warn("❌ Job not found or does not belong to company", {
                jobId,
                companyId: company.id,
            });
            return NextResponse.json(
                { error: "Job not found for this company" },
                { status: 404 }
            );
        }

        // Reuse strictly by exact jobId
        const existingByJobId = await prisma.application.findFirst({
            where: { candidateId: userId, jobId: job.id },
        });

        if (existingByJobId) {
            log.info(
                "✅ Reusing existing application by jobId:",
                existingByJobId.id
            );
            return NextResponse.json({
                message: "Application already exists",
                application: existingByJobId,
            });
        }

        // Create the application
        log.info("🚀 Creating application...");
        const application = await prisma.application.create({
            data: {
                candidateId: userId,
                jobId: job.id,
                status: "PENDING",
            },
        });

        log.info("✅ Application created:", application.id);
        return NextResponse.json({
            message: "Application created successfully",
            application,
        });
    } catch (error) {
        log.error("❌ Error creating application:", error);
        log.error("❌ Error details:", {
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
