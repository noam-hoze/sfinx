import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

/**
 * POST /api/users/demo?skip-auth=true
 * Creates a new demo user with application for the demo interview flow.
 */
export async function POST(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        if (!skipAuth) {
            return NextResponse.json(
                { error: "This endpoint requires skip-auth=true" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { userId, name } = body;

        if (!userId || !name) {
            return NextResponse.json(
                { error: "userId and name are required" },
                { status: 400 }
            );
        }

        log.info("🎭 Creating demo user:", { userId, name });

        // Create user, application, and link to demo job in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create the user
            const user = await tx.user.create({
                data: {
                    id: userId,
                    name: name,
                    email: `${userId}@demo.sfinx.ai`,
                    role: "CANDIDATE",
                },
            });

            log.info("✅ Demo user created:", user.id);

            // Find the Meta Frontend Engineer job
            const job = await tx.job.findFirst({
                where: {
                    title: "Frontend Engineer",
                    companyId: "meta",
                },
            });

            if (!job) {
                throw new Error("Demo job not found");
            }

            // Create an application for this user
            const application = await tx.application.create({
                data: {
                    candidateId: user.id,
                    jobId: job.id,
                    status: "PENDING",
                },
            });

            log.info("✅ Demo application created:", application.id);

            return { user, application };
        });

        return NextResponse.json({
            message: "Demo user created successfully",
            userId: result.user.id,
            applicationId: result.application.id,
        });
    } catch (error: any) {
        log.error("❌ Error creating demo user:", error);
        return NextResponse.json(
            { 
                error: "Failed to create demo user",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined
            },
            { status: 500 }
        );
    }
}

