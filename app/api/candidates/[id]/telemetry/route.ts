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

        // Transform the data to match the expected frontend format
        const transformedData = {
            candidate: {
                id: candidate.id,
                name: candidate.name || "Anonymous",
                image: candidate.image,
                matchScore: telemetry.matchScore,
                confidence: telemetry.confidence,
                story: telemetry.story,
            },
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
                          evidenceLinks: [45, 75, 120, 135],
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
                          evidenceLinks: [95, 120],
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
                          evidenceLinks: [190, 205, 210, 220, 230],
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
                          evidenceLinks: [25],
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
