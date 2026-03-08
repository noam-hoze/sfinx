import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "lib/prisma";
import OpenAI from "openai";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import { calculateScore, type ScoringConfiguration } from "app/shared/utils/calculateScore";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    try {
        const body = await request.json();
        const { sessionId } = body;

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
                        job: {
                            include: {
                                scoringConfiguration: true,
                            },
                        },
                    },
                },
                candidate: true,
            },
        });

        if (!session?.telemetryData) {
            log.error(LOG_CATEGORY, "[Generate Profile Story] Session or telemetry not found for sessionId:", sessionId);
            return NextResponse.json({ error: "Session or telemetry not found" }, { status: 404 });
        }

        const job = session.application?.job;
        if (!job) {
            return NextResponse.json({ error: "Job not found for session" }, { status: 404 });
        }
        const scoringConfiguration = job.scoringConfiguration;
        if (!scoringConfiguration) {
            throw new Error(`Missing scoring configuration for interview session ${sessionId}`);
        }

        const { backgroundSummary, codingSummary } = session.telemetryData;

        if (!backgroundSummary || !codingSummary) {
            log.error(LOG_CATEGORY, "[Generate Profile Story] Missing summaries:", {
                hasBackgroundSummary: !!backgroundSummary,
                hasCodingSummary: !!codingSummary,
                sessionId
            });
            return NextResponse.json(
                {
                    error: "Background and coding summaries required",
                    details: {
                        hasBackgroundSummary: !!backgroundSummary,
                        hasCodingSummary: !!codingSummary
                    }
                },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[Generate Profile Story] Fetching evaluation data for session:", sessionId);

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

        log.info(LOG_CATEGORY, "[Generate Profile Story] Code activity detected:", hasCodeActivity, {
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

        log.info(LOG_CATEGORY, "[Generate Profile Story] Organized data:", {
            strongestCount: organizedData.strongest.length,
            weakestCount: organizedData.weakest.length
        });

        // Calculate comprehensive performance context
        const performanceContext = calculatePerformanceContext(
            backgroundSummary,
            codingSummary,
            externalToolUsages,
            { scoringConfiguration }
        );

        log.info(LOG_CATEGORY, "[Generate Profile Story] Performance context:", {
            finalScore: performanceContext.finalScore,
            experienceScore: performanceContext.experienceScore,
            codingScore: performanceContext.codingScore,
            performanceLevel: performanceContext.performanceLevel,
            accountabilityLevel: performanceContext.accountability.level
        });

        // PASS 1: Extract key elements
        log.info(LOG_CATEGORY, "[Generate Profile Story] Pass 1: Extracting key elements");

        const extractionPrompt = buildExtractionPrompt(
            session.candidate.name || "The candidate",
            backgroundSummary,
            codingSummary,
            organizedData,
            hasCodeActivity,
            performanceContext
        );

        const extractionResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: extractionPrompt }],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const extractedData = JSON.parse(extractionResponse.choices[0]?.message?.content || "{}");
        
        log.info(LOG_CATEGORY, "[Generate Profile Story] Extracted data:", extractedData);

        // PASS 2: Format into 280 characters with emphasis
        log.info(LOG_CATEGORY, "[Generate Profile Story] Pass 2: Formatting with emphasis");

        const formattingPrompt = buildFormattingPrompt(
            session.candidate.name || "The candidate",
            job.title,
            extractedData
        );

        const formattingResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: formattingPrompt }],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });

        const formattedData = JSON.parse(formattingResponse.choices[0]?.message?.content || "{}");

        let story = formattedData.story;

        if (!story) {
            throw new Error("OpenAI returned empty profile story");
        }

        log.info(LOG_CATEGORY, "[Generate Profile Story] Story with HTML emphasis received:", {
            storyLength: story.length,
            hasSpanTags: story.includes('<span')
        });

        await prisma.telemetryData.update({
            where: { id: session.telemetryData.id },
            data: {
                story,
                storyEmphasis: Prisma.JsonNull // Story now contains inline HTML for emphasis
            },
        });

        log.info(LOG_CATEGORY, "[Generate Profile Story] Story with HTML emphasis saved to database");

        if (!hasCodeActivity) {
            log.info(LOG_CATEGORY, "[Generate Profile Story] No code activity detected - story reflects zero coding engagement");
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
        log.error(LOG_CATEGORY, "[Generate Profile Story] Error:", error);
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
 * Calculates comprehensive performance context from interview data.
 */
function calculatePerformanceContext(
    backgroundSummary: any,
    codingSummary: any,
    externalToolUsages: Array<{ accountabilityScore: number; understanding: string }>,
    job: { scoringConfiguration: ScoringConfiguration }
): {
    finalScore: number;
    experienceScore: number;
    codingScore: number;
    performanceLevel: 'strong' | 'competent' | 'needs-development';
    accountability: {
        level: 'high' | 'medium' | 'low' | 'none';
        avgScore: number | null;
        count: number;
        description: string;
    };
} {
    // Build experience scores from backgroundSummary categories
    const experienceScores = backgroundSummary.experienceCategories
        ? Object.entries(backgroundSummary.experienceCategories).map(([name, data]: [string, any]) => ({
            name,
            score: data.score,
            weight: data.weight || 1
        }))
        : [];

    // Build coding category scores from codingSummary
    const categoryScores = codingSummary.jobSpecificCategories
        ? Object.entries(codingSummary.jobSpecificCategories).map(([name, data]: [string, any]) => ({
            name,
            score: data.score,
            weight: data.weight || 1
        }))
        : [];

    // Calculate average accountability score
    const avgAccountabilityScore = externalToolUsages.length > 0
        ? externalToolUsages.reduce((sum, usage) => sum + usage.accountabilityScore, 0) / externalToolUsages.length
        : undefined;

    // Calculate scores using the same logic as coding-summary-update
    const rawScores = { experienceScores, categoryScores };
    const workstyleMetrics = { aiAssistAccountabilityScore: avgAccountabilityScore };

    const result = calculateScore(rawScores, workstyleMetrics, job.scoringConfiguration);

    // Classify overall performance level
    let performanceLevel: 'strong' | 'competent' | 'needs-development';
    if (result.finalScore >= 70) {
        performanceLevel = 'strong';
    } else if (result.finalScore >= 50) {
        performanceLevel = 'competent';
    } else {
        performanceLevel = 'needs-development';
    }

    // Calculate accountability metrics
    let accountability: {
        level: 'high' | 'medium' | 'low' | 'none';
        avgScore: number | null;
        count: number;
        description: string;
    };

    if (externalToolUsages.length === 0) {
        accountability = {
            level: 'none',
            avgScore: null,
            count: 0,
            description: 'No external tool usage detected'
        };
    } else {
        const avgScore = avgAccountabilityScore!;
        let level: 'high' | 'medium' | 'low';
        let description: string;

        if (avgScore >= 70) {
            level = 'high';
            description = `Used external resources effectively with strong understanding (${Math.round(avgScore)}% accountability across ${externalToolUsages.length} usage${externalToolUsages.length > 1 ? 's' : ''})`;
        } else if (avgScore >= 40) {
            level = 'medium';
            description = `Used external resources with partial understanding (${Math.round(avgScore)}% accountability across ${externalToolUsages.length} usage${externalToolUsages.length > 1 ? 's' : ''})`;
        } else {
            level = 'low';
            description = `Relied on external resources with limited understanding (${Math.round(avgScore)}% accountability across ${externalToolUsages.length} usage${externalToolUsages.length > 1 ? 's' : ''})`;
        }

        accountability = { level, avgScore, count: externalToolUsages.length, description };
    }

    return {
        finalScore: result.finalScore,
        experienceScore: result.experienceScore,
        codingScore: result.codingScore,
        performanceLevel,
        accountability
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
    hasCodeActivity: boolean,
    performanceContext: {
        finalScore: number;
        experienceScore: number;
        codingScore: number;
        performanceLevel: 'strong' | 'competent' | 'needs-development';
        accountability: {
            level: 'high' | 'medium' | 'low' | 'none';
            avgScore: number | null;
            count: number;
            description: string;
        };
    }
): string {

    return `From the data below, extract only the essential elements for ${candidateName}'s profile story.

OVERALL PERFORMANCE:
Final Score: ${performanceContext.finalScore}/100 (${performanceContext.performanceLevel.toUpperCase()})
Background Performance: ${performanceContext.experienceScore}/100
Coding Performance: ${performanceContext.codingScore}/100

CRITICAL: The story tone MUST reflect these scores. This is a ${performanceContext.performanceLevel} candidate overall.

EXECUTIVE SUMMARIES:
Experience: ${backgroundSummary.executiveSummary}
Coding: ${codingSummary.executiveSummary}

TOP STRENGTHS (highest scoring categories):
${organizedData.strongest.slice(0, 3).map((cat, i) =>
    `${i + 1}. ${cat.name} (${cat.type}, score: ${cat.score}/100)`
).join('\n')}

TOP WEAKNESSES (lowest scoring categories):
${organizedData.weakest.slice(0, 3).map((cat, i) =>
    `${i + 1}. ${cat.name} (${cat.type}, score: ${cat.score}/100)`
).join('\n')}

CODING ENGAGEMENT: ${hasCodeActivity ? 'Yes - candidate completed coding challenge' : 'No - candidate did NOT engage with coding challenge'}

EXTERNAL TOOL ACCOUNTABILITY: ${performanceContext.accountability.description}
ACCOUNTABILITY LEVEL: ${performanceContext.accountability.level.toUpperCase()} ${performanceContext.accountability.avgScore !== null ? `(${Math.round(performanceContext.accountability.avgScore)}%)` : '(N/A)'}

Extract and return JSON exactly in this format:
{
  "performanceQualifier": "1-2 words matching the performance level (strong/skilled/excellent for 70+, competent/developing for 50-69, needs-development/limited for <50)",
  "backgroundContext": "brief phrase about background stage quality (based on experienceScore ${performanceContext.experienceScore}/100)",
  "codingContext": "brief phrase about coding stage quality (based on codingScore ${performanceContext.codingScore}/100)",
  "strengths": ["strength1", "strength2"],
  "weakness": "weakness1",
  "accountabilityNote": "${performanceContext.accountability.level === 'none' ? '' : 'brief phrase about external tool accountability - MANDATORY if tools were used'}"
}

CRITICAL INSTRUCTIONS FOR EXTRACTION:
1. PERFORMANCE TONE:
   - Strong (70+): Use words like "skilled", "strong", "excellent", "demonstrates"
   - Competent (50-69): Use words like "competent", "developing", "shows", "growing"
   - Needs Development (<50): Use words like "developing", "limited", "needs improvement", "working to enhance"

2. BACKGROUND CONTEXT (experienceScore: ${performanceContext.experienceScore}/100):
   - Extract a phrase that reflects the QUALITY of their background, not just the content
   - Example: "solid background in X" vs "limited experience in X"

3. CODING CONTEXT (codingScore: ${performanceContext.codingScore}/100):
   - Extract a phrase that reflects the QUALITY of their coding performance
   - Example: "strong coding skills" vs "developing coding abilities"

4. ACCOUNTABILITY (${performanceContext.accountability.level}):
   - If external tools were used, accountabilityNote is MANDATORY and CENTRAL
   - HIGH: Frame as STRENGTH - "effectively leveraged resources with strong understanding"
   - MEDIUM: Frame neutrally - "used resources with partial understanding"
   - LOW: Frame as WEAKNESS - "relied on resources with limited understanding"

5. CATEGORY SELECTION:
   - Select 2 most significant strengths and 1 most significant weakness from the lists
   - Convert category names to natural concepts (not labels)
   - Scores should inform which categories to highlight`;
}

/**
 * PASS 2: Format extracted elements into maximum 280 characters with emphasis ranges.
 */
function buildFormattingPrompt(
    candidateName: string,
    jobTitle: string,
    extractedData: any
): string {

    return `REQUIRED JSON OUTPUT:
{
  "story": "Your story with HTML <span> tags for emphasis"
}

TASK: Write a professional profile story for ${candidateName} (${jobTitle}) with inline color emphasis using HTML spans.

COLOR CODING GUIDANCE:
- GREEN (strength): <span style="color: rgba(52, 199, 89, 0.9)">phrase</span>
- RED (weakness): <span style="color: rgba(255, 59, 48, 0.9)">phrase</span>

Use green for positive descriptors (excellent, strong, skilled, effectively) and red for areas needing development (limited, needs improvement, struggled).

DATA:
${JSON.stringify(extractedData, null, 2)}

STORY CONSTRAINTS:
- HARD LIMIT: 280 characters maximum for the story text
- Write like a tech recruiter summarizing a candidate profile after a technical interview
- The story should reflect the candidate's PERFORMANCE QUALITY, not just a list of categories

TONE REQUIREMENTS:
- Use performanceQualifier to set the overall tone (e.g., "Skilled" vs "Developing" vs "Limited")
- Incorporate backgroundContext to describe their experience stage performance
- Incorporate codingContext to describe their coding stage performance
- If accountabilityNote is present, it MUST be PROMINENT - this shows HOW they work

CONTENT STRUCTURE (flexible order, but include all elements):
1. Opening: performanceQualifier + role/title + backgroundContext
2. Coding: codingContext + accountabilityNote (if present)
3. Strengths: Top 1-2 technical strengths (natural language, not category labels)
4. Weakness: 1 development area (constructive framing)

LANGUAGE GUIDELINES:
- Convert category names to natural concepts:
  - "Code Quality and Explainability" → "writes clear, well-documented code"
  - "Python Programming" → "Python programming skills" or "Python development"
  - "Data Pipelines" → "building data pipelines" or "pipeline development"
- Avoid numbers, scores, or percentages in the final text
- Use active voice and flowing sentences (not bullet points)
- End with a complete sentence

EXAMPLES OF GOOD STORIES:

Strong candidate (70+ score, high accountability):
"Skilled Data Engineer with excellent background in distributed systems. Demonstrates strong Python programming and effectively leverages external resources with full understanding. Excels in building scalable pipelines. Could improve testing practices."

Competent candidate (50-69 score, medium accountability):
"Competent Backend Developer with solid API development experience. Shows growing Node.js skills and used external resources with partial understanding for database implementations. Demonstrates good system design. Needs improvement in authentication patterns."

Needs Development candidate (<50 score, low accountability):
"Developing Full-Stack Engineer with limited production experience. Relied on external resources with minimal understanding during coding challenges. Shows basic React knowledge. Needs significant improvement in independent problem-solving and code quality."

EMPHASIS EXAMPLES:
- Strength (green): "Skilled engineer with <span style="color: rgba(52, 199, 89, 0.9)">excellent background</span> in systems."
- Weakness (red): "Shows <span style="color: rgba(255, 59, 48, 0.9)">limited experience</span> in the field."

Emphasize 2-4 SHORT PHRASES (2-3 words each) that represent key strengths or weaknesses.

Example output:
{
  "story": "Developing Full-Stack Engineer with <span style=\"color: rgba(255, 59, 48, 0.9)\">limited production experience</span>. <span style=\"color: rgba(255, 59, 48, 0.9)\">Struggled during</span> coding challenges. Shows <span style=\"color: rgba(255, 59, 48, 0.9)\">basic React</span> knowledge."
}`;
}
