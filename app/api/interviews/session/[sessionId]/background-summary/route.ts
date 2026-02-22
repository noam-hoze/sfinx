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
import { CONTRIBUTIONS_TARGET } from "@/shared/constants/interview";

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

/**
 * Generates a unified one-liner caption from multiple category evaluations using OpenAI.
 * This creates a human-readable caption that synthesizes experience category assessments.
 * The result is stored in the DB and displayed on the CPS page.
 */
async function generateUnifiedCaption(
    openai: OpenAI,
    traitEvaluations: Array<{ trait: string; evaluation: string }>
): Promise<string> {
    const evaluationsText = traitEvaluations
        .map(t => `${t.trait}: ${t.evaluation}`)
        .join('\n\n');

    const prompt = `ONE SENTENCE.

${evaluationsText}

Write ONE short sentence summarizing this.`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 50,
        messages: [
            {
                role: "system",
                content: "Generate ONLY short captions in one sentence.",
            },
            {
                role: "user",
                content: prompt,
            },
        ],
    });

    let caption = completion.choices[0]?.message?.content?.trim();
    
    if (!caption) {
        throw new Error("OpenAI failed to generate unified caption");
    }

    // Remove trailing period if present
    caption = caption.replace(/\.$/, '');
    
    // Ensure it's one line (remove line breaks)
    caption = caption.replace(/[\r\n]+/g, ' ').trim();

    return caption;
}

// GET: Retrieve existing background summary
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        log.info(LOG_CATEGORY, "Background summary retrieval API called");

        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);

        if (!sessionId) {
            log.warn(LOG_CATEGORY, "❌ Interview session id was not provided");
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
            log.warn(LOG_CATEGORY, "❌ Interview session not found");
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        const summary = interviewSession.telemetryData?.backgroundSummary;

        if (!summary) {
            log.info(LOG_CATEGORY, "No background summary found for session");
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
                experienceCategories: summary.experienceCategories,
                conversationJson: summary.conversationJson,
                evidenceJson: summary.evidenceJson,
                generatedAt: summary.generatedAt,
            },
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "❌ Error retrieving background summary:", error);
        return NextResponse.json(
            { error: "Failed to retrieve background summary" },
            { status: 500 }
        );
    }
}

// POST: Generate background summary
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        log.info(LOG_CATEGORY, "[background-summary/POST] ========== START ==========");

        const session = await getServerSession(authOptions);
        log.info(LOG_CATEGORY, "[background-summary/POST] Session:", session ? `Found (user: ${(session.user as any)?.email})` : "Not found");

        const body = await request.json();
        const { scores, rationales, companyName, roleName, userId: requestUserId } = body;

        if (!session?.user) {
            log.warn(LOG_CATEGORY, "[background-summary/POST] ❌ Unauthorized request");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = (session.user as any).id;
        log.info(LOG_CATEGORY, "[background-summary/POST] ✅ User ID from session:", userId);

        const { sessionId: rawSessionId } = await context.params;
        const sessionId = normalizeSessionId(rawSessionId);
        log.info(LOG_CATEGORY, "[background-summary/POST] userId:", userId);
        log.info(LOG_CATEGORY, "[background-summary/POST] sessionId (raw):", rawSessionId);
        log.info(LOG_CATEGORY, "[background-summary/POST] sessionId (normalized):", sessionId);

        if (!sessionId) {
            log.warn(LOG_CATEGORY, "[background-summary/POST] ❌ Interview session id was not provided");
            return NextResponse.json(
                { error: "Interview session id is required" },
                { status: 400 }
            );
        }

        // Verify the interview session exists and belongs to the user
        log.info(LOG_CATEGORY, "[background-summary/POST] Looking up interview session...");
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
            log.warn(LOG_CATEGORY, "[background-summary/POST] ❌ Interview session not found or doesn't belong to user");
            log.warn(LOG_CATEGORY, "[background-summary/POST] Searched for: sessionId=", sessionId, "candidateId=", userId);
            return NextResponse.json(
                { error: "Interview session not found" },
                { status: 404 }
            );
        }

        log.info(LOG_CATEGORY, "[background-summary/POST] ✅ Interview session found:", interviewSession.id);
        log.info(LOG_CATEGORY, "[background-summary/POST] Has telemetryData:", !!interviewSession.telemetryData);
        log.info(LOG_CATEGORY, "[background-summary/POST] Has backgroundSummary:", !!interviewSession.telemetryData?.backgroundSummary);

        // Check if summary already exists
        if (interviewSession.telemetryData?.backgroundSummary) {
            log.info(LOG_CATEGORY, "[background-summary/POST] ⚠️ Background summary already exists for session, skipping generation");
            return NextResponse.json(
                { message: "Background summary already exists" },
                { status: 200 }
            );
        }

        // Ensure telemetry data exists
        if (!interviewSession.telemetryData) {
            log.warn(LOG_CATEGORY, "[background-summary/POST] ❌ No telemetry data found for session");
            return NextResponse.json(
                { error: "Telemetry data not found" },
                { status: 404 }
            );
        }

        log.info(LOG_CATEGORY, "[background-summary/POST] TelemetryData ID:", interviewSession.telemetryData.id);

        log.info(LOG_CATEGORY, "[background-summary/POST] Request body:", { scores, rationales, companyName, roleName });

        // Get experience categories from job
        const experienceCategoryDefinitions = (interviewSession.application.job.experienceCategories as any) || [];
        
        if (!experienceCategoryDefinitions || experienceCategoryDefinitions.length === 0) {
            log.error(LOG_CATEGORY, "[background-summary/POST] ❌ No experience categories defined for job");
            return NextResponse.json(
                { error: "Job must have experience categories defined" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[background-summary/POST] Experience categories:", experienceCategoryDefinitions.map((c: any) => c.name).join(', '));

        // Fetch background messages
        log.info(LOG_CATEGORY, "[background-summary/POST] Fetching conversation messages...");
        const messages = await prisma.conversationMessage.findMany({
            where: {
                interviewSessionId: sessionId,
                stage: "background",
            },
            orderBy: {
                timestamp: "asc",
            },
        });

        log.info(LOG_CATEGORY, "[background-summary/POST] Found", messages.length, "background messages");

        if (messages.length === 0) {
            log.warn(LOG_CATEGORY, "[background-summary/POST] ❌ No background messages found in DB");
            return NextResponse.json(
                { error: "No background conversation found" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, `[background-summary/POST] Generating summary from ${messages.length} messages...`);

        // Build prompt
        const prompt = buildBackgroundSummaryPrompt({
            messages: messages.map((m) => ({
                speaker: m.speaker,
                text: m.text,
                timestamp: m.timestamp.getTime(),
            })),
            experienceCategories: experienceCategoryDefinitions,
            scores,
            rationales,
            companyName:
                companyName || interviewSession.application.job.company.name,
            roleName: roleName || interviewSession.application.job.title,
            finalScore: interviewSession.finalScore ?? undefined, // Pass final score if available
        });

        // Call OpenAI
        log.info(LOG_CATEGORY, "[background-summary/POST] Checking OpenAI API key...");
        const openaiApiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
        if (!openaiApiKey) {
            log.error(LOG_CATEGORY, "[background-summary/POST] ❌ OpenAI API key not configured");
            return NextResponse.json(
                { error: "OpenAI API key not configured" },
                { status: 500 }
            );
        }

        log.info(LOG_CATEGORY, "[background-summary/POST] Calling OpenAI with model:", SUMMARY_MODEL, "temperature:", SUMMARY_TEMPERATURE);
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
        log.info(LOG_CATEGORY, "[background-summary/POST] OpenAI response length:", responseText?.length || 0);
        
        if (!responseText) {
            log.error(LOG_CATEGORY, "[background-summary/POST] ❌ Empty response from OpenAI");
            return NextResponse.json(
                { error: "Failed to generate summary" },
                { status: 500 }
            );
        }

        log.info(LOG_CATEGORY, "[background-summary/POST] Parsing OpenAI response...");

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
            log.info(LOG_CATEGORY, "[background-summary/POST] ✅ Successfully parsed summary JSON");
        } catch (parseError) {
            log.error(LOG_CATEGORY, "[background-summary/POST] ❌ Failed to parse OpenAI response:", parseError);
            log.error(LOG_CATEGORY, "[background-summary/POST] Original response:", responseText.substring(0, 500));
            log.error(LOG_CATEGORY, "[background-summary/POST] Cleaned response:", cleanedResponse.substring(0, 500));
            return NextResponse.json(
                { error: "Failed to parse summary response" },
                { status: 500 }
            );
        }

        // Store in database
        log.info(LOG_CATEGORY, "[background-summary/POST] Saving summary to database...");
        
        // Aggregate category contributions (simple averaging)
        const contributions = await prisma.categoryContribution.findMany({
            where: {
                interviewSessionId: sessionId,
            },
            include: {
                interviewSession: {
                    include: {
                        application: {
                            include: {
                                job: true,
                            },
                        },
                    },
                },
            },
        });

        // Group contributions by category
        const byCategory = contributions.reduce((acc, c) => {
            if (!acc[c.categoryName]) acc[c.categoryName] = [];
            acc[c.categoryName].push(c);
            return acc;
        }, {} as Record<string, typeof contributions>);

        // Calculate average with confidence multiplier based on sample size
        const experienceCategories: Record<string, any> = {};
        for (const [categoryName, contribs] of Object.entries(byCategory)) {
            const rawAverage = 
                contribs.reduce((sum, c) => sum + c.contributionStrength, 0) / contribs.length;
            
            // Apply confidence multiplier: more contributions = more confident in the score
            const confidence = Math.min(1.0, contribs.length / CONTRIBUTIONS_TARGET);
            const adjustedScore = Math.round(rawAverage * confidence);
            
            log.info(LOG_CATEGORY, `[background-summary/POST] ${categoryName}: ${contribs.length} contributions, raw avg=${Math.round(rawAverage)}, confidence=${confidence.toFixed(2)}, adjusted=${adjustedScore}`);
            
            const categoryDef = experienceCategoryDefinitions?.find(c => c.name === categoryName);

            // Build category data without evidenceLinks for now (will be added after clips are created)
            experienceCategories[categoryName] = {
                score: adjustedScore,
                rawAverage: Math.round(rawAverage),
                contributionCount: contribs.length,
                confidence: confidence,
                text: contribs.map(c => c.explanation).join(" "),
                description: categoryDef?.description || "",
                evidenceLinks: [], // Will be populated after clips are created
                contributions: contribs.map(c => ({
                    timestamp: c.timestamp.toISOString(),
                    strength: c.contributionStrength,
                    explanation: c.explanation,
                })),
            };
        }

        log.info(LOG_CATEGORY, "[background-summary/POST] Aggregated experience categories:", Object.keys(experienceCategories));
        
        const summaryDbData = {
            executiveSummary: summaryData.executiveSummary,
            executiveSummaryOneLiner: summaryData.executiveSummaryOneLiner,
            recommendation: summaryData.recommendation,
            experienceCategories,
            conversationJson: messages.map((m) => ({
                speaker: m.speaker,
                text: m.text,
                timestamp: m.timestamp.getTime(),
            })),
            evidenceJson: summaryData,
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

        log.info(LOG_CATEGORY, "[background-summary/POST] ✅ Background summary created successfully. ID:", backgroundSummary.id);

        // Create EvidenceClip records for each trait's evidence
        log.info(LOG_CATEGORY, "[background-summary/POST] Creating evidence clips...");
        
        // Log what OpenAI gave us for evidence
        log.info(LOG_CATEGORY, "[background-summary/POST] OpenAI Evidence Summary:");
        if (summaryData.experienceCategories) {
            for (const [categoryName, categoryData] of Object.entries(summaryData.experienceCategories)) {
                const evidence = (categoryData as any).evidence;
                if (evidence && Array.isArray(evidence)) {
                    log.info(LOG_CATEGORY, `  - ${categoryName} evidence count:`, evidence.length);
                    evidence.forEach((ev: any, idx: number) => {
                        log.info(LOG_CATEGORY, `  - ${categoryName}[${idx}]: question="${ev.question?.substring(0, 50)}...", hasReasoning=${!!ev.reasoning}, hasAnswerExcerpt=${!!ev.answerExcerpt}`);
                    });
                }
            }
        }
        
        // Fetch all background evidence for this session to get timestamps
        const backgroundEvidenceRecords = await prisma.backgroundEvidence.findMany({
            where: {
                telemetryDataId: interviewSession.telemetryData.id,
            },
            orderBy: {
                questionNumber: 'asc',
            },
        });

        log.info(LOG_CATEGORY, "[background-summary/POST] Found", backgroundEvidenceRecords.length, "background evidence records");

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
         * Builds a descriptive title for an evidence clip using OpenAI's answer excerpt.
         */
        const buildClipTitle = (
            traitName: string,
            traitEvidence: { answerExcerpt?: string; question?: string } | null,
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
         * Builds a description for an evidence clip using OpenAI evaluation only.
         * Throws error if OpenAI didn't provide proper evidence (no hidden fallbacks per Constitution).
         */
        const buildClipDescription = (
            traitEvidence: { reasoning?: string; answerExcerpt?: string } | null,
            record: any,
            category: string
        ) => {
            if (traitEvidence?.reasoning?.trim()) return traitEvidence.reasoning;
            if (traitEvidence?.answerExcerpt?.trim()) return traitEvidence.answerExcerpt;
            
            // NO FALLBACKS - per Constitution Principle I
            throw new Error(
                `OpenAI failed to provide evidence for ${category}. ` +
                `Question: "${record.questionText.substring(0, 50)}...". ` +
                `This is a critical error - captions must be OpenAI evaluations, not raw user input.`
            );
        };

        // Helper function to create evidence clips for a category across all background evidence
        // Returns array of created clips with their startTime and caption
        const createClipsForCategory = async (
            categoryName: string,
            evidenceArray: Array<{ question: string; answerExcerpt: string; reasoning: string }>
        ): Promise<Array<{ startTime: number; caption: string }>> => {
            const createdClips: Array<{ startTime: number; caption: string }> = [];
            // Use actual recording start time, not when telemetryData was created
            const recordingStart = interviewSession.recordingStartedAt
                ? new Date(interviewSession.recordingStartedAt)
                : interviewSession.telemetryData.createdAt;

            log.info(LOG_CATEGORY, `[background-summary/POST] Creating clips for category: ${categoryName}`);

            // Create clips for ALL background records (OpenAI should provide evidence for each)
            for (const [index, record] of backgroundEvidenceRecords.entries()) {
                const categoryEvidence = pickTraitEvidence(evidenceArray, record, index);
                const startTimeSeconds = Math.floor(
                    (record.timestamp.getTime() - recordingStart.getTime()) / 1000
                );

                
                log.info(LOG_CATEGORY, `[background-summary/POST] ${categoryName}[${index}]: Matching record Q="${record.questionText.substring(0, 50)}..." with evidence:`, {
                    matched: categoryEvidence ? `"${categoryEvidence.question.substring(0, 50)}..."` : 'null',
                    hasReasoning: categoryEvidence?.reasoning ? true : false,
                    hasAnswerExcerpt: categoryEvidence?.answerExcerpt ? true : false,
                });

                // Calculate duration based on next evidence timestamp
                let clipDuration = 15; // Default fallback for last question
                const nextRecord = backgroundEvidenceRecords[index + 1];
                
                if (nextRecord) {
                    const durationMs = nextRecord.timestamp.getTime() - record.timestamp.getTime();
                    clipDuration = Math.floor(durationMs / 1000);
                }
                
                const description = buildClipDescription(categoryEvidence, record, categoryName);
                
                log.info(LOG_CATEGORY, `[background-summary/POST] ${categoryName}[${index}]: Using description="${description.substring(0, 100)}..."`);

                const clip = await prisma.evidenceClip.create({
                    data: {
                        telemetryData: {
                            connect: { id: interviewSession.telemetryData.id }
                        },
                        category: 'EXPERIENCE_CATEGORY',
                        categoryName: categoryName,
                        title: buildClipTitle(categoryName, categoryEvidence, record),
                        description: description,
                        startTime: startTimeSeconds,
                        duration: clipDuration,
                        thumbnailUrl: null,
                    },
                });

                log.info(LOG_CATEGORY, `[background-summary/POST] ✅ Created ${categoryName} evidence clip at ${startTimeSeconds}s with duration ${clipDuration}s`);

                // Store clip info for evidenceLinks (using clip startTime, not contribution timestamp)
                createdClips.push({
                    startTime: startTimeSeconds,
                    caption: description
                });
            }

            return createdClips;
        };

        // Create clips for each dynamic experience category and store clip info for evidenceLinks
        const clipsByCategory = new Map<string, Array<{ startTime: number; caption: string }>>();
        if (summaryData.experienceCategories) {
            for (const [categoryName, categoryData] of Object.entries(summaryData.experienceCategories)) {
                if ((categoryData as any).evidence && Array.isArray((categoryData as any).evidence)) {
                    const clips = await createClipsForCategory(categoryName, (categoryData as any).evidence);
                    clipsByCategory.set(categoryName, clips);
                }
            }
        }

        // Update experienceCategories with evidenceLinks from created clips
        for (const [categoryName, clips] of clipsByCategory.entries()) {
            if (experienceCategories[categoryName]) {
                experienceCategories[categoryName].evidenceLinks = clips.map(clip => ({
                    timestamp: clip.startTime,
                    caption: clip.caption
                }));
            }
        }

        // Update the BackgroundSummary in the database with the populated evidenceLinks
        await prisma.backgroundSummary.update({
            where: {
                id: backgroundSummary.id
            },
            data: {
                experienceCategories: experienceCategories as any
            }
        });

        log.info(LOG_CATEGORY, "[background-summary/POST] ✅ Evidence clips created and evidenceLinks updated successfully");

        return NextResponse.json(
            {
                message: "Background summary generated successfully",
                summaryId: backgroundSummary.id,
            },
            { status: 202 }
        );
    } catch (error) {
        log.error(LOG_CATEGORY, "❌ Error generating background summary:", error);
        return NextResponse.json(
            { error: "Failed to generate background summary" },
            { status: 500 }
        );
    }
}
