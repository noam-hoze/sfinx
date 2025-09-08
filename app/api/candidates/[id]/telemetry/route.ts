import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const candidateId = params.id;
        const applicationId = request.nextUrl.searchParams.get("applicationId");

        // Get the most recent interview session for this candidate that has telemetry data
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                candidateId: candidateId,
                ...(applicationId ? { applicationId } : {}),
                telemetryData: {
                    isNot: null,
                },
            },
            include: {
                telemetryData: {
                    include: {
                        workstyleMetrics: true,
                        gapAnalysis: {
                            include: {
                                gaps: true,
                            },
                        },
                        evidenceClips: true,
                        videoChapters: {
                            include: {
                                captions: true,
                            },
                        },
                    },
                },
                candidate: {
                    include: {
                        candidateProfile: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        if (!interviewSession || !interviewSession.telemetryData) {
            return NextResponse.json(
                { error: "No telemetry data found for this candidate" },
                { status: 404 }
            );
        }

        const telemetry = interviewSession.telemetryData;
        const candidate = interviewSession.candidate;

        // BUNDLE evidenceLinks from evidenceClips table
        const evidenceClips = interviewSession.telemetryData.evidenceClips;

        const iterationSpeedLinks: number[] = [];
        const debugLoopsLinks: number[] = [];
        const refactorCleanupsLinks: number[] = [];
        const aiAssistUsageLinks: number[] = [];

        evidenceClips.forEach((clip: any) => {
            if (clip.startTime === null || clip.startTime === undefined) return;

            if (clip.title.includes("Iteration Speed")) {
                iterationSpeedLinks.push(clip.startTime);
            }
            if (clip.title.includes("Debug Loop")) {
                debugLoopsLinks.push(clip.startTime);
            }
            if (clip.title.includes("Refactor")) {
                refactorCleanupsLinks.push(clip.startTime);
            }
            if (clip.title.includes("AI Assist")) {
                aiAssistUsageLinks.push(clip.startTime);
            }
        });

        // Transform the data to match the expected frontend format
        const transformedData = {
            candidate: {
                id: candidate.id,
                name: candidate.name,
                image: candidate.image,
                matchScore: telemetry.matchScore,
                confidence: telemetry.confidence,
                story: telemetry.story || null,
            },
            videoUrl: interviewSession.videoUrl,
            duration: interviewSession.duration,
            gaps: {
                gaps:
                    telemetry.gapAnalysis?.gaps.map((gap: any) => ({
                        severity: gap.severity,
                        description: gap.description,
                        color: gap.color,
                        evidenceLinks: gap.evidenceLinks,
                    })) || [],
            },
            evidence: telemetry.evidenceClips.map((clip: any) => ({
                id: clip.id,
                title: clip.title,
                thumbnailUrl: clip.thumbnailUrl,
                duration: clip.duration,
                description: clip.description,
                startTime: clip.startTime,
            })),
            chapters: telemetry.videoChapters.map((chapter: any) => ({
                id: chapter.id,
                title: chapter.title,
                startTime: chapter.startTime,
                endTime: chapter.endTime,
                description: chapter.description,
                thumbnailUrl: chapter.thumbnailUrl,
                captions: chapter.captions.map((caption: any) => ({
                    text: caption.text,
                    startTime: caption.startTime,
                    endTime: caption.endTime,
                })),
            })),
            workstyle: telemetry.workstyleMetrics
                ? {
                      iterationSpeed: {
                          value: telemetry.workstyleMetrics.iterationSpeed,
                          level:
                              telemetry.workstyleMetrics.iterationSpeed >= 80
                                  ? "High"
                                  : telemetry.workstyleMetrics.iterationSpeed >=
                                    60
                                  ? "Moderate"
                                  : "Low",
                          color:
                              telemetry.workstyleMetrics.iterationSpeed >= 80
                                  ? "blue"
                                  : telemetry.workstyleMetrics.iterationSpeed >=
                                    60
                                  ? "yellow"
                                  : "red",
                          evidenceLinks: iterationSpeedLinks,
                      },
                      debugLoops: {
                          value: telemetry.workstyleMetrics.debugLoops,
                          level:
                              telemetry.workstyleMetrics.debugLoops <= 30
                                  ? "Fast"
                                  : telemetry.workstyleMetrics.debugLoops <= 60
                                  ? "Moderate"
                                  : "Slow",
                          color:
                              telemetry.workstyleMetrics.debugLoops <= 30
                                  ? "blue"
                                  : telemetry.workstyleMetrics.debugLoops <= 60
                                  ? "yellow"
                                  : "red",
                          evidenceLinks: debugLoopsLinks,
                      },
                      refactorCleanups: {
                          value: telemetry.workstyleMetrics.refactorCleanups,
                          level:
                              telemetry.workstyleMetrics.refactorCleanups >= 80
                                  ? "Strong"
                                  : telemetry.workstyleMetrics
                                        .refactorCleanups >= 60
                                  ? "Moderate"
                                  : "Weak",
                          color:
                              telemetry.workstyleMetrics.refactorCleanups >= 80
                                  ? "blue"
                                  : telemetry.workstyleMetrics
                                        .refactorCleanups >= 60
                                  ? "yellow"
                                  : "red",
                          evidenceLinks: refactorCleanupsLinks,
                      },
                      aiAssistUsage: {
                          value: telemetry.workstyleMetrics.aiAssistUsage,
                          level:
                              telemetry.workstyleMetrics.aiAssistUsage <= 20
                                  ? "Minimal"
                                  : telemetry.workstyleMetrics.aiAssistUsage <=
                                    50
                                  ? "Moderate"
                                  : "High",
                          color:
                              telemetry.workstyleMetrics.aiAssistUsage <= 20
                                  ? "white"
                                  : telemetry.workstyleMetrics.aiAssistUsage <=
                                    50
                                  ? "yellow"
                                  : "red",
                          isFairnessFlag:
                              telemetry.workstyleMetrics.aiAssistUsage > 50,
                          evidenceLinks: aiAssistUsageLinks,
                      },
                  }
                : null,
            hasFairnessFlag: telemetry.hasFairnessFlag,
        };

        return NextResponse.json(transformedData);
    } catch (error) {
        console.error("Error fetching candidate telemetry:", error);
        return NextResponse.json(
            { error: "Failed to fetch telemetry data" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const candidateId = params.id;
        const body = await request.json();

        // Get the most recent interview session for this candidate
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                candidateId: candidateId,
                telemetryData: {
                    isNot: null,
                },
            },
            include: {
                telemetryData: {
                    include: {
                        workstyleMetrics: true,
                        gapAnalysis: {
                            include: {
                                gaps: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        if (!interviewSession || !interviewSession.telemetryData) {
            return NextResponse.json(
                { error: "No telemetry data found for this candidate" },
                { status: 404 }
            );
        }

        const telemetryId = interviewSession.telemetryData.id;

        // Update telemetry data
        if (body.candidate) {
            await prisma.telemetryData.update({
                where: { id: telemetryId },
                data: {
                    matchScore: body.candidate.matchScore,
                },
            });

            // Update candidate name
            await prisma.user.update({
                where: { id: candidateId },
                data: {
                    name: body.candidate.name,
                },
            });
        }

        // Update workstyle metrics if provided
        if (body.workstyle && interviewSession.telemetryData.workstyleMetrics) {
            const workstyleData: any = {};

            if (body.workstyle.iterationSpeed?.value !== undefined) {
                workstyleData.iterationSpeed =
                    body.workstyle.iterationSpeed.value;
            }
            if (body.workstyle.debugLoops?.value !== undefined) {
                workstyleData.debugLoops = body.workstyle.debugLoops.value;
            }
            if (body.workstyle.refactorCleanups?.value !== undefined) {
                workstyleData.refactorCleanups =
                    body.workstyle.refactorCleanups.value;
            }
            if (body.workstyle.aiAssistUsage?.value !== undefined) {
                workstyleData.aiAssistUsage =
                    body.workstyle.aiAssistUsage.value;
            }

            if (Object.keys(workstyleData).length > 0) {
                await prisma.workstyleMetrics.update({
                    where: {
                        id: interviewSession.telemetryData.workstyleMetrics.id,
                    },
                    data: workstyleData,
                });
            }

            // Delete all existing clips for this telemetry data
            await prisma.evidenceClip.deleteMany({
                where: {
                    telemetryDataId: telemetryId,
                    // TODO: maybe filter by workstyle-related titles?
                },
            });

            // Create new clips from the body
            const workstyleMetricsToUpdate = [
                {
                    title: "Iteration Speed",
                    data: body.workstyle.iterationSpeed,
                },
                { title: "Debug Loop", data: body.workstyle.debugLoops },
                {
                    title: "Refactor & Cleanups",
                    data: body.workstyle.refactorCleanups,
                },
                {
                    title: "AI Assist Usage",
                    data: body.workstyle.aiAssistUsage,
                },
            ];

            for (const metric of workstyleMetricsToUpdate) {
                if (metric.data && metric.data.evidenceLinks) {
                    for (const timestamp of metric.data.evidenceLinks) {
                        await prisma.evidenceClip.create({
                            data: {
                                telemetryDataId: telemetryId,
                                title: metric.title,
                                startTime: timestamp,
                                description: `Evidence for ${metric.title}`, // Placeholder
                                duration: 5, // Placeholder
                            },
                        });
                    }
                }
            }
        }

        // Update gaps if provided
        if (
            body.gaps &&
            body.gaps.gaps &&
            interviewSession.telemetryData.gapAnalysis
        ) {
            // Delete existing gaps
            await prisma.gap.deleteMany({
                where: {
                    gapAnalysisId:
                        interviewSession.telemetryData.gapAnalysis.id,
                },
            });

            // Create new gaps
            for (const gap of body.gaps.gaps) {
                await prisma.gap.create({
                    data: {
                        gapAnalysisId:
                            interviewSession.telemetryData.gapAnalysis.id,
                        severity: gap.severity,
                        description: gap.description,
                        color: gap.color,
                        evidenceLinks: gap.evidenceLinks || [],
                    },
                });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating candidate telemetry:", error);
        return NextResponse.json(
            { error: "Failed to update telemetry data" },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
