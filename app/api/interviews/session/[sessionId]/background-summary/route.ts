import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "app/shared/services/auth";
import { log } from "app/shared/services";
import OpenAI from "openai";
import {
    buildBackgroundSummaryPrompt,
    SUMMARY_MODEL,
    SUMMARY_TEMPERATURE,
    type SummaryOutput,
} from "@/shared/prompts/backgroundSummaryPrompt";
import prisma from "lib/prisma";

type RouteContext = {
    params: Promise<{ sessionId?: string | string[] }>;
};

function normalizeSessionId(sessionId: string | string[] | undefined) {
    if (Array.isArray(sessionId)) {
        return sessionId[0] ?? "";
    }
    return sessionId ?? "";
}

// GET: Retrieve existing background summary
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        log.info("Background summary retrieval API called");

        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);

        if (!sessionId) {
            log.warn("❌ Interview session id was not provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        // Verify the interview session exists
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
            },
            include: {
                telemetryData: {
                    include: {
                        backgroundSummary: true,
                    },
                },
            },
        });

        if (!interviewSession) {
            log.warn("❌ Interview session not found");
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        const summary = interviewSession.telemetryData?.backgroundSummary;

        if (!summary) {
            log.info("No background summary found for session");
            return NextResponse.json(
                { error: "Background summary not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            summary: {
                id: summary.id,
                executiveSummary: summary.executiveSummary,
                executiveSummaryOneLiner: summary.executiveSummaryOneLiner,
                recommendation: summary.recommendation,
                adaptability: {
                    score: summary.adaptabilityScore,
                    text: summary.adaptabilityText,
                    oneLiner: summary.adaptabilityOneLiner,
                },
                creativity: {
                    score: summary.creativityScore,
                    text: summary.creativityText,
                    oneLiner: summary.creativityOneLiner,
                },
                reasoning: {
                    score: summary.reasoningScore,
                    text: summary.reasoningText,
                    oneLiner: summary.reasoningOneLiner,
                },
                conversationJson: summary.conversationJson,
                evidenceJson: summary.evidenceJson,
                generatedAt: summary.generatedAt,
            },
        });
    } catch (error) {
        log.error("❌ Error retrieving background summary:", error);
        return NextResponse.json(
            { error: "Failed to retrieve background summary" },
            { status: 500 }
        );
    }
}

// POST: Generate background summary
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        log.info("[background-summary/POST] ========== START ==========");

        const url = new URL(request.url);
        const skipAuth = url.searchParams.get("skip-auth") === "true";

        const session = await getServerSession(authOptions);
        log.info("[background-summary/POST] Session:", session ? `Found (user: ${(session.user as any)?.email})` : "Not found");
        log.info("[background-summary/POST] Skip auth:", skipAuth);

        const body = await request.json();
        const { scores, rationales, companyName, roleName, userId: requestUserId } = body;

        let userId: string;

        if (skipAuth) {
            if (!requestUserId) {
                log.warn("[background-summary/POST] ❌ skip-auth mode but no userId provided in request");
                return NextResponse.json(
                    { error: "userId required when skip-auth=true" },
                    { status: 400 }
                );
            }
            userId = requestUserId;
            log.info("[background-summary/POST] ✅ Skip auth - User ID from request:", userId);
        } else {
            if (!session?.user) {
                log.warn("[background-summary/POST] ❌ Unauthorized request");
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            userId = (session.user as any).id;
            log.info("[background-summary/POST] ✅ User ID from session:", userId);
        }

        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);
        log.info("[background-summary/POST] userId:", userId);
        log.info("[background-summary/POST] sessionId (raw):", rawSessionId);
        log.info("[background-summary/POST] sessionId (normalized):", sessionId);

        if (!sessionId) {
            log.warn("[background-summary/POST] ❌ Interview session id was not provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        // Verify the interview session exists and belongs to the user
        log.info("[background-summary/POST] Looking up interview session...");
        const interviewSession = await prisma.interviewSession.findFirst({
            where: {
                id: sessionId,
                candidateId: userId,
            },
            include: {
                telemetryData: {
                    include: {
                        backgroundSummary: true,
                    },
                },
                application: {
                    include: {
                        job: {
                            include: {
                                company: true,
                            },
                        },
                    },
                },
            },
        });

        if (!interviewSession) {
            log.warn("[background-summary/POST] ❌ Interview session not found or doesn't belong to user");
            log.warn("[background-summary/POST] Searched for: sessionId=", sessionId, "candidateId=", userId);
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        log.info("[background-summary/POST] ✅ Interview session found:", interviewSession.id);
        log.info("[background-summary/POST] Has telemetryData:", !!interviewSession.telemetryData);
        log.info("[background-summary/POST] Has backgroundSummary:", !!interviewSession.telemetryData?.backgroundSummary);

        // Check if summary already exists
        if (interviewSession.telemetryData?.backgroundSummary) {
            log.info("[background-summary/POST] ⚠️ Background summary already exists for session, skipping generation");
            return NextResponse.json(
                { message: "Background summary already exists" },
                { status: 200 }
            );
        }

        // Ensure telemetry data exists
        if (!interviewSession.telemetryData) {
            log.warn("[background-summary/POST] ❌ No telemetry data found for session");
            return NextResponse.json(
                { error: "Telemetry data not found" },
                { status: 404 }
            );
        }

        log.info("[background-summary/POST] TelemetryData ID:", interviewSession.telemetryData.id);

        log.info("[background-summary/POST] Request body:", { scores, rationales, companyName, roleName });

        if (!scores || typeof scores.adaptability !== "number") {
            log.warn("[background-summary/POST] ⚠️ No valid scores provided, will ask AI to estimate them.");
            // Proceed without scores
        }

        // Fetch background messages
        log.info("[background-summary/POST] Fetching conversation messages...");
        const messages = await prisma.conversationMessage.findMany({
            where: {
                interviewSessionId: sessionId,
                stage: "background",
            },
            orderBy: {
                timestamp: "asc",
            },
        });

        log.info("[background-summary/POST] Found", messages.length, "background messages");

        if (messages.length === 0) {
            log.warn("[background-summary/POST] ❌ No background messages found in DB");
            return NextResponse.json(
                { error: "No background conversation found" },
                { status: 400 }
            );
        }

        log.info(`[background-summary/POST] Generating summary from ${messages.length} messages...`);

        // Build prompt
        const prompt = buildBackgroundSummaryPrompt({
            messages: messages.map((m) => ({
                speaker: m.speaker,
                text: m.text,
                timestamp: m.timestamp.getTime(),
            })),
            scores: scores ? {
                adaptability: scores.adaptability,
                creativity: scores.creativity,
                reasoning: scores.reasoning,
            } : undefined,
            rationales,
            companyName:
                companyName || interviewSession.application.job.company.name,
            roleName: roleName || interviewSession.application.job.title,
        });

        // Call OpenAI
        log.info("[background-summary/POST] Checking OpenAI API key...");
        const openaiApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
            log.error("[background-summary/POST] ❌ OpenAI API key not configured");
            return NextResponse.json(
                { error: "OpenAI API key not configured" },
                { status: 500 }
            );
        }

        log.info("[background-summary/POST] Calling OpenAI with model:", SUMMARY_MODEL, "temperature:", SUMMARY_TEMPERATURE);
        const openai = new OpenAI({ apiKey: openaiApiKey });

        const completion = await openai.chat.completions.create({
            model: SUMMARY_MODEL,
            temperature: SUMMARY_TEMPERATURE,
            messages: [
                {
                    role: "system",
                    content: prompt,
                },
            ],
        });

        const responseText = completion.choices[0]?.message?.content;
        log.info("[background-summary/POST] OpenAI response length:", responseText?.length || 0);
        
        if (!responseText) {
            log.error("[background-summary/POST] ❌ Empty response from OpenAI");
            return NextResponse.json(
                { error: "Failed to generate summary" },
                { status: 500 }
            );
        }

        log.info("[background-summary/POST] Parsing OpenAI response...");

        // Strip markdown code block wrapper if present
        let cleanedResponse = responseText.trim();
        if (cleanedResponse.startsWith("```json")) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (cleanedResponse.startsWith("```")) {
            cleanedResponse = cleanedResponse.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }

        // Parse response
        let summaryData: SummaryOutput;
        try {
            summaryData = JSON.parse(cleanedResponse);
            log.info("[background-summary/POST] ✅ Successfully parsed summary JSON");
        } catch (parseError) {
            log.error("[background-summary/POST] ❌ Failed to parse OpenAI response:", parseError);
            log.error("[background-summary/POST] Original response:", responseText.substring(0, 500));
            log.error("[background-summary/POST] Cleaned response:", cleanedResponse.substring(0, 500));
            return NextResponse.json(
                { error: "Failed to parse summary response" },
                { status: 500 }
            );
        }

        // Store in database
        log.info("[background-summary/POST] Saving summary to database...");
        
        const summaryDbData = {
            executiveSummary: summaryData.executiveSummary,
            executiveSummaryOneLiner: summaryData.executiveSummaryOneLiner,
            recommendation: summaryData.recommendation,
            adaptabilityScore: summaryData.adaptability.score,
            adaptabilityText: summaryData.adaptability.assessment,
            adaptabilityOneLiner: summaryData.adaptability.oneLiner,
            creativityScore: summaryData.creativity.score,
            creativityText: summaryData.creativity.assessment,
            creativityOneLiner: summaryData.creativity.oneLiner,
            reasoningScore: summaryData.reasoning.score,
            reasoningText: summaryData.reasoning.assessment,
            reasoningOneLiner: summaryData.reasoning.oneLiner,
            conversationJson: messages.map((m) => ({
                speaker: m.speaker,
                text: m.text,
                timestamp: m.timestamp.getTime(),
            })),
            evidenceJson: {
                adaptability: summaryData.adaptability.evidence,
                creativity: summaryData.creativity.evidence,
                reasoning: summaryData.reasoning.evidence,
            },
        };

        const backgroundSummary = await prisma.backgroundSummary.upsert({
            where: {
                telemetryDataId: interviewSession.telemetryData.id,
            },
            update: summaryDbData,
            create: {
                telemetryDataId: interviewSession.telemetryData.id,
                ...summaryDbData,
            },
        });

        log.info("[background-summary/POST] ✅ Background summary created successfully. ID:", backgroundSummary.id);

        // Create EvidenceClip records for each trait's evidence
        log.info("[background-summary/POST] Creating evidence clips...");
        
        // Fetch all background evidence for this session to get timestamps
        const backgroundEvidenceRecords = await prisma.backgroundEvidence.findMany({
            where: {
                telemetryDataId: interviewSession.telemetryData.id,
            },
            orderBy: {
                questionNumber: 'asc',
            },
        });

        log.info("[background-summary/POST] Found", backgroundEvidenceRecords.length, "background evidence records");

        /**
         * Selects the most relevant trait evidence for a background record, preferring
         * exact question-text matches before position-based alignment.
         */
        const pickTraitEvidence = (
            evidenceArray: Array<{ question: string; answerExcerpt: string; reasoning: string }>,
            record: any,
            recordIndex: number
        ) => {
            const exactMatch = evidenceArray.find(
                (evidence) => evidence.question === record.questionText
            );
            if (exactMatch) return exactMatch;
            return evidenceArray[recordIndex] ?? null;
        };

        /**
         * Builds a descriptive title for an evidence clip.
         */
        const buildClipTitle = (
            traitName: string,
            traitEvidence: { answerExcerpt?: string } | null,
            record: any
        ) => {
            const answerSnippet = traitEvidence?.answerExcerpt?.substring(0, 50);
            if (answerSnippet && answerSnippet.trim()) {
                return `${traitName}: ${answerSnippet}...`;
            }

            const questionSnippet = record.questionText?.substring(0, 50);
            if (questionSnippet && questionSnippet.trim()) {
                return `${traitName}: ${questionSnippet}...`;
            }

            return `${traitName}: evidence`;
        };

        /**
         * Builds a description for an evidence clip using available context.
         */
        const buildClipDescription = (
            traitEvidence: { reasoning?: string; answerExcerpt?: string } | null,
            record: any
        ) => {
            if (traitEvidence?.reasoning?.trim()) return traitEvidence.reasoning;
            if (traitEvidence?.answerExcerpt?.trim()) return traitEvidence.answerExcerpt;
            if (record.answerText?.trim()) return record.answerText;
            return record.questionText;
        };

        // Helper function to create evidence clips for a trait across all background evidence
        const createClipsForTrait = async (
            traitName: string,
            category: 'ADAPTABILITY' | 'CREATIVITY' | 'REASONING',
            evidenceArray: Array<{ question: string; answerExcerpt: string; reasoning: string }>
        ) => {
            const recordingStart = interviewSession.telemetryData.createdAt;

            for (const [index, record] of backgroundEvidenceRecords.entries()) {
                const traitEvidence = pickTraitEvidence(evidenceArray, record, index);
                const startTimeSeconds = Math.floor(
                    (record.timestamp.getTime() - recordingStart.getTime()) / 1000
                );

                await prisma.evidenceClip.create({
                    data: {
                        telemetryDataId: interviewSession.telemetryData.id,
                        category,
                        title: buildClipTitle(traitName, traitEvidence, record),
                        description: buildClipDescription(traitEvidence, record),
                        startTime: startTimeSeconds,
                        duration: 10, // Default 10 second clip
                        thumbnailUrl: null,
                    },
                });

                log.info(`[background-summary/POST] ✅ Created ${category} evidence clip at ${startTimeSeconds}s`);
            }
        };

        // Create clips for each trait, covering every background evidence record
        await createClipsForTrait('Adaptability', 'ADAPTABILITY', summaryData.adaptability.evidence);
        await createClipsForTrait('Creativity', 'CREATIVITY', summaryData.creativity.evidence);
        await createClipsForTrait('Reasoning', 'REASONING', summaryData.reasoning.evidence);

        log.info("[background-summary/POST] ✅ Evidence clips created successfully");

        // Create VideoCaption records from evidence clips (matching external tool usage pattern)
        log.info("[background-summary/POST] Creating video captions from evidence clips...");
        
        // Find the Background video chapter
        const backgroundChapter = await prisma.videoChapter.findFirst({
            where: {
                telemetryDataId: interviewSession.telemetryData.id,
                title: "Background",
            },
        });

        if (backgroundChapter) {
            // Fetch all background evidence clips we just created
            const allBackgroundClips = await prisma.evidenceClip.findMany({
                where: {
                    telemetryDataId: interviewSession.telemetryData.id,
                    category: {
                        in: ['ADAPTABILITY', 'CREATIVITY', 'REASONING'],
                    },
                },
                orderBy: {
                    startTime: 'asc',
                },
            });

            // Group clips by timestamp
            const clipsByTimestamp = new Map<number, any[]>();
            allBackgroundClips.forEach(clip => {
                if (clip.startTime !== null && clip.startTime !== undefined) {
                    if (!clipsByTimestamp.has(clip.startTime)) {
                        clipsByTimestamp.set(clip.startTime, []);
                    }
                    clipsByTimestamp.get(clip.startTime)!.push(clip);
                }
            });

            // Create a VideoCaption for each unique timestamp with combined descriptions
            for (const [timestamp, clips] of clipsByTimestamp.entries()) {
                const combinedDescription = clips
                    .map(clip => {
                        const traitLabel = clip.category.charAt(0) + 
                            clip.category.slice(1).toLowerCase();
                        return `${traitLabel}: ${clip.description}`;
                    })
                    .join('; ');

                await prisma.videoCaption.create({
                    data: {
                        videoChapterId: backgroundChapter.id,
                        text: combinedDescription,
                        startTime: timestamp,
                        endTime: timestamp + 10, // 10 second caption duration
                    },
                });

                log.info(`[background-summary/POST] ✅ Created video caption at ${timestamp}s`);
            }

            log.info("[background-summary/POST] ✅ Video captions created successfully");
        } else {
            log.warn("[background-summary/POST] ⚠️ Background chapter not found, skipping caption creation");
        }

        return NextResponse.json(
            {
                message: "Background summary generated successfully",
                summaryId: backgroundSummary.id,
            },
            { status: 202 }
        );
    } catch (error) {
        log.error("❌ Error generating background summary:", error);
        return NextResponse.json(
            { error: "Failed to generate background summary" },
            { status: 500 }
        );
    }
}
