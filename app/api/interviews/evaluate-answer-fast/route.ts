import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";
import OpenAI from "openai";

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
        const { question, answer, experienceCategories, currentCounts, currentFocusTopic, conversationHistory, excludedTopics } = body;

        if (!question || answer === undefined || !experienceCategories || !currentCounts) {
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
                targetedCategory: null,
                isDontKnow: false,
                updatedCounts: currentCounts,
                newFocusTopic: null,
            });
        }

        // Build category list with current counts (using active categories only)
        const TARGET = 5;
        const categoryList = activeCategories.map((cat: any) => {
            const stats = currentCounts.find((c: any) => c.categoryName === cat.name);
            return `${cat.name}: ${stats?.count || 0} contributions (avg ${stats?.avgStrength || 0}%)`;
        }).join(', ');

        // Give OpenAI the rules to decide dynamically after scoring
        let focusInstruction = "";
        if (currentFocusTopic) {
            focusInstruction = `Current focus topic: "${currentFocusTopic}".

After you score this answer, calculate NEW counts:
- For each category you scored > 0: new count = current count + 1

Then decide next question topic:
1. If "${currentFocusTopic}" NEW count < ${TARGET}: Continue asking about "${currentFocusTopic}"
2. If "${currentFocusTopic}" NEW count >= ${TARGET}:
   - Find all categories with NEW count < ${TARGET}
   - If any exist: Ask about the one with HIGHEST NEW count
   - If none exist (all >= ${TARGET}): Ask about category with LOWEST average score`;
        } else {
            focusInstruction = "After scoring, identify which category you gave the HIGHEST score to. Ask your next question about that category.";
        }

        const fastPrompt = `Score this answer and generate next question.

QUESTION: ${question}
ANSWER: ${answer}

Current status: ${categoryList}

Step 1 - Detect uncertainty:
If the answer says "I don't know" or similar ("not sure", "no experience", "haven't worked with that"), set isDontKnow: true
Otherwise set isDontKnow: false

Step 2 - Score each category 0-100:
0=blank, 1-30=vague, 31-60=basic, 61-80=clear, 81-100=exceptional

Step 3 - Generate acknowledgment and next question:
${focusInstruction}
${conversationHistory?.length > 0 ? `\nLast exchange: ${conversationHistory.slice(-1)[0]?.text?.substring(0, 100)}` : ''}

Generate a short acknowledgment (max 12 words).
Generate the next question separately.
Return JSON:
{
  "isDontKnow": true/false,
  "scores": [{"category": "Name", "strength": 0-100}],
  "acknowledgment": "...",
  "nextQuestion": "...",
  "targetedCategory": "Category Name you're asking about"
}`;


        const completion = await openai.chat.completions.create({
            model: evaluationModel,
            messages: [
                {
                    role: "system",
                    content: "You are a technical interviewer. Return valid JSON only.",
                },
                {
                    role: "user",
                    content: fastPrompt,
                },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
            throw new Error("OpenAI returned empty response");
        }

        const result = JSON.parse(responseText);
        
        // If this is an "I don't know" answer, increment dontKnowCount in-memory for topic selection
        let countsForTopicSelection = currentCounts;
        if (result.isDontKnow && result.targetedCategory) {
            countsForTopicSelection = currentCounts.map((c: any) => {
                if (c.categoryName === result.targetedCategory) {
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
                        targetedCategory: null,
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

        // Determine new focus topic based on updated counts
        // Filter to only consider active (non-excluded) categories
        const activeCategoryNames = activeCategories.map((c: any) => c.name);
        const countsForSelection = updatedCounts.filter((c: any) => activeCategoryNames.includes(c.categoryName));
        
        let newFocusTopic = currentFocusTopic;
        
        if (!newFocusTopic || !activeCategoryNames.includes(newFocusTopic)) {
            // Initial state or current topic is now excluded: pick topic with highest count from active categories
            if (countsForSelection.length > 0) {
                newFocusTopic = countsForSelection.sort((a: any, b: any) => b.count - a.count)[0].categoryName;
            }
        } else {
            const currentStats = countsForSelection.find((c: any) => c.categoryName === newFocusTopic);
            if (currentStats && currentStats.count >= TARGET) {
                // Current topic saturated, need to pivot
                const underSaturated = countsForSelection.filter((c: any) => c.count < TARGET);
                if (underSaturated.length > 0) {
                    // Switch to highest count among under-saturated
                    newFocusTopic = underSaturated.sort((a: any, b: any) => b.count - a.count)[0].categoryName;
                }
                // If all saturated, keep current (Phase 3 doesn't persist focus)
            }
        }

        log.info(LOG_CATEGORY, "[evaluate-answer-fast] Fast evaluation complete");

        return NextResponse.json({
            success: true,
            scores: result.scores,
            acknowledgment: result.acknowledgment,
            nextQuestion: result.nextQuestion,
            targetedCategory: result.targetedCategory,
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
