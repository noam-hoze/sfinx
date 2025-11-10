import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

type RouteContext = {
    params: Promise<{ id?: string | string[] }>;
};

function normalizeId(id: string | string[] | undefined) {
    if (Array.isArray(id)) {
        return id[0] ?? "";
    }
    return id ?? "";
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const candidateId = normalizeId(id);

        log.info("[Telemetry API] GET request for candidateId:", candidateId);

        if (!candidateId) {
            return NextResponse.json(
                { error: "Candidate id is required" },
                { status: 400 }
            );
        }
        const applicationId = request.nextUrl.searchParams.get("applicationId");
        log.info("[Telemetry API] applicationId:", applicationId);

        // Get all interview sessions for this candidate (newest first)
        let interviewSessions = await prisma.interviewSession.findMany({
            where: {
                candidateId: candidateId,
                ...(applicationId ? { applicationId } : {}),
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

        // No fallback: require sessions to match the provided applicationId (if any)

        if (!interviewSessions.length) {
            // Return minimal candidate info with empty sessions (no fallback data)
            const candidate = await prisma.user.findUnique({
                where: { id: candidateId },
                select: { id: true, name: true, image: true },
            });

            if (!candidate) {
                return NextResponse.json(
                    { error: "Candidate not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                candidate: {
                    id: candidate.id,
                    name: candidate.name,
                    image: candidate.image,
                    matchScore: null,
                    confidence: null,
                    story: null,
                },
                sessions: [],
            });
        }

        const candidate = interviewSessions[0].candidate;

        log.info("[Telemetry API] Found candidate:", candidate?.id, "Sessions:", interviewSessions.length);

        // Fetch iterations for all sessions to generate evidence links
        const sessionIds = interviewSessions.map((s: any) => s.id);
        const allIterations = await prisma.iteration.findMany({
            where: {
                interviewSessionId: { in: sessionIds },
            },
            select: {
                interviewSessionId: true,
                timestamp: true,
                caption: true,
                evaluation: true,
                matchPercentage: true,
            },
        });

        // Fetch debug loops for all sessions
        const allDebugLoops = await prisma.debugLoop.findMany({
            where: {
                interviewSessionId: { in: sessionIds },
            },
            select: {
                interviewSessionId: true,
                startTimestamp: true,
                endTimestamp: true,
                errorCount: true,
                resolved: true,
                caption: true,
            },
            orderBy: {
                errorCount: "desc", // Order by error count for selecting longest loops
            },
        });

        // Fetch external tool usages for all sessions
        const allExternalToolUsages = await prisma.externalToolUsage.findMany({
            where: {
                interviewSessionId: { in: sessionIds },
            },
            select: {
                interviewSessionId: true,
                timestamp: true,
                aiQuestionTimestamp: true,
                understanding: true,
                accountabilityScore: true,
                caption: true,
            },
        });

        // Group iterations by session
        const iterationsBySession = new Map<string, any[]>();
        for (const iter of allIterations) {
            if (!iterationsBySession.has(iter.interviewSessionId)) {
                iterationsBySession.set(iter.interviewSessionId, []);
            }
            iterationsBySession.get(iter.interviewSessionId)!.push(iter);
        }

        // Group debug loops by session
        const debugLoopsBySession = new Map<string, any[]>();
        for (const loop of allDebugLoops) {
            if (!debugLoopsBySession.has(loop.interviewSessionId)) {
                debugLoopsBySession.set(loop.interviewSessionId, []);
            }
            debugLoopsBySession.get(loop.interviewSessionId)!.push(loop);
        }

        // Group external tool usages by session
        const externalToolsBySession = new Map<string, any[]>();
        for (const tool of allExternalToolUsages) {
            if (!externalToolsBySession.has(tool.interviewSessionId)) {
                externalToolsBySession.set(tool.interviewSessionId, []);
            }
            externalToolsBySession.get(tool.interviewSessionId)!.push(tool);
        }

        // Transform sessions array
        const sessions = interviewSessions.map((session: any) => {
            try {
                log.info("[Telemetry API] Processing session:", session.id, "videoUrl from DB:", session.videoUrl);
                const telemetry = session.telemetryData;
                const evidenceClips = telemetry?.evidenceClips || [];
                const sessionIterations = iterationsBySession.get(session.id) || [];

                const iterationSpeedLinks: number[] = [];
                const debugLoopsLinks: number[] = [];
                const refactorCleanupsLinks: number[] = [];
                const aiAssistUsageLinks: number[] = [];

                // Add iteration evidence links (calculate video offset from recordingStartedAt)
                if (session.recordingStartedAt) {
                    sessionIterations.forEach((iter: any) => {
                        const videoOffset = (new Date(iter.timestamp).getTime() - new Date(session.recordingStartedAt).getTime()) / 1000;
                        if (videoOffset >= 0) {
                            iterationSpeedLinks.push(videoOffset);
                        }
                    });
                }

                // Add debug loop evidence links (all resolved loops)
                const sessionDebugLoops = debugLoopsBySession.get(session.id) || [];
                if (session.recordingStartedAt && sessionDebugLoops.length > 0) {
                    sessionDebugLoops
                        .filter((loop: any) => loop.resolved)
                        .forEach((loop: any) => {
                            // Use endTimestamp (resolution moment) for video evidence
                            const videoOffset = (new Date(loop.endTimestamp).getTime() - new Date(session.recordingStartedAt).getTime()) / 1000;
                            if (videoOffset >= 0) {
                                debugLoopsLinks.push(videoOffset);
                            }
                        });
                }

                // Add external tool usage evidence links and calculate breakdown
                const sessionExternalTools = externalToolsBySession.get(session.id) || [];
                let fullCount = 0;
                let partialCount = 0;
                let noneCount = 0;
                let totalScore = 0;
                
                if (session.recordingStartedAt && sessionExternalTools.length > 0) {
                    sessionExternalTools.forEach((tool: any) => {
                        // Use aiQuestionTimestamp (when paste was first detected)
                        const videoOffset = (new Date(tool.aiQuestionTimestamp).getTime() - new Date(session.recordingStartedAt).getTime()) / 1000;
                        if (videoOffset >= 0) {
                            aiAssistUsageLinks.push(videoOffset);
                        }
                        
                        // Count understanding levels
                        if (tool.understanding === "FULL") fullCount++;
                        else if (tool.understanding === "PARTIAL") partialCount++;
                        else if (tool.understanding === "NONE") noneCount++;
                        
                        // Sum accountability scores
                        totalScore += tool.accountabilityScore || 0;
                    });
                }
                
                const avgAccountabilityScore = sessionExternalTools.length > 0 
                    ? Math.round(totalScore / sessionExternalTools.length) 
                    : 0;

                evidenceClips.forEach((clip: any) => {
                    if (clip.startTime === null || clip.startTime === undefined)
                        return;
                    // Prefer explicit category if available; fallback to title heuristics
                    if (
                        clip.category === "ITERATION_SPEED" ||
                        clip.title.includes("Iteration Speed")
                    ) {
                        iterationSpeedLinks.push(clip.startTime);
                    }
                    if (
                        clip.category === "DEBUG_LOOP" ||
                        clip.title.includes("Debug Loop")
                    ) {
                        debugLoopsLinks.push(clip.startTime);
                    }
                    if (
                        clip.category === "REFACTOR_CLEANUPS" ||
                        clip.title.includes("Refactor")
                    ) {
                        refactorCleanupsLinks.push(clip.startTime);
                    }
                    if (
                        clip.category === "AI_ASSIST_USAGE" ||
                        clip.title.includes("AI Assist")
                    ) {
                        aiAssistUsageLinks.push(clip.startTime);
                    }
                });

                return {
                    id: session.id,
                    createdAt: session.createdAt,
                    videoUrl: session.videoUrl,
                    duration: session.duration,
                    matchScore: telemetry?.matchScore ?? null,
                    confidence: telemetry?.confidence ?? null,
                    story: telemetry?.story ?? null,
                    gaps: {
                        gaps:
                            telemetry?.gapAnalysis?.gaps.map((gap: any) => ({
                                severity: gap.severity,
                                description: gap.description,
                                color: gap.color,
                                evidenceLinks: gap.evidenceLinks,
                            })) || [],
                    },
                    evidence: telemetry?.evidenceClips?.map((clip: any) => ({
                        id: clip.id,
                        title: clip.title,
                        thumbnailUrl: clip.thumbnailUrl,
                        duration: clip.duration,
                        description: clip.description,
                        startTime: clip.startTime,
                    })) || [],
                    chapters: telemetry?.videoChapters?.map((chapter: any) => ({
                        id: chapter.id,
                        title: chapter.title,
                        startTime: chapter.startTime,
                        endTime: chapter.endTime,
                        description: chapter.description,
                        thumbnailUrl: chapter.thumbnailUrl,
                        captions: chapter.captions?.map((caption: any) => ({
                            text: caption.text,
                            startTime: caption.startTime,
                            endTime: caption.endTime,
                        })) || [],
                    })) || [],
                    workstyle: telemetry?.workstyleMetrics
                        ? {
                              iterationSpeed: {
                                  value: telemetry.workstyleMetrics.iterationSpeed,
                                  level:
                                      telemetry.workstyleMetrics.iterationSpeed >= 10
                                          ? "High"
                                          : telemetry.workstyleMetrics.iterationSpeed >= 5
                                          ? "Moderate"
                                          : "Low",
                                  color:
                                      telemetry.workstyleMetrics.iterationSpeed >= 10
                                          ? "blue"
                                          : telemetry.workstyleMetrics.iterationSpeed >= 5
                                          ? "yellow"
                                          : "red",
                                  evidenceLinks: iterationSpeedLinks,
                                  tpe: telemetry.workstyleMetrics.iterationSpeed || 0,
                              },
                              debugLoops: (() => {
                                  const loops = sessionDebugLoops.filter((loop: any) => loop.resolved);
                                  const totalLoops = loops.length;
                                  const totalErrors = loops.reduce((sum: number, loop: any) => sum + loop.errorCount, 0);
                                  const avgDepth = totalLoops > 0 ? totalErrors / totalLoops : 0;
                                  const longestLoop = loops.length > 0 
                                      ? Math.max(...loops.map((loop: any) => loop.errorCount))
                                      : 0;
                                  
                                  return {
                                      value: totalLoops,
                                      level: avgDepth < 2 ? "Fast" : avgDepth <= 4 ? "Moderate" : "Slow",
                                      color: avgDepth < 2 ? "blue" : avgDepth <= 4 ? "yellow" : "red",
                                      evidenceLinks: debugLoopsLinks,
                                      tpe: totalLoops,
                                      avgDepth: Math.round(avgDepth * 10) / 10, // Round to 1 decimal
                                      longestLoop,
                                      unresolved: sessionDebugLoops.filter((loop: any) => !loop.resolved).length,
                                  };
                              })(),
                              refactorCleanups: {
                                  value: telemetry.workstyleMetrics.refactorCleanups,
                                  level:
                                      telemetry.workstyleMetrics.refactorCleanups >= 80
                                          ? "Strong"
                                          : telemetry.workstyleMetrics.refactorCleanups >= 60
                                          ? "Moderate"
                                          : "Weak",
                                  color:
                                      telemetry.workstyleMetrics.refactorCleanups >= 80
                                          ? "blue"
                                          : telemetry.workstyleMetrics.refactorCleanups >= 60
                                          ? "yellow"
                                          : "red",
                                  evidenceLinks: refactorCleanupsLinks,
                                  // TPE center value (counts scale)
                                  tpe: 1,
                              },
                              aiAssistUsage: {
                                  value: telemetry.workstyleMetrics.externalToolUsage,
                                  level:
                                      avgAccountabilityScore >= 70
                                          ? "High"
                                          : avgAccountabilityScore >= 40
                                          ? "Moderate"
                                          : "Low",
                                  color:
                                      avgAccountabilityScore >= 70
                                          ? "blue"
                                          : avgAccountabilityScore >= 40
                                          ? "yellow"
                                          : "red",
                                  isFairnessFlag:
                                      telemetry.workstyleMetrics.externalToolUsage > 50,
                                  evidenceLinks: aiAssistUsageLinks,
                                  // TPE center value (counts scale)
                                  tpe: 1,
                                  // External tool usage breakdown
                                  fullCount,
                                  partialCount,
                                  noneCount,
                                  avgAccountabilityScore,
                              },
                          }
                        : null,
                    hasFairnessFlag: telemetry?.hasFairnessFlag ?? false,
                    // Include new analytics series (may be empty arrays)
                    persistenceFlow: telemetry?.persistenceFlow || [],
                    learningToAction: telemetry?.learningToAction || [],
                    confidenceCurve: telemetry?.confidenceCurve || [],
                };
            } catch (sessionError) {
                log.error("[Telemetry API] Error processing session:", session.id, sessionError);
                throw sessionError;
            }
        });

        const response = {
            candidate: {
                id: candidate.id,
                name: candidate.name,
                image: candidate.image,
                // For convenience, surface the latest session's match/confidence
                matchScore: interviewSessions[0]?.telemetryData?.matchScore ?? null,
                confidence: interviewSessions[0]?.telemetryData?.confidence ?? null,
                story: interviewSessions[0]?.telemetryData?.story ?? null,
            },
            sessions,
        };

        log.info("[Telemetry API] Returning sessions count:", sessions.length);
        log.info("[Telemetry API] First session videoUrl:", sessions[0]?.videoUrl);

        return NextResponse.json(response);
    } catch (error) {
        log.error("[Telemetry API GET] Error:", error);
        if (error instanceof Error) {
            log.error("[Telemetry API GET] Error message:", error.message);
            log.error("[Telemetry API GET] Error stack:", error.stack);
        }
        return NextResponse.json(
            { error: "Failed to fetch telemetry data" },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params;
        const candidateId = normalizeId(id);

        if (!candidateId) {
            return NextResponse.json(
                { error: "Candidate id is required" },
                { status: 400 }
            );
        }
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
                workstyleData.iterationSpeed = body.workstyle.iterationSpeed.value;
            }
            if (body.workstyle.debugLoops?.value !== undefined) {
                workstyleData.debugLoops = body.workstyle.debugLoops.value;
            }
            if (body.workstyle.refactorCleanups?.value !== undefined) {
                workstyleData.refactorCleanups =
                    body.workstyle.refactorCleanups.value;
            }
            if (body.workstyle.aiAssistUsage?.value !== undefined) {
                workstyleData.externalToolUsage = body.workstyle.aiAssistUsage.value;
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
                        const categoryMap: Record<string, string> = {
                            "Iteration Speed": "ITERATION_SPEED",
                            "Debug Loop": "DEBUG_LOOP",
                            "Refactor & Cleanups": "REFACTOR_CLEANUPS",
                            "AI Assist Usage": "AI_ASSIST_USAGE",
                        };
                        const category = categoryMap[metric.title];

                        await prisma.evidenceClip.create({
                            data: {
                                telemetryDataId: telemetryId,
                                title: metric.title,
                                startTime: timestamp,
                                description: `Evidence for ${metric.title}`, // Placeholder
                                duration: 5, // Placeholder
                                ...(category ? { category: category as any } : {}),
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
                    gapAnalysisId: interviewSession.telemetryData.gapAnalysis.id,
                },
            });

            // Create new gaps
            for (const gap of body.gaps.gaps) {
                await prisma.gap.create({
                    data: {
                        gapAnalysisId: interviewSession.telemetryData.gapAnalysis.id,
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
        log.error("Error updating candidate telemetry:", error);
        return NextResponse.json(
            { error: "Failed to update telemetry data" },
            { status: 500 }
        );
    }
}
