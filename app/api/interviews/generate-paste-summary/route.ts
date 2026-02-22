import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { log } from "app/shared/services";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pastedContent, questionAnswers, averageScore } = body;

        if (!pastedContent || !questionAnswers || typeof averageScore !== "number") {
            return NextResponse.json(
                { error: "Missing required fields: pastedContent, questionAnswers, averageScore" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[Paste Summary] Generating final summary...");

        // Build Q&A history string
        const qaHistory = questionAnswers
            .map((qa: any, idx: number) => 
                `Q${idx + 1} (score: ${qa.score}): ${qa.question}\nA${idx + 1}: ${qa.answer}\nReasoning: ${qa.reasoning}`
            )
            .join("\n\n");

        const systemPrompt = `You are evaluating a candidate's understanding of code they pasted during an interview.

**Pasted Code (for context only):**
${pastedContent}

**Question & Answer History with Scores:**
${qaHistory}

**Average Score:** ${averageScore}/100

**Your Task:**
Write 1-2 sentences that accurately summarize what the candidate demonstrated in their ANSWERS. Evaluate strictly based on what the candidate actually said, not what you can infer from the code itself.

- If the candidate said "I don't know" or gave minimal responses, reflect that accurately (e.g., "The candidate indicated limited understanding of the code.")
- If the candidate explained concepts, reference what they specifically mentioned
- Be accurate and evidence-based - only credit understanding that was demonstrated in their answers

Examples:
- Answer: "I don't know" → "The candidate indicated they were unfamiliar with the code structure."
- Low score with attempted explanation → "The candidate identified the useState hook but struggled to explain lifecycle methods and data flow."
- Good score → "The candidate demonstrated solid understanding of prop handling and event binding, with some gaps in optimization techniques."

Return ONLY the summary text (no JSON, no extra formatting).`;

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: "Provide the summary.",
                },
            ],
            temperature: 0.3,
        });

        const summary = completion.choices[0]?.message?.content?.trim() || "";

        if (!summary) {
            throw new Error("Empty response from OpenAI");
        }

        log.info(LOG_CATEGORY, "[Paste Summary] Summary generated successfully");

        return NextResponse.json({ summary });
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[Paste Summary] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to generate paste summary",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

