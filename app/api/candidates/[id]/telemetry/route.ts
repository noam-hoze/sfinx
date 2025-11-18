import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import prisma from "lib/prisma";
import { calculateScore, type RawScores, type WorkstyleMetrics, type ScoringConfiguration } from "app/shared/utils/calculateScore";

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
                application: {
                    include: {
                        job: true,
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
                id: true,
                interviewSessionId: true,
                timestamp: true,
                caption: true,
                evaluation: true,
                matchPercentage: true,
            },
        });

        // Fetch VideoChapters for iterations to get the stored startTime
        const iterationIds = allIterations.map((iter: any) => iter.id);
        const iterationVideoChapters = await prisma.videoChapter.findMany({
            where: {
                title: {
                    startsWith: "Iteration",
                },
                telemetryData: {
                    interviewSession: {
                        id: { in: sessionIds },
                    },
                },
            },
            select: {
                title: true,
                startTime: true,
                telemetryData: {
                    select: {
                        interviewSessionId: true,
                    },
                },
            },
        });

        // Fetch scoring configurations for all jobs
        const jobIds = [...new Set(interviewSessions.map((s: any) => s.application?.job?.id).filter(Boolean))];
        const scoringConfigs = await prisma.scoringConfiguration.findMany({
            where: {
                jobId: { in: jobIds },
            },
        });
        const scoringConfigsByJobId = new Map(scoringConfigs.map(c => [c.jobId, c]));

        // Fetch background summaries for all sessions
        const backgroundSummaries = await prisma.backgroundSummary.findMany({
            where: {
                telemetryData: {
                    interviewSessionId: { in: sessionIds },
                },
            },
            include: {
                telemetryData: {
                    select: {
                        interviewSessionId: true,
                    },
                },
            },
        });
        const backgroundSummariesBySessionId = new Map(
            backgroundSummaries.map(s => [s.telemetryData.interviewSessionId, s])
        );

        // Fetch coding summaries for all sessions
        const codingSummaries = await prisma.codingSummary.findMany({
            where: {
                telemetryData: {
                    interviewSessionId: { in: sessionIds },
                },
            },
            include: {
                telemetryData: {
                    select: {
                        interviewSessionId: true,
                    },
                },
            },
        });
        const codingSummariesBySessionId = new Map(
            codingSummaries.map(s => [s.telemetryData.interviewSessionId, s])
        );

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

        // Group iteration video chapters by session for evidence links
        const iterationVideoChaptersBySession = new Map<string, any[]>();
        for (const chapter of iterationVideoChapters) {
            const sessionId = chapter.telemetryData.interviewSessionId;
            if (!iterationVideoChaptersBySession.has(sessionId)) {
                iterationVideoChaptersBySession.set(sessionId, []);
            }
            iterationVideoChaptersBySession.get(sessionId)!.push(chapter);
        }
        
        log.info("[Telemetry API] Fetched iteration video chapters:", iterationVideoChapters.length);
        iterationVideoChapters.forEach((chapter: any) => {
            log.info(`  - ${chapter.title}: startTime=${chapter.startTime}s, sessionId=${chapter.telemetryData.interviewSessionId}`);
        });

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
                const aiAssistUsageLinks: number[] = [];

                // Add iteration evidence links using stored VideoChapter.startTime
                const sessionIterationChapters = iterationVideoChaptersBySession.get(session.id) || [];
                log.info(`[Telemetry API] Session ${session.id}: Found ${sessionIterationChapters.length} iteration video chapters`);
                sessionIterationChapters.forEach((chapter: any) => {
                    log.info(`  - Adding iteration evidence link: ${chapter.title} at ${chapter.startTime}s`);
                    if (chapter.startTime >= 0) {
                        iterationSpeedLinks.push(chapter.startTime);
                    }
                });

                // Add external tool usage evidence links and calculate breakdown
                const sessionExternalTools = externalToolsBySession.get(session.id) || [];
                let fullCount = 0;
                let partialCount = 0;
                let noneCount = 0;
                let totalScore = 0;
                
                if (session.recordingStartedAt && sessionExternalTools.length > 0) {
                    log.info("🎬 [TELEMETRY EXTERNAL TOOLS OFFSET DEBUG] ============");
                    log.info("📹 Recording started at:", new Date(session.recordingStartedAt).toISOString());
                    log.info("📋 Processing", sessionExternalTools.length, "external tool events");
                    
                    sessionExternalTools.forEach((tool: any, index: number) => {
                        // Use timestamp (when paste actually happened)
                        const pasteTime = new Date(tool.timestamp);
                        const recordingStartTime = new Date(session.recordingStartedAt);
                        const videoOffset = (pasteTime.getTime() - recordingStartTime.getTime()) / 1000;
                        
                        log.info(`  [${index + 1}] Paste at:`, pasteTime.toISOString());
                        log.info(`  [${index + 1}] Offset:`, videoOffset, "seconds");
                        
                        if (videoOffset >= 0) {
                            aiAssistUsageLinks.push(videoOffset);
                        } else {
                            log.warn(`  [${index + 1}] ⚠️ NEGATIVE OFFSET - skipping!`);
                        }
                        
                        // Count understanding levels
                        if (tool.understanding === "FULL") fullCount++;
                        else if (tool.understanding === "PARTIAL") partialCount++;
                        else if (tool.understanding === "NONE") noneCount++;
                        
                        // Sum accountability scores
                        totalScore += tool.accountabilityScore || 0;
                    });
                    
                    log.info("🎯 Total evidence links for External Tools:", aiAssistUsageLinks.length);
                    log.info("📍 Links:", aiAssistUsageLinks);
                    log.info("================================================");
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
                        clip.category === "AI_ASSIST_USAGE" ||
                        clip.title.includes("AI Assist")
                    ) {
                        aiAssistUsageLinks.push(clip.startTime);
                    }
                });

                // Calculate score using scoring configuration
                let calculatedScore: number | null = null;
                const jobId = session.application?.job?.id;
                const scoringConfig = jobId ? scoringConfigsByJobId.get(jobId) : null;
                const backgroundSummary = backgroundSummariesBySessionId.get(session.id);
                const codingSummary = codingSummariesBySessionId.get(session.id);

                if (scoringConfig && backgroundSummary && codingSummary && telemetry?.workstyleMetrics) {
                    try {
                        const rawScores: RawScores = {
                            adaptability: backgroundSummary.adaptabilityScore,
                            creativity: backgroundSummary.creativityScore,
                            reasoning: backgroundSummary.reasoningScore,
                            codeQuality: codingSummary.codeQualityScore,
                            problemSolving: codingSummary.problemSolvingScore,
                        };

                        const sessionExternalTools = externalToolsBySession.get(session.id) || [];
                        const totalScore = sessionExternalTools.reduce((sum: number, tool: any) => 
                            sum + (tool.accountabilityScore || 0), 0);
                        const avgAccountabilityScore = sessionExternalTools.length > 0 
                            ? Math.round(totalScore / sessionExternalTools.length) 
                            : 100;

                        const workstyleMetrics: WorkstyleMetrics = {
                            iterationSpeed: telemetry.workstyleMetrics.iterationSpeed ?? undefined,
                            aiAssistAccountabilityScore: avgAccountabilityScore,
                        };

                        const result = calculateScore(rawScores, workstyleMetrics, scoringConfig as ScoringConfiguration);
                        calculatedScore = result.finalScore;
                        log.info(`[Telemetry API] Calculated score for session ${session.id}:`, calculatedScore);
                    } catch (error) {
                        log.error(`[Telemetry API] Error calculating score for session ${session.id}:`, error);
                    }
                }

                return {
                    id: session.id,
                    createdAt: session.createdAt,
                    videoUrl: session.videoUrl,
                    duration: session.duration,
                    matchScore: telemetry?.matchScore ?? null,
                    calculatedScore,
                    confidence: telemetry?.confidence ?? null,
                    story: telemetry?.story ?? null,
                    application: session.application ? {
                        id: session.application.id,
                        job: session.application.job ? {
                            id: session.application.job.id,
                            title: session.application.job.title,
                        } : null,
                    } : null,
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
                                  value: telemetry.workstyleMetrics.iterationSpeed ?? 0,
                                  level:
                                      (telemetry.workstyleMetrics.iterationSpeed ?? 0) >= 10
                                          ? "High"
                                          : (telemetry.workstyleMetrics.iterationSpeed ?? 0) >= 5
                                          ? "Moderate"
                                          : "Low",
                                  color:
                                      (telemetry.workstyleMetrics.iterationSpeed ?? 0) >= 10
                                          ? "blue"
                                          : (telemetry.workstyleMetrics.iterationSpeed ?? 0) >= 5
                                          ? "yellow"
                                          : "red",
                                  evidenceLinks: iterationSpeedLinks,
                                  tpe: telemetry.workstyleMetrics.iterationSpeed ?? 0,
                              },
                              aiAssistUsage: {
                                  value: telemetry.workstyleMetrics.externalToolUsage ?? 0,
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
                                      (telemetry.workstyleMetrics.externalToolUsage ?? 0) > 50,
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
