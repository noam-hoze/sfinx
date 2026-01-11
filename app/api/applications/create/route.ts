import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { log } from "app/shared/services";
import { authOptions, prisma, invalidate, invalidatePattern } from "app/shared/services/server";

const LOG_CATEGORY = "applications";

export async function POST(request: NextRequest) {
    try {
        log.info(LOG_CATEGORY, "🔍 Application creation API called");

        const url = new URL(request.url);
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        const session = await getServerSession(authOptions);
        log.info(LOG_CATEGORY, "🔍 Session:", session ? "Found" : "Not found");
        log.info(LOG_CATEGORY, "🔍 Skip auth:", skipAuth);

        const body = await request.json();
        const { companyId, jobId, userId: bodyUserId } = body;

        let userId: string;

        if (skipAuth) {
            if (!bodyUserId) {
                log.warn(LOG_CATEGORY, "❌ skip-auth mode but no userId provided in request");
                return NextResponse.json(
                    { error: "userId required when skip-auth=true" },
                    { status: 400 }
                );
            }
            userId = bodyUserId;
            log.info(LOG_CATEGORY, "✅ Skip auth - User ID from request:", userId);
        } else {
            if (!(session?.user as any)?.id) {
                log.warn(LOG_CATEGORY, "❌ No user ID in session");
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }
            userId = (session!.user as any).id;
            log.info(LOG_CATEGORY, "✅ User ID from session:", userId);
        }

        log.info(LOG_CATEGORY, "📋 Request data:", { companyId, jobId });

        if (!companyId || !jobId) {
            log.warn(LOG_CATEGORY, "❌ Missing required fields");
            return NextResponse.json(
                {
                    error: "companyId and jobId are required",
                },
                { status: 400 }
            );
        }

        // Find the company by ID
        log.info(LOG_CATEGORY, "🏢 Looking for company:", companyId);
        const company = await prisma.company.findUnique({
            where: { id: companyId },
        });

        if (!company) {
            log.warn(LOG_CATEGORY, "❌ Company not found:", companyId);
            return NextResponse.json(
                { error: "Company not found" },
                { status: 404 }
            );
        }
        log.info(LOG_CATEGORY, "✅ Company found:", company.name);

        // Resolve job STRICTLY by jobId (deterministic)
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job || job.companyId !== company.id) {
            log.warn(LOG_CATEGORY, "❌ Job not found or does not belong to company", {
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
            log.info(LOG_CATEGORY, 
                "✅ Reusing existing application by jobId:",
                existingByJobId.id
            );
            return NextResponse.json({
                message: "Application already exists",
                application: existingByJobId,
            });
        }

        // Create the application
        log.info(LOG_CATEGORY, "🚀 Creating application...");
        const application = await prisma.application.create({
            data: {
                candidateId: userId,
                jobId: job.id,
                status: "PENDING",
            },
        });

        log.info(LOG_CATEGORY, "✅ Application created:", application.id);
        
        invalidate(`applicants:job:${job.id}`);
        invalidatePattern(`jobs:company:${company.name}`);
        
        return NextResponse.json({
            message: "Application created successfully",
            application,
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "❌ Error creating application:", error);
        log.error(LOG_CATEGORY, "❌ Error details:", {
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
