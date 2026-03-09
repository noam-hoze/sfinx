import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import prisma from "lib/prisma";
import { log } from "app/shared/services";

import { LOG_CATEGORIES } from "app/shared/services/logger.config";
const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/** Evaluate correctness of candidate code against reference solution. */
async function evaluateProblemSolvingCorrectness(params: {
    finalCode: string;
    codingTask: string;
    referenceCode: string;
    sessionId: string;
}): Promise<{ score: number; text: string }> {
    const { finalCode, codingTask, referenceCode, sessionId } = params;

    const iterations = await prisma.iteration.findMany({
        where: { interviewSessionId: sessionId },
        orderBy: { matchPercentage: "desc" },
        take: 1,
    });

    if (iterations.length === 0) {
        log.info(LOG_CATEGORY, "[Job-Specific Coding Eval] Problem Solving: no code runs, score = 0");
        return { score: 0, text: "Code was not executed during the interview." };
    }

    const outputMatchPercentage = iterations[0].matchPercentage;

    const correctnessPrompt = `You are evaluating whether a candidate's code correctly solves a coding challenge.

**Coding Task:**
${codingTask}

**Reference Solution (for context on what a correct solution looks like):**
\`\`\`
${referenceCode}
\`\`\`

**Candidate's Final Code:**
\`\`\`
${finalCode}
\`\`\`

Evaluate how correctly the candidate solved the problem (0-100):
- Does the solution handle the core requirements?
- Does it handle edge cases?
- Is the logic sound and would it produce correct results?

The candidate does NOT need to match the reference approach — a different correct algorithm scores just as high.

Return ONLY JSON:
{
  "correctnessScore": number (0-100),
  "text": "Brief explanation of correctness assessment"
}`;

    const completion = await openaiClient.chat.completions.create({
        model: process.env.NEXT_PUBLIC_OPENAI_EVALUATION_MODEL!,
        messages: [
            { role: "system", content: "You are an expert code reviewer. Respond in JSON format." },
            { role: "user", content: correctnessPrompt },
        ],
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Empty correctness response from OpenAI");

    const result = JSON.parse(content);
    const correctnessScore = result.correctnessScore ?? 0;
    const problemSolvingScore = Math.round((correctnessScore + outputMatchPercentage) / 2);

    log.info(LOG_CATEGORY, `[Job-Specific Coding Eval] Problem Solving — Correctness: ${correctnessScore}%, Output match: ${outputMatchPercentage}%, Final: ${problemSolvingScore}`);

    return {
        score: problemSolvingScore,
        text: `${result.text ?? ""} (Correctness: ${correctnessScore}%, Output match: ${outputMatchPercentage}%)`,
    };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { finalCode, codingTask, categories, referenceCode, sessionId } = body;

        if (!finalCode || !codingTask || !categories || !Array.isArray(categories)) {
            return NextResponse.json(
                { error: "Missing required fields: finalCode, codingTask, categories" },
                { status: 400 }
            );
        }

        log.info(LOG_CATEGORY, "[Job-Specific Coding Eval] Evaluating code against categories:", categories.length);
        log.info(LOG_CATEGORY, "[Job-Specific Coding Eval] Has reference code:", !!referenceCode);

        // Separate Problem Solving from job-specific categories — it is evaluated independently
        const otherCategories = categories.filter((cat: any) => cat.name !== "Problem Solving");
        const categoryList = otherCategories
            .map((cat: any) => `- ${cat.name}: ${cat.description}`)
            .join("\n");

        const systemPrompt = `You are a technical interviewer evaluating code against specific job requirements.

**Coding Task:**
${codingTask}

**Final Code Submitted:**
\`\`\`
${finalCode}
\`\`\`
**Evaluation Criteria:**
${categoryList}

**Your Task:**
Evaluate the submitted code against each criterion above. For each criterion, provide:
1. A score from 0-100
2. A brief text explanation (2-3 sentences)

**Scoring Guidelines:**
- 90-100: Exceptional implementation, demonstrates mastery
- 75-89: Strong implementation, follows best practices
- 60-74: Adequate implementation, some improvements needed
- 40-59: Basic implementation, significant gaps in best practices
- 20-39: Poor implementation, lacks fundamental understanding
- 0-19: Missing or incorrect implementation

Return ONLY valid JSON with this exact structure:
{
  "categories": {
    "Category Name 1": {
      "score": number (0-100),
      "text": "Brief explanation of assessment"
    }
  }
}`;

        const completion = await openaiClient.chat.completions.create({
            model: process.env.NEXT_PUBLIC_OPENAI_EVALUATION_MODEL!,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Evaluate the code against the specified criteria." },
            ],
            max_completion_tokens: 2000,
            response_format: { type: "json_object" },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("Empty response from OpenAI");

        const result = JSON.parse(content);
        if (!result.categories || typeof result.categories !== "object") {
            throw new Error("Invalid response structure from OpenAI");
        }

        // Evaluate Problem Solving separately when reference code is available
        if (referenceCode && sessionId) {
            log.info(LOG_CATEGORY, "[Job-Specific Coding Eval] Evaluating Problem Solving");
            try {
                const psResult = await evaluateProblemSolvingCorrectness({
                    finalCode,
                    codingTask,
                    referenceCode,
                    sessionId,
                });
                result.categories["Problem Solving"] = psResult;
            } catch (psError) {
                log.error(LOG_CATEGORY, "[Job-Specific Coding Eval] Problem Solving evaluation error:", psError);
                result.categories["Problem Solving"] = {
                    score: 0,
                    text: "Problem Solving evaluation failed.",
                };
            }
        }

        log.info(LOG_CATEGORY, "[Job-Specific Coding Eval] Evaluation complete");
        return NextResponse.json(result);
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[Job-Specific Coding Eval] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to evaluate job-specific coding",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}
