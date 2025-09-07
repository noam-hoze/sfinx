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

        // Get the most recent interview session for this candidate that has telemetry data
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

        // Parse stored workstyle evidence links from story field
        let storedWorkstyleLinks = {};
        let actualStory = "";
        try {
            if (telemetry.story) {
                if (telemetry.story.startsWith("{")) {
                    const parts = telemetry.story.split("\n\n", 2);
                    if (parts.length > 1) {
                        storedWorkstyleLinks = JSON.parse(parts[0]);
                        actualStory = parts[1];
                    } else {
                        storedWorkstyleLinks = JSON.parse(telemetry.story);
                    }
                } else {
                    actualStory = telemetry.story;
                }
            }
        } catch (e) {
            // If parsing fails, use defaults and keep the story as is
            storedWorkstyleLinks = {};
            actualStory = telemetry.story || "";
        }

        // Transform the data to match the expected frontend format
        const transformedData = {
            candidate: {
                id: candidate.id,
                name: candidate.name || "Anonymous",
                image: candidate.image,
                matchScore: telemetry.matchScore,
                confidence: telemetry.confidence,
                story: actualStory,
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
                thumbnailUrl: clip.thumbnailUrl || "/mock/clip.jpg",
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
                thumbnailUrl: chapter.thumbnailUrl || "/mock/chapter.jpg",
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
                          evidenceLinks: (storedWorkstyleLinks as any)
                              ?.iterationSpeed || [45, 75, 120, 135],
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
                          evidenceLinks: (storedWorkstyleLinks as any)
                              ?.debugLoops || [95, 120],
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
                          evidenceLinks: (storedWorkstyleLinks as any)
                              ?.refactorCleanups || [190, 205, 210, 220, 230],
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
                          evidenceLinks: (storedWorkstyleLinks as any)
                              ?.aiAssistUsage || [25],
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

            // Store evidence links in the story field as JSON
            const evidenceLinksData = {
                iterationSpeed:
                    body.workstyle.iterationSpeed?.evidenceLinks || [],
                debugLoops: body.workstyle.debugLoops?.evidenceLinks || [],
                refactorCleanups:
                    body.workstyle.refactorCleanups?.evidenceLinks || [],
                aiAssistUsage:
                    body.workstyle.aiAssistUsage?.evidenceLinks || [],
            };

            // Get current story to preserve it if it's not JSON
            const currentStory = interviewSession.telemetryData.story;
            let storyToSave = currentStory;

            if (currentStory && !currentStory.startsWith("{")) {
                // Preserve existing story and add evidence links as JSON prefix
                storyToSave =
                    JSON.stringify(evidenceLinksData) + "\n\n" + currentStory;
            } else {
                // Replace or set evidence links JSON
                storyToSave = JSON.stringify(evidenceLinksData);
            }

            await prisma.telemetryData.update({
                where: { id: telemetryId },
                data: {
                    story: storyToSave,
                },
            });
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
