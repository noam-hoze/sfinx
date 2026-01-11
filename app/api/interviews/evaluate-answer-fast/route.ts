import { NextRequest, NextResponse } from "next/server";
import { log } from "app/shared/services";
import OpenAI from "openai";

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
        const { question, answer, experienceCategories, currentCounts, currentFocusTopic, conversationHistory } = body;

        if (!question || answer === undefined || !experienceCategories || !currentCounts) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        log.info("[evaluate-answer-fast] Fast evaluation started");

        const evaluationModel = process.env.NEXT_PUBLIC_OPENAI_EVALUATION_MODEL;
        if (!evaluationModel) {
            throw new Error("NEXT_PUBLIC_OPENAI_EVALUATION_MODEL environment variable is not set");
        }

        // Build category list with current counts
        const TARGET = 5;
        const categoryList = experienceCategories.map((cat: any) => {
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

Step 1 - Score each category 0-100:
0=blank, 1-30=vague, 31-60=basic, 61-80=clear, 81-100=exceptional

Step 2 - Generate next question:
${focusInstruction}
${conversationHistory?.length > 0 ? `\nLast exchange: ${conversationHistory.slice(-1)[0]?.text?.substring(0, 100)}` : ''}

Return JSON:
{"scores": [{"category": "Name", "strength": 0-100}], "nextQuestion": "...", "targetedCategory": "Category Name you're asking about"}`;


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
        let newFocusTopic = currentFocusTopic;
        
        if (!newFocusTopic) {
            // Initial state: pick topic with highest count
            newFocusTopic = updatedCounts.sort((a, b) => b.count - a.count)[0].categoryName;
        } else {
            const currentStats = updatedCounts.find(c => c.categoryName === newFocusTopic);
            if (currentStats && currentStats.count >= TARGET) {
                // Current topic saturated, need to pivot
                const underSaturated = updatedCounts.filter(c => c.count < TARGET);
                if (underSaturated.length > 0) {
                    // Switch to highest count among under-saturated
                    newFocusTopic = underSaturated.sort((a, b) => b.count - a.count)[0].categoryName;
                }
                // If all saturated, keep current (Phase 3 doesn't persist focus)
            }
        }

        log.info("[evaluate-answer-fast] Fast evaluation complete");

        return NextResponse.json({
            success: true,
            scores: result.scores,
            nextQuestion: result.nextQuestion,
            targetedCategory: result.targetedCategory,
            updatedCounts,
            newFocusTopic,
        });
    } catch (error) {
        log.error("[evaluate-answer-fast] ❌ Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
