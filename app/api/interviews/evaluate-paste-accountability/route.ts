import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { log } from "app/shared/services";

const openaiClient = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { pastedContent, question, answer, codingTask, questionNumber } = body;

        if (!pastedContent || !question || !answer) {
            return NextResponse.json(
                { error: "Missing required fields: pastedContent, question, answer" },
                { status: 400 }
            );
        }

        log.info(`[Paste Accountability] Evaluating Q${questionNumber || '?'} understanding...`);

        const systemPrompt = `You are evaluating a single question-answer exchange about pasted code in a coding interview.

**Context:**
- Coding Task: ${codingTask || "Build a React component"}
- Code Pasted: ${pastedContent}
- Question #${questionNumber || '?'}: ${question}
- Candidate's Answer: ${answer}

**Your Task:**
Score ONLY this specific answer to this specific question. Evaluate if the candidate understands what they were asked about.

**Scoring (0-100):**
- 80-100: Clear, accurate explanation; demonstrates full understanding of the concept asked
- 50-79: Mostly correct but missing details or shows some confusion
- 20-49: Vague, incomplete, or partially incorrect explanation
- 0-19: Wrong, avoids question, or shows no understanding

Return ONLY valid JSON with this exact structure:
{
  "score": number (0-100),
  "reasoning": "Brief explanation of why this answer received this score",
  "understandingLevel": "full" | "partial" | "none"
}`;

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: `Evaluate this answer and return the score.`,
                },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error("Empty response from OpenAI");
        }

        const result = JSON.parse(content);
        
        if (
            typeof result.score !== "number" ||
            !result.reasoning ||
            !result.understandingLevel
        ) {
            throw new Error("Invalid response structure from OpenAI");
        }

        log.info(`[Paste Accountability] Q${questionNumber || '?'} score: ${result.score}`);

        return NextResponse.json(result);
    } catch (error: any) {
        log.error("[Paste Accountability] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to evaluate paste accountability",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

