import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import prisma from "lib/prisma";
import OpenAI from "openai";
import { CONTRIBUTIONS_TARGET } from "shared/constants/interview";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openai = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

/**
 * POST /api/interviews/evaluate-answer-fast
 * Fast evaluation: returns only category scores and next question (no reasoning/captions/DB saves)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, question, answer, experienceCategories, currentCounts, currentFocusTopic, conversationHistory, excludedTopics, answerHistory } = body;

        if (!sessionId || !question || answer === undefined || !experienceCategories || !currentCounts) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        if (!Array.isArray(excludedTopics)) {
            return NextResponse.json(
                { error: "excludedTopics must be an array" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[evaluate-answer-fast] Fast evaluation started");

        // Fetch session to get company/job context
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
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

        if (!session?.application?.job) {
            throw new Error("Session or job not found");
        }

        const companyName = session.application.job.company?.name;
        const jobTitle = session.application.job.title;

        const evaluationModel = process.env.NEXT_PUBLIC_OPENAI_EVALUATION_MODEL;
        if (!evaluationModel) {
            throw new Error("NEXT_PUBLIC_OPENAI_EVALUATION_MODEL environment variable is not set");
        }

        // Filter out excluded categories
        let activeCategories = experienceCategories.filter(
            (cat: any) => !excludedTopics.includes(cat.name)
        );

        // Check if all categories excluded
        if (activeCategories.length === 0) {
            log.info(LOG_CATEGORY, "[evaluate-answer-fast] All categories excluded - ending interview");
            return NextResponse.json({
                success: true,
                allCategoriesExcluded: true,
                scores: [],
                acknowledgment: "Thanks for your responses.",
                nextQuestion: null,
                isDontKnow: false,
                updatedCounts: currentCounts,
                newFocusTopic: null,
            });
        }

        // Build category list with current counts (using active categories only)
        const TARGET = CONTRIBUTIONS_TARGET;
        
        const categoryList = activeCategories.map((cat: any) => {
            const stats = currentCounts.find((c: any) => c.categoryName === cat.name);
            return `${cat.name}: ${stats?.count || 0} contributions (avg ${stats?.avgStrength || 0}%)`;
        }).join(', ');

        // DETERMINISTIC ROUTING: Pick next topic based on current counts
        const activeCategoryNames = activeCategories.map((cat: any) => cat.name);
        const countsForSelection = currentCounts.filter((c: any) => activeCategoryNames.includes(c.categoryName));

        // Partition: active (count < TARGET) vs inactive (count >= TARGET)
        const active = countsForSelection.filter((c: any) => c.count < TARGET);

        let newFocusTopic: string;
        if (active.length > 0) {
            // MODE 1: Contribution collection - prefer higher count, tie-break by higher strength
            newFocusTopic = active.sort((a: any, b: any) => 
                b.count - a.count || b.avgStrength - a.avgStrength
            )[0].categoryName;
        } else {
            // MODE 2: Rebalance - pick weakest category (lowest avgStrength)
            newFocusTopic = countsForSelection.sort((a: any, b: any) => 
                a.avgStrength - b.avgStrength
            )[0].categoryName;
        }

        const focusInstruction = `Ask your next question about: "${newFocusTopic}"`;

        // Build conversation history context
        let historyContext = "";
        if (answerHistory && answerHistory.length > 0) {
            historyContext = `\n\nConversation History:\n${answerHistory.map((entry: any, i: number) => 
                `Q${i+1}: ${entry.question}\nA${i+1}: ${entry.answer}\nScores: ${entry.scores.map((s: any) => `${s.category}: ${s.strength}`).join(', ')}`
            ).join('\n\n')}`;
        }

        const fastPrompt = `Score this answer and generate next question.

QUESTION: ${question}
ANSWER: ${answer}

Current status: ${categoryList}${historyContext}

Step 1 - Detect uncertainty:
If the answer says "I don't know" or similar ("not sure", "no experience", "haven't worked with that"), set isDontKnow: true
Otherwise set isDontKnow: false

Step 2 - Score each category 0-100:
0=blank, 1-30=vague, 31-60=basic, 61-80=clear, 81-100=exceptional

Step 3 - Generate acknowledgment and next question:
${focusInstruction}

Generate a short, natural acknowledgment (max 4 words). Vary your language - avoid repeating words like "great" or "excellent" from previous turns.
Generate the next question separately.
Return JSON:
{
  "isDontKnow": true/false,
  "scores": [{"category": "Name", "strength": 0-100}],
  "acknowledgment": "...",
  "nextQuestion": "..."
}`;

        const messages = [
            {
                role: "system" as const,
                content: companyName && jobTitle 
                    ? `You are a technical interviewer at ${companyName} evaluating candidates for the ${jobTitle} position. Return valid JSON only.`
                    : "You are a technical interviewer. Return valid JSON only.",
            },
            {
                role: "user" as const,
                content: fastPrompt,
            },
        ];
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("→ OpenAI Request [evaluate-answer-fast]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("Model:", evaluationModel);
        console.log("\nSystem:", messages[0].content);
        console.log("\nUser Prompt:", messages[1].content);

        const completion = await openai.chat.completions.create({
            model: evaluationModel,
            messages,
            response_format: { type: "json_object" },
            temperature: 0.3,
        });

        const responseText = completion.choices[0]?.message?.content;
        console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("← OpenAI Response [evaluate-answer-fast]");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(JSON.stringify(JSON.parse(responseText || "{}"), null, 2));
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
        
        if (!responseText) {
            throw new Error("OpenAI returned empty response");
        }

        const result = JSON.parse(responseText);
        
        // If this is an "I don't know" answer, increment dontKnowCount in-memory for current topic
        let countsForTopicSelection = currentCounts;
        if (result.isDontKnow && currentFocusTopic) {
            countsForTopicSelection = currentCounts.map((c: any) => {
                if (c.categoryName === currentFocusTopic) {
                    return { ...c, dontKnowCount: c.dontKnowCount + 1 };
                }
                return c;
            });
            
            // Re-compute exclusions with incremented count
            if (!process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD) {
                throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD environment variable is not set");
            }
            const threshold = parseInt(process.env.NEXT_PUBLIC_DONT_KNOW_THRESHOLD, 10);
            if (!Number.isFinite(threshold) || threshold < 1) {
                throw new Error("NEXT_PUBLIC_DONT_KNOW_THRESHOLD must be a positive integer");
            }
            const newExcludedTopics = countsForTopicSelection
                .filter((c: any) => c.dontKnowCount >= threshold)
                .map((c: any) => c.categoryName);
            
            if (newExcludedTopics.length > 0) {
                // Re-filter active categories
                const newActiveCategories = experienceCategories.filter(
                    (cat: any) => !newExcludedTopics.includes(cat.name)
                );
                
                // Check if all categories now excluded
                if (newActiveCategories.length === 0) {
                    log.info(LOG_CATEGORY, "[evaluate-answer-fast] All categories excluded after increment");
                    return NextResponse.json({
                        success: true,
                        allCategoriesExcluded: true,
                        scores: [],
                        acknowledgment: "Thanks for your responses.",
                        nextQuestion: null,
                        isDontKnow: false,
                        updatedCounts: currentCounts,
                        newFocusTopic: null,
                    });
                }
                
                // Update activeCategories for topic selection below
                activeCategories = newActiveCategories;
            }
        }
        
        // Calculate updated counts in-memory
        const updatedCounts = experienceCategories.map((category: any) => {
            const existing = currentCounts.find((c: any) => c.categoryName === category.name);
            const newScore = result.scores.find((s: any) => s.category === category.name);
            
            if (!newScore || newScore.strength === 0) {
                return existing || { categoryName: category.name, count: 0, avgStrength: 0 };
            }
            
            const oldCount = existing?.count || 0;
            const oldAvg = existing?.avgStrength || 0;
            const newCount = oldCount + 1;
            const newAvg = Math.round((oldAvg * oldCount + newScore.strength) / newCount);
            
            return {
                categoryName: category.name,
                count: newCount,
                avgStrength: newAvg,
            };
        });

        log.info(LOG_CATEGORY, "[evaluate-answer-fast] Fast evaluation complete");

        return NextResponse.json({
            success: true,
            scores: result.scores,
            acknowledgment: result.acknowledgment,
            nextQuestion: result.nextQuestion,
            isDontKnow: result.isDontKnow || false,
            updatedCounts,
            newFocusTopic,
        });
    } catch (error) {
        log.error(LOG_CATEGORY, "[evaluate-answer-fast] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
