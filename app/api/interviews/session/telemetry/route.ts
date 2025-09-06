import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";
import {
    noamProfile,
    noamGaps,
    noamEvidence,
    noamChapters,
    noamWorkstyle,
} from "../../../../../lib/data/telemetry-data";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function POST(request: NextRequest) {
    console.log("🚀 TELEMETRY API STARTED");

    try {
        console.log("🔍 Interview telemetry creation API called");

        console.log("🔍 ATTEMPTING getServerSession()");
        const session = await getServerSession(authOptions);
        console.log("🔍 Session result:", session);
        console.log("🔍 Session user:", session?.user);
        console.log("🔍 Session user ID:", (session?.user as any)?.id);

        if (!(session?.user as any)?.id) {
            console.log("❌ No user ID in session");
            console.log("❌ Session object:", JSON.stringify(session, null, 2));
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = (session!.user as any).id;
        console.log("✅ User ID:", userId);
        console.log("✅ Session validation PASSED");

        console.log("📋 PARSING REQUEST BODY");
        const { interviewSessionId } = await request.json();
        console.log("📋 Request data:", { interviewSessionId });
        console.log("📋 Interview session ID type:", typeof interviewSessionId);
        console.log(
            "📋 Interview session ID length:",
            interviewSessionId?.length
        );

        if (!interviewSessionId) {
            console.log("❌ Missing interviewSessionId");
            return NextResponse.json(
                { error: "Interview session ID is required" },
                { status: 400 }
            );
        }
        console.log("✅ Request parsing PASSED");

        // Verify the interview session exists and belongs to the user
        console.log("🔍 Verifying interview session...");
        console.log("Interview session ID:", interviewSessionId);
        console.log("User ID:", userId);

        // Check if telemetry data already exists for this session
        console.log("🔍 Checking for existing telemetry data...");
        console.log("🔍 Looking for interviewSessionId:", interviewSessionId);

        let existingTelemetry;
        try {
            existingTelemetry = await prisma.telemetryData.findUnique({
                where: {
                    interviewSessionId: interviewSessionId,
                },
            });
            console.log("🔍 findUnique result:", existingTelemetry);
        } catch (findError: any) {
            console.error("🔍 ERROR in findUnique:", findError);
            console.error("🔍 Find error details:", {
                name: findError?.name,
                message: findError?.message,
                code: findError?.code,
            });
            throw findError;
        }

        if (existingTelemetry) {
            console.log(
                "✅ Telemetry data already exists:",
                existingTelemetry.id
            );
            console.log("✅ Returning existing telemetry data");
            return NextResponse.json({
                message: "Telemetry data already exists",
                telemetryData: {
                    id: existingTelemetry.id,
                    matchScore: existingTelemetry.matchScore,
                    confidence: existingTelemetry.confidence,
                    story: existingTelemetry.story,
                },
            });
        }

        console.log("✅ No existing telemetry found, proceeding with creation");

        let interviewSession;
        try {
            interviewSession = await prisma.interviewSession.findFirst({
                where: {
                    id: interviewSessionId,
                    candidateId: userId,
                },
            });
            console.log(
                "🔍 Interview session query completed, result:",
                interviewSession ? "Found" : "Not found"
            );
        } catch (sessionError: any) {
            console.error("❌ Error in interview session query:", sessionError);
            throw sessionError;
        }

        if (!interviewSession) {
            console.log(
                "❌ Interview session not found or doesn't belong to user"
            );
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        console.log("🚀 Creating telemetry data...");
        console.log("Interview session ID:", interviewSessionId);
        console.log("Noam profile data:", {
            matchScore: noamProfile.matchScore,
            confidence: noamProfile.confidence,
            story: noamProfile.story?.substring(0, 50) + "...",
        });

        // Test database connection
        try {
            console.log("🧪 Testing database connection...");
            const testQuery = await prisma.user.findFirst();
            console.log("✅ Database connection test passed");
        } catch (dbError: any) {
            console.error("❌ Database connection test failed:", dbError);
            throw dbError;
        }

        // Wrap all operations in a transaction
        console.log("🔄 STARTING DATABASE TRANSACTION");
        const result = await prisma.$transaction(async (prisma) => {
            console.log("🔄 INSIDE TRANSACTION - STARTING OPERATIONS");
            // 1. Create Telemetry Data
            let telemetryData;
            try {
                telemetryData = await prisma.telemetryData.create({
                    data: {
                        interviewSessionId: interviewSessionId,
                        matchScore: noamProfile.matchScore,
                        confidence: noamProfile.confidence,
                        story: noamProfile.story,
                        hasFairnessFlag: false,
                    },
                });

                console.log("✅ Telemetry data created:", telemetryData.id);
            } catch (createError: any) {
                console.error("❌ Error creating telemetry data:", createError);
                throw createError;
            }

            // 2. Create Workstyle Metrics
            try {
                const workstyleMetrics = await prisma.workstyleMetrics.create({
                    data: {
                        telemetryDataId: telemetryData.id,
                        iterationSpeed: noamWorkstyle.iterationSpeed.value,
                        debugLoops: noamWorkstyle.debugLoops.value,
                        refactorCleanups: noamWorkstyle.refactorCleanups.value,
                        aiAssistUsage: noamWorkstyle.aiAssistUsage.value,
                    },
                });

                console.log(
                    "✅ Workstyle metrics created:",
                    workstyleMetrics.id
                );
            } catch (workstyleError: any) {
                console.error(
                    "❌ Error creating workstyle metrics:",
                    workstyleError
                );
                throw workstyleError;
            }

            // 3. Create Gap Analysis
            let gapAnalysis;
            try {
                gapAnalysis = await prisma.gapAnalysis.create({
                    data: {
                        telemetryDataId: telemetryData.id,
                    },
                });

                console.log("✅ Gap analysis created:", gapAnalysis.id);
            } catch (gapAnalysisError: any) {
                console.error(
                    "❌ Error creating gap analysis:",
                    gapAnalysisError
                );
                throw gapAnalysisError;
            }

            // 4. Create Gaps
            try {
                console.log("🔍 Creating gaps, data:", noamGaps.gaps);
                const gaps = await Promise.all(
                    noamGaps.gaps.map((gap, index) => {
                        console.log(`🔍 Creating gap ${index}:`, gap);
                        return prisma.gap.create({
                            data: {
                                gapAnalysisId: gapAnalysis.id,
                                severity: gap.severity,
                                description: gap.description,
                                color: gap.color,
                                evidenceLinks: gap.evidenceLinks,
                            },
                        });
                    })
                );

                console.log("✅ Gaps created:", gaps.length);
            } catch (gapsError: any) {
                console.error("❌ Error creating gaps:", gapsError);
                console.error("❌ Gaps error details:", {
                    name: gapsError?.name,
                    message: gapsError?.message,
                    code: gapsError?.code,
                });
                throw gapsError;
            }

            // 5. Create Evidence Clips
            try {
                console.log(
                    "🔍 Creating evidence clips, count:",
                    noamEvidence.length
                );
                const evidenceClips = await Promise.all(
                    noamEvidence.map((clip, index) => {
                        console.log(
                            `🔍 Creating evidence clip ${index}:`,
                            clip.title
                        );
                        return prisma.evidenceClip.create({
                            data: {
                                telemetryDataId: telemetryData.id,
                                title: clip.title,
                                thumbnailUrl: clip.thumbnailUrl,
                                duration: clip.duration,
                                description: clip.description,
                                startTime: clip.startTime,
                            },
                        });
                    })
                );

                console.log("✅ Evidence clips created:", evidenceClips.length);
            } catch (evidenceError: any) {
                console.error(
                    "❌ Error creating evidence clips:",
                    evidenceError
                );
                console.error("❌ Evidence error details:", {
                    name: evidenceError?.name,
                    message: evidenceError?.message,
                    code: evidenceError?.code,
                });
                throw evidenceError;
            }

            // 6. Create Video Chapters
            let videoChapters;
            try {
                console.log(
                    "🔍 Creating video chapters, count:",
                    noamChapters.length
                );
                videoChapters = await Promise.all(
                    noamChapters.map((chapter, index) => {
                        console.log(
                            `🔍 Creating video chapter ${index}:`,
                            chapter.title
                        );
                        return prisma.videoChapter.create({
                            data: {
                                telemetryDataId: telemetryData.id,
                                title: chapter.title,
                                startTime: chapter.startTime,
                                endTime: chapter.endTime,
                                description: chapter.description,
                                thumbnailUrl: chapter.thumbnailUrl,
                            },
                        });
                    })
                );

                console.log("✅ Video chapters created:", videoChapters.length);
            } catch (chaptersError: any) {
                console.error(
                    "❌ Error creating video chapters:",
                    chaptersError
                );
                console.error("❌ Chapters error details:", {
                    name: chaptersError?.name,
                    message: chaptersError?.message,
                    code: chaptersError?.code,
                });
                throw chaptersError;
            }

            // 7. Create Video Captions for each chapter
            try {
                for (const [index, chapter] of videoChapters.entries()) {
                    const originalChapter = noamChapters[index];
                    if (originalChapter.captions) {
                        console.log(
                            `🔍 Creating captions for chapter ${index}, count:`,
                            originalChapter.captions.length
                        );
                        await Promise.all(
                            originalChapter.captions.map((caption) =>
                                prisma.videoCaption.create({
                                    data: {
                                        videoChapterId: chapter.id,
                                        text: caption.text,
                                        startTime: caption.startTime,
                                        endTime: caption.endTime,
                                    },
                                })
                            )
                        );
                    }
                }

                console.log("✅ Video captions created");
            } catch (captionsError: any) {
                console.error(
                    "❌ Error creating video captions:",
                    captionsError
                );
                console.error("❌ Captions error details:", {
                    name: captionsError?.name,
                    message: captionsError?.message,
                    code: captionsError?.code,
                });
                throw captionsError;
            }

            return telemetryData;
        });

        console.log("✅ TRANSACTION COMPLETED SUCCESSFULLY");
        console.log("🎯 PREPARING SUCCESS RESPONSE");
        console.log("🎯 Result object:", result);
        console.log("🎯 Result ID:", result?.id);
        console.log("🎯 Result matchScore:", result?.matchScore);

        const responseData = {
            message: "Telemetry data created successfully",
            telemetryData: {
                id: result.id,
                matchScore: result.matchScore,
                confidence: result.confidence,
                story: result.story,
            },
        };

        console.log("🎯 Response data prepared:", responseData);

        try {
            console.log("🎯 ATTEMPTING NextResponse.json()");
            const response = NextResponse.json(responseData);
            console.log("🎯 NextResponse.json() SUCCESS");
            console.log("🎯 Returning response");
            return response;
        } catch (responseError: any) {
            console.error("🎯 RESPONSE ERROR:", responseError);
            console.error("🎯 Response error details:", {
                name: responseError?.name,
                message: responseError?.message,
                stack: responseError?.stack,
            });
            throw responseError;
        }

        console.log("🎯 FUNCTION ENDING NORMALLY");
    } catch (error: any) {
        console.log("💥 CATCH BLOCK ENTERED");
        console.error("❌ Error creating telemetry data:", error);
        console.error("❌ Error details:", {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
        });

        // Return detailed error information for debugging
        return NextResponse.json(
            {
                error: "Failed to create telemetry data",
                details: {
                    name: error?.name,
                    message: error?.message,
                    stack: error?.stack,
                },
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }

    console.log("🏁 FUNCTION COMPLETELY FINISHED");
}
