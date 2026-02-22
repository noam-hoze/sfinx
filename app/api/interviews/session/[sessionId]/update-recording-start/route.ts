import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import prisma from "lib/prisma";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

type RouteContext = {
    params: Promise<{ sessionId?: string | string[] }>;
};

function normalizeSessionId(sessionId: string | string[] | undefined) {
    if (Array.isArray(sessionId)) {
        return sessionId[0] ?? "";
    }
    return sessionId ?? "";
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        log.info(LOG_CATEGORY, "[Update Recording Start] === REQUEST RECEIVED ===");

        const session = await getServerSession(authOptions);
        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);

        if (!sessionId) {
            log.error(LOG_CATEGORY, "[Update Recording Start] ❌ No session ID provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[Update Recording Start] Session ID:", sessionId);

        const userId = (session?.user as any)?.id;

        if (!userId) {
            log.error(LOG_CATEGORY, "[Update Recording Start] ❌ No user ID found");
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { recordingStartedAt } = body;

        if (!recordingStartedAt) {
            log.error(LOG_CATEGORY, "[Update Recording Start] ❌ No recordingStartedAt provided");
            return NextResponse.json(
                { error: "recordingStartedAt is required" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[Update Recording Start] New recording start time:", recordingStartedAt);
        
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                candidateId: userId,
            },
            include: { telemetryData: { include: { gapAnalysis: true } } },
        });

        if (!interviewSession) {
            log.error(LOG_CATEGORY, "[Update Recording Start] Interview session not found");
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        const telemetryId = interviewSession.telemetryData?.id;
        const gapAnalysisId = interviewSession.telemetryData?.gapAnalysis?.id;

        // Wipe all evidence/contribution data from any previous run so the
        // interview starts with a clean slate. Warmup shell records
        // (TelemetryData, WorkstyleMetrics, GapAnalysis) are preserved.
        await prisma.$transaction([
            prisma.categoryContribution.deleteMany({ where: { interviewSessionId: sessionId } }),
            prisma.externalToolUsage.deleteMany({ where: { interviewSessionId: sessionId } }),
            prisma.iteration.deleteMany({ where: { interviewSessionId: sessionId } }),
            prisma.conversationMessage.deleteMany({ where: { interviewSessionId: sessionId } }),
            ...(telemetryId ? [
                prisma.evidenceClip.deleteMany({ where: { telemetryDataId: telemetryId } }),
                prisma.backgroundEvidence.deleteMany({ where: { telemetryDataId: telemetryId } }),
                prisma.videoChapter.deleteMany({ where: { telemetryDataId: telemetryId } }),
                prisma.backgroundSummary.deleteMany({ where: { telemetryDataId: telemetryId } }),
                prisma.codingSummary.deleteMany({ where: { telemetryDataId: telemetryId } }),
            ] : []),
            ...(gapAnalysisId ? [
                prisma.gap.deleteMany({ where: { gapAnalysisId } }),
            ] : []),
            ...(telemetryId ? [
                prisma.workstyleMetrics.updateMany({
                    where: { telemetryDataId: telemetryId },
                    data: { refactorCleanups: null, aiAssistUsage: null, externalToolUsage: null },
                }),
                prisma.telemetryData.update({
                    where: { id: telemetryId },
                    data: {
                        matchScore: 0, confidence: "Unknown", story: "",
                        storyEmphasis: null, hasFairnessFlag: false,
                        persistenceFlow: null, learningToAction: null, confidenceCurve: null,
                    },
                }),
            ] : []),
        ]);

        log.info(LOG_CATEGORY, "[Update Recording Start] Cleaned stale data for session:", sessionId);

        const updatedSession = await prisma.interviewSession.update({
            where: { id: sessionId },
            data: {
                recordingStartedAt: new Date(recordingStartedAt),
                videoUrl: null,
            },
        });

        log.info(LOG_CATEGORY, "[Update Recording Start] ✅ Updated session:", {
            id: updatedSession.id,
            recordingStartedAt: updatedSession.recordingStartedAt,
        });

        return NextResponse.json({
            message: "Recording start time updated successfully",
            interviewSession: updatedSession,
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[Update Recording Start] ❌ ERROR:", error);
        return NextResponse.json(
            { error: "Failed to update recording start time" },
            { status: 500 }
        );
    }
}

