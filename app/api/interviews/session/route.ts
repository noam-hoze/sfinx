import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

export async function POST(request: NextRequest) {
    try {
        log.info("🔍 Interview session creation API called");

        const url = new URL(request.url);
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        const session = await getServerSession(authOptions);
        log.info("🔍 Session:", session ? "Found" : "Not found");
        log.info("🔍 Skip auth:", skipAuth);

        const body = await request.json();
        const { applicationId, companyId, userId: requestUserId } = body;

        let userId: string;

        if (skipAuth) {
            if (!requestUserId) {
                log.warn("❌ skip-auth mode but no userId provided in request");
                return NextResponse.json(
                    { error: "userId required when skip-auth=true" },
                    { status: 400 }
                );
            }
            userId = requestUserId;
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

        log.info("📋 Request data:", { applicationId, companyId });

        if (!applicationId) {
            log.warn("❌ Missing applicationId");
            return NextResponse.json(
                { error: "Application ID is required" },
                { status: 400 }
            );
        }

        // Verify the application exists and belongs to the user
        log.info("🔎 Verifying application exists & belongs to user", {
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
            log.warn("❌ Application not found or doesn't belong to user");
            return NextResponse.json(
                { error: "Application not found" },
                { status: 404 }
            );
        }
        log.info("✅ Application verified");

        // Create interview session AND zeroed telemetry in a single transaction
        log.info(
            "🚀 Creating interview session and zeroed telemetry (transaction)..."
        );
        let interviewSession; // for logging after transaction
        try {
            const txResult = await prisma.$transaction(async (tx) => {
                log.info("🧾 [TX] Creating InterviewSession...");
                const interviewSession = await tx.interviewSession.create({
                    data: {
                        candidateId: userId,
                        applicationId: applicationId,
                        status: "IN_PROGRESS",
                        recordingStartedAt: new Date(), // Set recording start time for video offset calculation
                    },
                });
                log.info("✅ [TX] InterviewSession created", {
                    interviewSessionId: interviewSession.id,
                });

                log.info("🧾 [TX] Creating TelemetryData (zeroed)...");
                const telemetry = await tx.telemetryData.create({
                    data: {
                        interviewSessionId: interviewSession.id,
                        matchScore: 0,
                        confidence: "Unknown",
                        story: "",
                        hasFairnessFlag: false,
                    } as any,
                });
                log.info("✅ [TX] TelemetryData created", {
                    telemetryId: telemetry.id,
                });

                log.info(
                    "🧾 [TX] Creating WorkstyleMetrics (nullable baseline)..."
                );
                await tx.workstyleMetrics.create({
                    data: {
                        telemetryDataId: telemetry.id,
                        externalToolUsage: 0,
                    } as any,
                });
                log.info("✅ [TX] WorkstyleMetrics created for telemetry", {
                    telemetryId: telemetry.id,
                });

                log.info("🧾 [TX] Creating GapAnalysis (empty)...");
                await tx.gapAnalysis.create({
                    data: { telemetryDataId: telemetry.id },
                });
                log.info("✅ [TX] GapAnalysis created for telemetry", {
                    telemetryId: telemetry.id,
                });

                return { interviewSession };
            });
            interviewSession = txResult.interviewSession;
        } catch (txError: any) {
            log.error(
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

        log.info(
            "✅ Interview session and telemetry created:",
            interviewSession.id
        );

        return NextResponse.json({
            message: "Interview session created successfully",
            interviewSession,
        });
    } catch (error: any) {
        log.error("❌ Error creating interview session:", error);
        log.error("❌ Error details:", {
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
