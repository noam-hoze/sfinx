import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { log } from "app/shared/services";

const openaiClient = new OpenAI({
    apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { finalCode, codingTask, categories } = body;

        if (!finalCode || !codingTask || !categories || !Array.isArray(categories)) {
            return NextResponse.json(
                { error: "Missing required fields: finalCode, codingTask, categories" },
                { status: 400 }
            );
        }

        log.info("[Job-Specific Coding Eval] Evaluating code against categories:", categories.length);

        // Build category list for prompt
        const categoryList = categories
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
    },
    "Category Name 2": {
      "score": number (0-100),
      "text": "Brief explanation of assessment"
    }
  }
}`;

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                {
                    role: "user",
                    content: "Evaluate the code against the specified criteria.",
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
        
        // Validate response structure
        if (!result.categories || typeof result.categories !== "object") {
            throw new Error("Invalid response structure from OpenAI");
        }

        log.info("[Job-Specific Coding Eval] Evaluation complete");

        return NextResponse.json(result);
    } catch (error: any) {
        log.error("[Job-Specific Coding Eval] Error:", error);
        return NextResponse.json(
            {
                error: "Failed to evaluate job-specific coding",
                details: process.env.NODE_ENV !== "production" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

