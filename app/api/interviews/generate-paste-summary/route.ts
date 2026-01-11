import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { log } from "app/shared/services";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openaiClient = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
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

**Pasted Code:**
${pastedContent}

**Question & Answer History with Scores:**
${qaHistory}

**Average Score:** ${averageScore}/100

**Your Task:**
Provide a 1-2 sentence summary of the candidate's overall understanding and accountability for this code. Be concise and specific.

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

