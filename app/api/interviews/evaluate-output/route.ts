import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { log } from "app/shared/services";
import { LOG_CATEGORIES } from "app/shared/services/logger.config";

const LOG_CATEGORY = LOG_CATEGORIES.INTERVIEWS;

const openaiClient = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
    const requestId = req.headers.get("x-request-id");
    try {
        const {
            actualOutput,
            expectedOutput,
            codingTask,
            codeSnapshot,
        } = await req.json();

        if (!actualOutput || !expectedOutput || !codingTask) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const systemPrompt = `You are evaluating a coding challenge iteration. Compare the actual output against the expected output and return STRICT JSON only.

Coding Task:
${codingTask}

Expected Output:
${expectedOutput}

Actual Output:
${actualOutput}

Code Snapshot:
${codeSnapshot || "(not provided)"}

Evaluate if the actual output matches the expected output. Return ONLY valid JSON in this exact format:
{
  "evaluation": "correct" | "partial" | "incorrect",
  "reasoning": "Brief explanation of why the output matches/differs from expected",
  "matchPercentage": 0-100,
  "caption": "Short human-readable description for video evidence (e.g., 'First working solution achieved')"
}`;

        const response = await openaiClient.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: "Evaluate this iteration and return the result.",
                },
            ],
            temperature: 0.3,
            response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error("No response from OpenAI");
        }

        const evaluation = JSON.parse(content);

        // Validate response structure
        if (
            !evaluation.evaluation ||
            !["correct", "partial", "incorrect"].includes(evaluation.evaluation)
        ) {
            throw new Error("Invalid evaluation format from OpenAI");
        }

        return NextResponse.json(evaluation);
    } catch (error: any) {
        log.error(LOG_CATEGORY, "[evaluate-output] Error", {
            requestId,
            errorMessage: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            {
                error: "Failed to evaluate output",
                details: error?.message || "Unknown error",
            },
            { status: 500 }
        );
    }
}
