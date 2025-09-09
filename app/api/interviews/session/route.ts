import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { logger } from "../../../../lib";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function POST(request: NextRequest) {
    try {
        logger.info("🔍 Interview session creation API called");

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

        const { applicationId, companyId } = await request.json();
        logger.info("📋 Request data:", { applicationId, companyId });

        if (!applicationId) {
            logger.warn("❌ Missing applicationId");
            return NextResponse.json(
                { error: "Application ID is required" },
                { status: 400 }
            );
        }

        // Verify the application exists and belongs to the user
        logger.info("🔎 Verifying application exists & belongs to user", {
            applicationId,
            userId,
        });
        const application = await prisma.application.findFirst({
            where: {
                id: applicationId,
                candidateId: userId,
            },
        });

        if (!application) {
            logger.warn("❌ Application not found or doesn't belong to user");
            return NextResponse.json(
                { error: "Application not found" },
                { status: 404 }
            );
        }
        logger.info("✅ Application verified");

        // Create interview session AND zeroed telemetry in a single transaction
        logger.info(
            "🚀 Creating interview session and zeroed telemetry (transaction)..."
        );
        let interviewSession; // for logging after transaction
        try {
            const txResult = await prisma.$transaction(async (tx) => {
                logger.info("🧾 [TX] Creating InterviewSession...");
                const interviewSession = await tx.interviewSession.create({
                    data: {
                        candidateId: userId,
                        applicationId: applicationId,
                        status: "IN_PROGRESS",
                    },
                });
                logger.info("✅ [TX] InterviewSession created", {
                    interviewSessionId: interviewSession.id,
                });

                logger.info("🧾 [TX] Creating TelemetryData (zeroed)...");
                const telemetry = await tx.telemetryData.create({
                    data: {
                        interviewSessionId: interviewSession.id,
                        matchScore: 0,
                        confidence: "Unknown",
                        story: "",
                        hasFairnessFlag: false,
                    } as any,
                });
                logger.info("✅ [TX] TelemetryData created", {
                    telemetryId: telemetry.id,
                });

                logger.info("🧾 [TX] Creating WorkstyleMetrics (zeroed)...");
                await tx.workstyleMetrics.create({
                    data: {
                        telemetryDataId: telemetry.id,
                        iterationSpeed: 0,
                        debugLoops: 0,
                        refactorCleanups: 0,
                        aiAssistUsage: 0,
                    },
                });
                logger.info("✅ [TX] WorkstyleMetrics created for telemetry", {
                    telemetryId: telemetry.id,
                });

                logger.info("🧾 [TX] Creating GapAnalysis (empty)...");
                await tx.gapAnalysis.create({
                    data: { telemetryDataId: telemetry.id },
                });
                logger.info("✅ [TX] GapAnalysis created for telemetry", {
                    telemetryId: telemetry.id,
                });

                return { interviewSession };
            });
            interviewSession = txResult.interviewSession;
        } catch (txError: any) {
            logger.error(
                "💥 Transaction failed while creating session/telemetry",
                {
                    name: txError?.name,
                    message: txError?.message,
                    code: txError?.code,
                    meta: txError?.meta,
                    stack: txError?.stack,
                }
            );
            throw txError; // handled by outer catch to return 500
        }

        logger.info(
            "✅ Interview session and telemetry created:",
            interviewSession.id
        );

        return NextResponse.json({
            message: "Interview session created successfully",
            interviewSession,
        });
    } catch (error: any) {
        logger.error("❌ Error creating interview session:", error);
        logger.error("❌ Error details:", {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
        });
        // Surface rich error details in non-prod to aid debugging
        const payload: any = { error: "Failed to create interview session" };
        if (process.env.NODE_ENV !== "production") {
            payload.details = {
                name: error?.name,
                message: error?.message,
                code: (error as any)?.code,
                meta: (error as any)?.meta,
                stack: error?.stack,
            };
        }
        return NextResponse.json(payload, { status: 500 });
    }
}
