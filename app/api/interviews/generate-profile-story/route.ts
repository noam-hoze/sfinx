import { NextRequest, NextResponse } from "next/server";
import prisma from "lib/prisma";
import OpenAI from "openai";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openai = new OpenAI({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY });

interface CategoryScore {
    name: string;
    score: number;
    type: 'experience' | 'coding';
    contributions: Array<{
        explanation: string;
        strength: number;
        timestamp: Date;
    }>;
}

/**
 * Generates a human-readable profile story for a candidate based on interview summaries.
 */
export async function POST(request: NextRequest) {
    const requestId = request.headers.get("x-request-id");
    let sessionId: string | undefined;
    try {
        const body = await request.json();
        sessionId = body.sessionId;

        if (!sessionId) {
            return NextResponse.json({ error: "Session ID required" }, { status: 400 });
        }

        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                telemetryData: {
                    include: {
                        backgroundSummary: true,
                        codingSummary: true,
                    },
                },
                application: {
                    include: {
                        job: true,
                    },
                },
                candidate: true,
            },
        });

        if (!session?.telemetryData) {
            return NextResponse.json({ error: "Session or telemetry not found" }, { status: 404 });
        }

        const { backgroundSummary, codingSummary } = session.telemetryData;

        if (!backgroundSummary || !codingSummary) {
            return NextResponse.json(
                { error: "Background and coding summaries required" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[Generate Profile Story] Fetching evaluation data for session", {
            requestId,
            sessionId,
        });

        const [iterations, codingContributions, experienceContributions, externalToolUsages] = await Promise.all([
            prisma.iteration.findMany({ 
                where: { interviewSessionId: sessionId },
                orderBy: { timestamp: 'asc' }
            }),
            prisma.categoryContribution.findMany({ 
                where: { 
                    interviewSessionId: sessionId, 
                    codeChange: { not: "" }
                },
                orderBy: { timestamp: 'asc' }
            }),
            prisma.categoryContribution.findMany({ 
                where: { 
                    interviewSessionId: sessionId, 
                    codeChange: ""
                },
                orderBy: { timestamp: 'asc' }
            }),
            prisma.externalToolUsage.findMany({ 
                where: { interviewSessionId: sessionId },
                orderBy: { timestamp: 'asc' }
            })
        ]);

        const hasCodeActivity = iterations.length > 0 || codingContributions.length > 0;

        log.info(LOG_CATEGORY, "[Generate Profile Story] Code activity detected", {
            requestId,
            sessionId,
            hasCodeActivity,
            iterations: iterations.length,
            codingContributions: codingContributions.length,
            experienceContributions: experienceContributions.length,
            externalToolUsages: externalToolUsages.length
        });

        const organizedData = organizeByStrength(
            backgroundSummary,
            codingSummary,
            experienceContributions,
            codingContributions
        );

        log.info(LOG_CATEGORY, "[Generate Profile Story] Organized data", {
            requestId,
            sessionId,
            strongestCount: organizedData.strongest.length,
            weakestCount: organizedData.weakest.length
        });

        // PASS 1: Extract key elements
        log.info(LOG_CATEGORY, "[Generate Profile Story] Pass 1: Extracting key elements", {
            requestId,
            sessionId,
        });
        
        const extractionPrompt = buildExtractionPrompt(
            session.candidate.name || "The candidate",
            backgroundSummary,
            codingSummary,
            organizedData,
            hasCodeActivity
        );

        const extractionResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: extractionPrompt }],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const extractedData = JSON.parse(extractionResponse.choices[0]?.message?.content || "{}");
        const extractedKeyCount = extractedData && typeof extractedData === "object"
            ? Object.keys(extractedData).length
            : undefined;
        log.info(LOG_CATEGORY, "[Generate Profile Story] Extracted data summary", {
            requestId,
            sessionId,
            extractedKeyCount,
        });

        // PASS 2: Format into 250 characters
        log.info(LOG_CATEGORY, "[Generate Profile Story] Pass 2: Formatting to 250 characters", {
            requestId,
            sessionId,
        });

        const formattingPrompt = buildFormattingPrompt(
            session.candidate.name || "The candidate",
            session.application.job.title,
            extractedData
        );

        const formattingResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: formattingPrompt }],
            temperature: 0.7,
        });

        let story = formattingResponse.choices[0]?.message?.content?.trim();

        if (!story) {
            throw new Error("OpenAI returned empty profile story");
        }

        // Safety truncation at 300 chars - cut at last complete sentence
        if (story.length > 300) {
            const trimmed = story.slice(0, 300);
            const lastPeriod = trimmed.lastIndexOf('.');
            story = lastPeriod > 150 ? trimmed.slice(0, lastPeriod + 1) : trimmed;
            log.info(LOG_CATEGORY, "[Generate Profile Story] Truncated story to complete sentence", {
                requestId,
                sessionId,
                storyLength: story.length,
            });
        }

        await prisma.telemetryData.update({
            where: { id: session.telemetryData.id },
            data: { story },
        });

        log.info(LOG_CATEGORY, "[Generate Profile Story] Story saved to database", {
            requestId,
            sessionId,
        });

        if (!hasCodeActivity) {
            log.info(LOG_CATEGORY, "[Generate Profile Story] No code activity detected - story reflects zero coding engagement", {
                requestId,
                sessionId,
            });
        }

        // Return prompts in development mode for debugging
        return NextResponse.json({ 
            story,
            debug: process.env.NODE_ENV === 'development' ? {
                extractionPrompt,
                extractedData,
                formattingPrompt
            } : undefined
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[Generate Profile Story] Error", {
            requestId,
            sessionId,
            errorMessage: error instanceof Error ? error.message : String(error),
        });
        
        // Return detailed error in development
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { 
                error: "Failed to generate profile story",
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
            },
            { status: 500 }
        );
    }
}

/**
 * Organizes evaluation data by strength and weakness based on category scores.
 */
function organizeByStrength(
    backgroundSummary: any,
    codingSummary: any,
    experienceContributions: any[],
    codingContributions: any[]
): { strongest: CategoryScore[], weakest: CategoryScore[] } {
    
    const allCategories: CategoryScore[] = [];
    
    if (backgroundSummary.experienceCategories) {
        Object.entries(backgroundSummary.experienceCategories).forEach(([name, data]: [string, any]) => {
            const contributions = experienceContributions
                .filter(c => c.categoryName === name)
                .map(c => ({
                    explanation: c.explanation,
                    strength: c.contributionStrength,
                    timestamp: c.timestamp
                }));
            
            allCategories.push({
                name,
                score: data.score,
                type: 'experience',
                contributions
            });
        });
    }
    
    if (codingSummary.jobSpecificCategories) {
        Object.entries(codingSummary.jobSpecificCategories).forEach(([name, data]: [string, any]) => {
            const contributions = codingContributions
                .filter(c => c.categoryName === name)
                .map(c => ({
                    explanation: c.explanation,
                    strength: c.contributionStrength,
                    timestamp: c.timestamp
                }));
            
            allCategories.push({
                name,
                score: data.score,
                type: 'coding',
                contributions
            });
        });
    }
    
    const sorted = allCategories.sort((a, b) => b.score - a.score);
    
    return {
        strongest: sorted.slice(0, 3),
        weakest: sorted.slice(-3).reverse()
    };
}

/**
 * PASS 1: Extract key elements from evaluation data.
 */
function buildExtractionPrompt(
    candidateName: string,
    backgroundSummary: any,
    codingSummary: any,
    organizedData: {
        strongest: CategoryScore[];
        weakest: CategoryScore[];
    },
    hasCodeActivity: boolean
): string {
    
    return `From the data below, extract only the essential elements for ${candidateName}'s profile:

EXECUTIVE SUMMARIES:
Experience: ${backgroundSummary.executiveSummary}
Coding: ${codingSummary.executiveSummary}

TOP STRENGTHS:
${organizedData.strongest.slice(0, 3).map((cat, i) => 
    `${i + 1}. ${cat.name} (${cat.type}, score: ${cat.score}/100)`
).join('\n')}

TOP WEAKNESSES:
${organizedData.weakest.slice(0, 3).map((cat, i) => 
    `${i + 1}. ${cat.name} (${cat.type}, score: ${cat.score}/100)`
).join('\n')}

CODING ENGAGEMENT: ${hasCodeActivity ? 'Yes - candidate completed coding challenge' : 'No - candidate did NOT engage with coding challenge'}

Extract and return JSON exactly in this format:
{
  "strengths": ["strength1", "strength2"],
  "weakness": "weakness1",
  "experienceLevel": "brief phrase describing experience",
  "codingEngagement": "${hasCodeActivity ? 'engaged' : 'did not engage'}"
}

Select the 2 most significant strengths and 1 most significant weakness based on scores.`;
}

/**
 * PASS 2: Format extracted elements into maximum 300 characters.
 */
function buildFormattingPrompt(
    candidateName: string,
    jobTitle: string,
    extractedData: any
): string {
    
    return `Using the JSON data below, write a natural, professional profile story for ${candidateName} (${jobTitle}).

DATA:
${JSON.stringify(extractedData, null, 2)}

CRITICAL CONSTRAINTS:
- HARD LIMIT: 280 characters maximum
- Write like a tech recruiter summarizing a candidate profile
- Convey strengths and weaknesses in natural language, NOT numeric or categorical labels
- Do NOT restate category names like "Code Quality and Explainability" - convert to natural concepts (e.g., "writes clear code")
- If experienceLevel contains numbers/durations, reinterpret into softer phrases (e.g., "solid background", "developing in X", "experienced")
- Mention coding engagement naturally (e.g., "did not participate in the coding task"), NOT as a label
- Tone should be confident, balanced, and not overly definitive about exact years
- No bullet points, just flowing sentences
- MUST end with a complete sentence

Before writing, plan to stop at ~270-280 chars at a sentence boundary.

Output only the story text (max 280 chars):`;
}
